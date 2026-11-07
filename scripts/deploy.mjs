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
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

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
const OUT = resolve("out");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function run(cmd, cmdArgs, label) {
  const r = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`✗ ${label} 失败（exit ${r.status}）`);
    process.exit(1);
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

  if (!existsSync(`${OUT}/index.html`)) {
    console.error(`✗ ${OUT}/index.html 不存在，先执行 pnpm build（或加 --build）`);
    process.exit(1);
  }

  const ssh = ["-i", KEY, "-p", PORT, "-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15"];

  console.log(`› 同步 ${OUT}/ → ${USER}@${HOST}:${TARGET}`);
  const rsyncArgs = [
    "-az",
    /*
     * --whole-file：跳过 rsync 的差异算法。
     * 每个页面 HTML 都是重新渲染的（分数/排序/相关推荐全会变），几乎 100% 内容不同，
     * 走增量时每个文件都要来回一次校验和 —— 5000 个文件 × RTT 就是好几分钟，
     * 而实际能省下的字节几乎为 0。整文件直传反而更快。
     * --inplace：服务端原地写，省掉每个文件建临时文件 + rename 的开销。
     * --compress-level=1：HTML 压缩比本身就高，level 1 与 9 体积差 3%，CPU 差 5 倍。
     */
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

  if (hasFlag("dry-run")) {
    console.log("\n· --dry-run：以上为预览，未实际传输");
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
