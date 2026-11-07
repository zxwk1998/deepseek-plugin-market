#!/usr/bin/env node
/**
 * 把 out/ 静态产物发布到服务器。
 *
 * 为什么用 rsync 而不是 tar/scp：
 *   站点有 1600+ 个详情页目录，每天重新构建后大部分文件内容不变。
 *   rsync 只传差异，日常更新通常几百 KB、几秒完成；scp 全量要传几十 MB。
 *   --delete 保证删掉的插件不会留下"孤儿页面"（否则详情页还在、链接却已失效）。
 *
 * 用法：
 *   node scripts/deploy.mjs                  # 发布已有 out/
 *   node scripts/deploy.mjs --build          # 先构建再发布
 *   node scripts/deploy.mjs --dry-run        # 只看会改哪些文件，不实际传输
 *   node scripts/deploy.mjs --no-delete      # 不做删除（首次排障时用）
 *
 * 环境变量（**没有硬编码默认值**，全部从 .env.local / .env / 进程环境读取）：
 *   DEPLOY_HOST      服务器地址
 *   DEPLOY_PORT      SSH 端口
 *   DEPLOY_USER      登录用户
 *   DEPLOY_SSH_KEY   私钥绝对路径
 *   DEPLOY_PATH      站点目录
 *   DEPLOY_URL       站点根地址（用于发布后校验）
 *
 * 之所以不在代码里写默认值：这是一个公开仓库，把主机/端口/用户写死
 * 等于把服务器的运维入口直接贴在网上。凭据与拓扑一律留在 git 忽略的
 * .env.local 里，仓库中只保留字段名（见 .env.example）。
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";

const args = process.argv.slice(2);
const hasFlag = (n) => args.includes(`--${n}`);

function loadEnvFiles(files = [".env.local", ".env"]) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      const value = raw.replace(/^["']|["']$/g, "");
      if (value && !process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFiles();

const HOST = process.env.DEPLOY_HOST || "";
const PORT = process.env.DEPLOY_PORT || "22";
const USER = process.env.DEPLOY_USER || "";
const KEY = process.env.DEPLOY_SSH_KEY || "";
const TARGET = process.env.DEPLOY_PATH || "";
const SITE_URL = process.env.DEPLOY_URL || "https://deepseek.vuejs-core.cn/";
/** SSR 版：应用目录（不在 web root 内，避免源码被当静态文件读）与监听端口 */
const SSR_PATH = process.env.SSR_PATH || "/www/wwwroot/dsh-ssr";
const SSR_PORT = process.env.SSR_PORT || "3210";
const APP_NAME = process.env.SSR_APP_NAME || "dsh-ssr";
const OUT = resolve("out");
const STANDALONE = resolve(".next/standalone");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function run(cmd, cmdArgs, label, opts = {}) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`✗ ${label} 失败（exit ${r.status}）`);
    process.exit(1);
  }
}

/** 递归列出相对路径（生成服务端差集删除用的清单） */
function listFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) listFiles(full, base, out);
    else if (e.isFile()) out.push(full.slice(base.length + 1));
  }
  return out;
}

/**
 * SSR 发布：把 .next/standalone 推到应用目录，用 pm2 拉起/重启。
 *
 * 为什么不再往 web root 塞文件：
 *   站点改成"按请求渲染"后，磁盘上只有一份数据 + 一个进程，
 *   数据更新只要替换 data/site.db 再重启，不需要重新构建、不需要传 2600 个页面。
 *
 * `--data-only` 只同步数据文件并重启，用于每日数据刷新（几 MB、几秒）。
 */
