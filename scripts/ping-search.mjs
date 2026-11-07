#!/usr/bin/env node
/**
 * 主动推送：把 URL 立刻告知搜索引擎，而不是等它自己爬到。
 *
 * 为什么必须有这一步：
 *   robots.txt + sitemap.xml 只是"允许并告诉"，属于被动等待。
 *   新站点/新页面对百度可能是几周量级，必应稍快但也不保证。
 *   主动推送能把"发现"环节从周级压到小时级。
 *
 * 两类通道：
 *   1) IndexNow（必应 / Yandex / Naver 等）—— 免费、无需账号，
 *      但要求站点根目录放一个以 key 命名的文本文件做归属验证。
 *      本仓库的 key 文件在 public/<key>.txt，随站点一起发布。
 *   2) 百度搜索资源平台的主动推送 API —— 需要你在
 *      https://ziyuan.baidu.com 验证站点后拿到 token，
 *      写入 .env.local 的 BAIDU_PUSH_TOKEN=<token>。
 *
 * 用法：
 *   node scripts/ping-search.mjs                # 推必应(IndexNow) + 百度(有 token 时)
 *   node scripts/ping-search.mjs --only indexnow
 *   node scripts/ping-search.mjs --site https://deepseek.vuejs-core.cn
 *   node scripts/ping-search.mjs --urls /plugin/xxx/,/plugins/
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SITE = (getArg("site", process.env.SITE_URL || "https://deepseek.vuejs-core.cn")).replace(/\/$/, "");
const HOST = new URL(SITE).host;
const ONLY = getArg("only", "");
const BATCH = 10_000;

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

/** 从 public/ 里找出 32 位十六进制的 IndexNow key 文件 */
function findIndexNowKey() {
  const dir = resolve("public");
  if (!existsSync(dir)) return "";
  for (const f of readdirSync(dir)) {
    const m = f.match(/^([0-9a-f]{32})\.txt$/i);
    if (m) return m[1];
  }
  return "";
}

function collectUrls() {
  const custom = getArg("urls", "");
  if (custom) {
    return custom
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => (p.startsWith("http") ? p : `${SITE}${p.startsWith("/") ? p : `/${p}`}`));
  }
  const sm = resolve("out/sitemap.xml");
  if (!existsSync(sm)) {
    console.error("✗ 找不到 out/sitemap.xml，先构建或改用 --urls");
    process.exit(1);
  }
  return [...readFileSync(sm, "utf8").matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1].trim());
}

async function pushIndexNow(urls) {
  const key = findIndexNowKey();
  if (!key) {
    console.warn("! 未找到 IndexNow key 文件（public/<32位hex>.txt），跳过必应推送");
    return false;
  }
  const keyLocation = `${SITE}/${key}.txt`;

  // 先确认 key 文件在线上真的可访问 —— IndexNow 校验失败时只会含糊报错
  try {
    const probe = await fetch(keyLocation, { signal: AbortSignal.timeout(15_000) });
    const body = (await probe.text()).trim();
    if (!probe.ok || body !== key) {
      console.warn(`! key 文件校验失败（HTTP ${probe.status}），先确认 ${keyLocation} 已部署`);
      return false;
    }
  } catch (err) {
    console.warn(`! 无法访问 key 文件：${err.message}`);
    return false;
  }

  let ok = 0;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host: HOST, key, keyLocation, urlList: batch }),
      signal: AbortSignal.timeout(30_000),
    });
    // IndexNow 正常返回 200/202；部分提交成功也可能是 202
    if (res.ok || res.status === 202) {
      ok += batch.length;
      console.log(`  ✓ IndexNow 提交 ${batch.length} 条（HTTP ${res.status}）`);
    } else {
      console.warn(`  ! IndexNow 提交失败 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
    }
  }
  return ok;
}

async function pushBaidu(urls) {
  const token = process.env.BAIDU_PUSH_TOKEN || "";
  if (!token) {
    console.warn("! 未配置 BAIDU_PUSH_TOKEN，跳过百度推送（见 .env.example 说明）");
    return false;
  }
  // 百度单次最多 2000 条，每日配额有限
  let ok = 0;
  for (let i = 0; i < urls.length; i += 2000) {
    const batch = urls.slice(i, i + 2000);
    const res = await fetch(
      `http://data.zz.baidu.com/urls?site=${encodeURIComponent(SITE)}&token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: batch.join("\n"),
        signal: AbortSignal.timeout(30_000),
      },
    );
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      if (json.success) {
        ok += json.success;
        console.log(`  ✓ 百度推送成功 ${json.success} 条，今日剩余配额 ${json.remain ?? "未知"}`);
      } else {
        console.warn(`  ! 百度推送未成功：${text.slice(0, 200)}`);
      }
    } catch {
      console.warn(`  ! 百度返回非 JSON：${text.slice(0, 200)}`);
    }
  }
  return ok;
}

async function main() {
  const urls = collectUrls();
  console.log(`· 待推送 ${urls.length} 条 URL → ${SITE}`);

  let total = 0;
  if (ONLY !== "baidu") {
    console.log("› IndexNow（必应 / Yandex 等）");
    total += (await pushIndexNow(urls)) || 0;
  }
  if (ONLY !== "indexnow") {
    console.log("› 百度主动推送");
    total += (await pushBaidu(urls)) || 0;
  }

  console.log(total > 0 ? `\n✓ 共推送 ${total} 条` : "\n· 没有推送成功的通道，检查上面的提示");
}

main().catch((err) => {
  console.error(`✗ 推送失败：${err.message}`);
  process.exit(1);
});