function deploySsr(ssh) {
  const dataOnly = hasFlag("data-only");

  if (!dataOnly && !existsSync(join(STANDALONE, "server.js"))) {
    fail("找不到 .next/standalone/server.js，先执行 pnpm build");
  }

  if (dataOnly) {
    console.log(`› 只同步数据 → ${USER}@${HOST}:${SSR_PATH}/data`);
    run(
      "rsync",
      [
        "-az",
        "--info=stats1",
        "-e",
        `ssh ${ssh.join(" ")}`,
        "data/site.db",
        "data/plugins.json",
        "data/meta.json",
        `${USER}@${HOST}:${SSR_PATH}/data/`,
      ],
      "数据同步",
    );
  } else {
    const files = listFiles(STANDALONE);
    const t0 = Date.now();
    console.log(`› 推送运行包 ${files.length} 个文件 → ${SSR_PATH}（gzip -1）`);
    const pipeline =
      `set -o pipefail; ` +
      `tar -cf - -C '${STANDALONE}' . | gzip -1 ` +
      `| ssh ${ssh.join(" ")} ${USER}@${HOST} 'mkdir -p ${SSR_PATH} && tar -xzf - -C ${SSR_PATH}'`;
    run("bash", ["-c", pipeline], "运行包推送");
    console.log(`  ✓ 传输完成 ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  }

  // pm2：首次 start，之后 reload。内存上限卡在 340M —— 这台机器只剩 300MB 左右，
  // 超过就让 pm2 重启，总比把整台机器拖进 swap 好。
  console.log("› 重启应用");
  const startCmd = [
    `cd ${SSR_PATH}`,
    `PORT=${SSR_PORT} HOSTNAME=127.0.0.1 NODE_ENV=production NODE_OPTIONS=--max-old-space-size=256`,
    `pm2 startOrReload server.js --name ${APP_NAME} --max-memory-restart 340M --update-env`,
  ].join(" && ");
  const r = spawnSync("ssh", [...ssh, `${USER}@${HOST}`, `${startCmd} >/dev/null 2>&1 || (${startCmd})`], {
    stdio: "inherit",
  });
  if (r.status !== 0) fail("pm2 启动失败");
  run("ssh", [...ssh, `${USER}@${HOST}`, "pm2 save >/dev/null 2>&1; sleep 2; pm2 list | sed -n '1,6p'"], "pm2 状态");

  console.log("› 健康检查");
  const health = spawnSync(
    "ssh",
    [
      ...ssh,
      `${USER}@${HOST}`,
      `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${SSR_PORT}/ && echo ' 首页' ` +
        `&& curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:${SSR_PORT}/plugin/ruvnet-ruflo/ && echo ' 详情页'`,
    ],
    { encoding: "utf8" },
  );
  console.log((health.stdout || "").trim());
  if (!(health.stdout || "").includes("200")) {
    console.error("  ! 应用未返回 200，检查 pm2 logs " + APP_NAME);
    process.exitCode = 1;
  }
}

/**
 * 单流推送：本地打包 → 服务器原地解压 → 清单差集清理。
 * 只建立两次 SSH 连接（传输 + 清理），不受文件数影响。
 */
function deployByTar(ssh) {
  const files = listFiles(OUT);
  const manifest = files.join("\n");

  if (hasFlag("dry-run")) {
    console.log(`· --dry-run：将打包 ${files.length} 个文件，跳过传输与清理`);
    return;
  }

  // pigz 有就并行压，没有退 gzip；level 1 对 HTML 已经够（体积差 <5%，速度快 5 倍）
  const hasPigz = spawnSync("sh", ["-c", "command -v pigz"], { encoding: "utf8" }).status === 0;
  const compressor = hasPigz ? "pigz -1" : "gzip -1";

  const t0 = Date.now();
  console.log(`› 打包 ${files.length} 个文件 → ${USER}@${HOST}:${TARGET}（${compressor}）`);
  // 不用 tar 的 --use-compress-program：macOS 自带的是 bsdtar，带参数会解析失败。
  // 显式走管道更可控，也不依赖 tar 实现。
  const pipeline =
    `set -o pipefail; ` +
    `tar -cf - -C '${OUT}' . ` +
    `| ${compressor} ` +
    `| ssh ${ssh.join(" ")} ${USER}@${HOST} 'tar -xzf - -C ${TARGET}'`;
  run("bash", ["-c", pipeline], "tar 推送");
  console.log(`  ✓ 传输完成 ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (hasFlag("no-delete")) return;

  /*
   * 差集删除：服务器上存在、但本次清单里没有的文件 = 过期页面/旧 chunk。
   * 清单通过 heredoc 直接塞进 shell，不额外建连接、不落本地临时文件。
   * 宝塔自己的 .user.ini / .htaccess 与 ACME 的 .well-known 永远不参与比较。
   */
  const clean = [
    "set -e",
    `cd '${TARGET}'`,
    "cat > /tmp/dsh-want.txt <<'WANTEOF'",
    manifest,
    "WANTEOF",
    `find . -type f | sed 's|^\\./||' | grep -vE '^(\\.user\\.ini|\\.htaccess|\\.well-known/)' | LC_ALL=C sort > /tmp/dsh-have.txt`,
    "LC_ALL=C sort -o /tmp/dsh-want.txt /tmp/dsh-want.txt",
    "LC_ALL=C comm -13 /tmp/dsh-want.txt /tmp/dsh-have.txt > /tmp/dsh-del.txt || true",
    `n=$(wc -l < /tmp/dsh-del.txt | tr -d ' ')`,
    `if [ "$n" -gt 0 ]; then while IFS= read -r f; do rm -f -- "$f"; done < /tmp/dsh-del.txt; fi`,
    "find . -type d -empty -delete 2>/dev/null || true",
    "rm -f /tmp/dsh-want.txt /tmp/dsh-have.txt /tmp/dsh-del.txt",
    'echo "  ✓ 清理 $n 个过期文件"',
  ].join("\n");

  const r = spawnSync("ssh", [...ssh, `${USER}@${HOST}`, "bash -s"], {
    input: clean,
    stdio: ["pipe", "inherit", "inherit"],
  });
  if (r.status !== 0) {
    console.error(`✗ 服务端清理失败（exit ${r.status}）—— 文件已上传，页面可正常访问`);
    process.exitCode = 1;
  }
}

function main() {
  const missing = [
    ["DEPLOY_HOST", HOST],
    ["DEPLOY_USER", USER],
    ["DEPLOY_SSH_KEY", KEY],
    ["DEPLOY_PATH", TARGET],
  ]
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    fail(
      `缺少部署配置：${missing.join(", ")}\n  把它们写进 .env.local（该文件已被 .gitignore 忽略），字段说明见 .env.example`,
    );
  }

  if (!existsSync(KEY)) {
    fail(`找不到 SSH 私钥：${KEY}\n  检查 DEPLOY_SSH_KEY 是否指向正确的绝对路径`);
  }

  if (hasFlag("build")) {
    console.log("› 构建");
    run("pnpm", ["build"], "构建");
  }

  if (!hasFlag("mode=ssr") && !args.includes("--mode=ssr") && !existsSync(`${OUT}/index.html`)) {
    console.error(`✗ ${OUT}/index.html 不存在，先执行 pnpm build（或加 --build）`);
    process.exit(1);
  }

  const ssh = ["-i", KEY, "-p", PORT, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15"];

  /*
   * 传输方式：默认 tar 流。
   *
   * rsync 适合"只改几个文件"的日常增量，但每次重新构建后**所有页面都会变**
   * （分数、排序、相关推荐全是重新算的），差异算法一分钱都省不下来，
   * 反而要为 5000 个文件各来一次校验和往返 —— 高延迟链路下这就是几分钟。
   * 打成一个流推过去、在服务器上原地解压，只走一次握手、压缩一次，实测快一个数量级。
   *
   * 代价是丢掉了 rsync 的 --delete，所以额外做一次清单对比：把"本次应该存在
   * 的文件列表"传上去，服务器端算差集删掉多余文件（含旧的 _next chunk）。
   * `--mode=rsync` 保留旧路径，排障时可用。
   */
  const MODE =
    hasFlag("ssr") || args.includes("--mode=ssr")
      ? "ssr"
      : hasFlag("rsync") || args.includes("--mode=rsync")
        ? "rsync"
        : "tar";

  if (MODE === "ssr") {
    deploySsr(ssh);
  } else if (MODE === "rsync") {
    console.log(`› 同步（rsync）${OUT}/ → ${USER}@${HOST}:${TARGET}`);
    const rsyncArgs = [
      "-az",
      // 所有文件内容都变了，增量算法只带来往返开销，没有收益
      "--whole-file",
      "--inplace",
      "--compress-level=1",
      "--human-readable",
      "--stats",
      // 宝塔在站点根自己维护的文件，不能传也不能删：
      //   .user.ini / .htaccess 是 chattr +i 的，--delete 删它们必报 exit 23；
      //   .well-known/ 是 ACME 证书验证目录，被 --delete 清掉会导致证书续期失败。
      "--exclude=.user.ini",
      "--exclude=.htaccess",
      "--exclude=.well-known/",
      ...(hasFlag("no-delete") ? [] : ["--delete"]),
      ...(hasFlag("dry-run") ? ["--dry-run", "-v"] : []),
      "-e",
      `ssh ${ssh.join(" ")}`,
      `${OUT}/`,
      `${USER}@${HOST}:${TARGET}/`,
    ];
    run("rsync", rsyncArgs, "rsync 同步");
  } else {
    deployByTar(ssh);
  }

  if (hasFlag("dry-run")) {
    console.log("\n· --dry-run：以上为预览，未实际传输");
    return;
  }

  // SSR 模式不走下面的静态目录逻辑：文件不在 web root，归属由 pm2 的运行用户决定
  if (MODE === "ssr") {
    console.log(`› 校验线上页面：${SITE_URL}`);
    const check = spawnSync("curl", ["-sS", "-m", "20", "-o", "/dev/null", "-w", "%{http_code}", SITE_URL], {
      encoding: "utf8",
    });
    console.log(`  HTTP ${(check.stdout || "").trim() || "(无响应)"}`);
    return;
  }

  // 传输后归属修正为 www:www —— nginx 以 www 身份读文件，root 属主虽然可读，
  // 但宝塔面板的权限体检会报异常，顺手统一掉。
  // 注意：宝塔会在站点根放一个 chattr +i 的 .user.ini（属主 root、不可改），
  // 对整目录 -R chown 会在这里报 Operation not permitted 并让整个部署"失败"，
  // 所以用 find 跳过它，只改真正属于站点的文件。
  console.log("› 修正文件归属");
  run(
    "ssh",
    [
      ...ssh,
      `${USER}@${HOST}`,
      `find ${TARGET} -name .user.ini -prune -o -exec chown www:www {} + && echo "  ✓ www:www（已跳过宝塔的 .user.ini）"`,
    ],
    "远程 chown",
  );

  console.log(`› 校验线上页面：${SITE_URL}`);
  const check = spawnSync("curl", ["-sS", "-m", "20", "-o", "/dev/null", "-w", "%{http_code}", SITE_URL], {
    encoding: "utf8",
  });
  const code = (check.stdout || "").trim();
  if (code === "200") {
    console.log(`  ✓ HTTP ${code}`);
  } else {
    console.error(`  ! HTTP ${code || "(无响应)"} —— 文件已上传，但访问异常，请检查 nginx 配置与证书`);
    process.exitCode = 1;
  }

  // 每次上线都主动告诉搜索引擎"有新内容"。
  // 只走 IndexNow（免费无配额限制）；百度有每日配额，交给 pnpm ping 手动控制，
  // 避免一天多次部署把配额白白烧掉。
  if (!hasFlag("no-ping")) {
    console.log("› 通知搜索引擎（IndexNow）");
    const ping = spawnSync(process.execPath, [resolve("scripts/ping-search.mjs"), "--only", "indexnow"], {
      stdio: "inherit",
      env: { ...process.env, SITE_URL },
    });
    // 推送失败不影响发布结果：站点已经上线，索引只是加速手段
    if (ping.status !== 0) console.warn("  ! 推送未成功，可稍后执行 pnpm ping 重试");
  }
}

main();
