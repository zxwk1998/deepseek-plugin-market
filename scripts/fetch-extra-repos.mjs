#!/usr/bin/env node
/**
 * 补采：把 CC0 目录里"我们完全没采集到"的仓库补进数据集。
 *
 * 为什么需要这一步：
 *   我们原来按 topic 检索，只能找到主动打了 dsh 相关 tag 的仓库。
 *   对比 CC0 目录（8979 个仓库）发现有 7096 个我们从来没覆盖，其中
 *   1658 个 npm 月下载量 ≥1000 —— 也就是真实在被使用、但没打 tag 的项目。
 *   这不是"再抓一次"能解决的，是候选源本身不完整。
 *
 * 设计要点：
 *   1) **按下载量筛选**，不是全量补。7000 个全拉要跑两小时配额，且长尾大多是空壳。
 *   2) **逐仓库缓存**（data/.repo-cache.json），中断后可续跑，重跑零配额。
 *   3) 元数据与 README 都拉：没有 README 的仓库会被评分扣 30 分（实用度），
 *      和已有条目不可比，等于白补。
 *   4) 合并写回 raw-github.json，下游 build-data 不用改输入。
 *
 * 用法：
 *   node scripts/fetch-extra-repos.mjs                    # 默认补下载量 ≥1000 的
 *   node scripts/fetch-extra-repos.mjs --min-downloads 500
 *   node scripts/fetch-extra-repos.mjs --limit 500        # 本次最多补多少个
 *   node scripts/fetch-extra-repos.mjs --no-readme
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

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

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
const RAW = resolve(getArg("src", "data/raw-github.json"));
const CC0 = resolve(getArg("cc0", "data/cc0-index.json"));
const CACHE = resolve(getArg("cache", "data/.repo-cache.json"));
const MIN_DL = Number(getArg("min-downloads", "1000"));
const LIMIT = Number(getArg("limit", "2000"));
/* 串行跑 1600 个仓库要 80 分钟：单次 API 往返 ~0.7s。8 并发压到 10 分钟以内。 */
const CONCURRENCY = Math.max(1, Number(getArg("concurrency", TOKEN ? "8" : "2")));
const SKIP_README = hasFlag("no-readme");
const API = "https://api.github.com";

const HEADERS = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "deepseek-plugin-market-enricher/1.0",
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 令牌桶：与 collect-github 同一套逻辑。
 * 认证后 4750/小时；桶满了可以连续突发，不必每个请求硬等 —— 这是
 * "补 1600 个仓库" 能在几分钟内跑完、而不是被摊成半小时的关键。
 */
function createBucket(capacity, refillPerMs) {
  let tokens = capacity;
  let last = Date.now();
  let chain = Promise.resolve();
  return function acquire() {
    chain = chain.then(async () => {
      for (;;) {
        const now = Date.now();
        tokens = Math.min(capacity, tokens + (now - last) * refillPerMs);
        last = now;
        if (tokens >= 1) {
          tokens -= 1;
          return;
        }
        await sleep(Math.ceil((1 - tokens) / refillPerMs));
      }
    });
    return chain;
  };
}
const coreLimiter = createBucket(TOKEN ? 4750 : 55, (TOKEN ? 4750 : 55) / 3_600_000);

let requests = 0;

async function gh(path, accept = "application/vnd.github+json", attempt = 0) {
  await coreLimiter();
  requests++;
  const res = await fetch(`${API}${path}`, {
    headers: { ...HEADERS, accept },
    signal: AbortSignal.timeout(15_000),
  });

  if ((res.status === 403 || res.status === 429) && attempt < 3) {
    const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    const waitMs = Math.min(Math.max(reset - Date.now(), 2000), 120_000);
    console.warn(`  ! 触发限流，等待 ${(waitMs / 1000).toFixed(0)}s`);
    await sleep(waitMs);
    return gh(path, accept, attempt + 1);
  }
  return res;
}

function normalize(r) {
  const owner = r.owner?.login ?? r.full_name.split("/")[0];
  return {
    fullName: r.full_name,
    name: r.name,
    owner,
    description: r.description ?? "",
    topics: r.topics ?? [],
    language: r.language ?? null,
    license:
      r.license?.spdx_id && r.license.spdx_id !== "NOASSERTION" ? r.license.spdx_id : null,
    stars: r.stargazers_count ?? 0,
    forks: r.forks_count ?? 0,
    issues: r.open_issues_count ?? 0,
    homepage: r.homepage || null,
    archived: Boolean(r.archived),
    pushedAt: r.pushed_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    defaultBranch: r.default_branch ?? "main",
    readme: null,
  };
}

/** README 走 API：本机到 raw.githubusercontent.com 不可达，CDN 那条路是死的 */
async function fetchReadme(fullName) {
  const res = await gh(`/repos/${fullName}/readme`, "application/vnd.github.raw+json");
  if (!res.ok) return null;
  const text = await res.text();
  return text.trim().length >= 20 ? text.slice(0, 20_000) : null;
}

function loadJson(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

async function main() {
  if (!TOKEN) {
    console.error("✗ 需要 GITHUB_TOKEN（未认证核心配额只有 60 次/小时，补采无法进行）");
    process.exit(1);
  }
  if (!existsSync(RAW)) {
    console.error(`✗ 找不到 ${RAW}，先跑 pnpm sync`);
    process.exit(1);
  }
  if (!existsSync(CC0)) {
    console.error(`✗ 找不到 ${CC0}，先跑 pnpm cc0`);
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(RAW, "utf8"));
  const cc0 = JSON.parse(readFileSync(CC0, "utf8"));
  const have = new Set(raw.repos.map((r) => String(r.fullName).toLowerCase()));

  // 候选：未采集过、且有真实下载量的仓库，按下载量从高到低
  const candidates = Object.entries(cc0.repos)
    .filter(([full, v]) => !have.has(full) && (v.downloads ?? 0) >= MIN_DL)
    .sort((a, b) => (b[1].downloads ?? 0) - (a[1].downloads ?? 0))
    .slice(0, LIMIT);

  console.log(
    `· 待补采 ${candidates.length} 个仓库（未覆盖且有下载量 ≥${MIN_DL}，本次上限 ${LIMIT}）`,
  );
  if (candidates.length === 0) return console.log("· 没有需要补采的仓库");

  const cache = loadJson(CACHE, { entries: {} });
  const started = Date.now();
  let fetched = 0;
  let cached = 0;
  let failed = 0;
  const added = [];

  /*
   * 固定并发的工作池：单线程事件循环里 `idx++` 不会冲突。
   * 每个 worker 拉一个仓库（元数据 + README），共享同一个令牌桶限速器，
   * 所以并发再高也不会突破配额 —— 桶里没票就一起排队。
   */
  let idx = 0;
  /* 并发下 done 会跳号，不能用 %100==0 判断落盘，否则可能一直不写（8 并发很容易跳过整百） */
  let lastFlush = 0;
  mkdirSync(dirname(CACHE), { recursive: true });
  const flush = (force = false) => {
    const done = fetched + cached + failed;
    if (!force && done - lastFlush < 100) return;
    lastFlush = done;
    console.log(`  进度 ${done}/${candidates.length}（新请求 ${fetched}，缓存 ${cached}，失败 ${failed}）`);
    writeFileSync(CACHE, JSON.stringify(cache));
  };
  const worker = async () => {
    for (;;) {
      const i = idx++;
      if (i >= candidates.length) return;
      const [full] = candidates[i];
      const hit = cache.entries[full];
      let repo = hit?.repo;

      if (!repo) {
        const res = await gh(`/repos/${full}`);
        if (!res.ok) {
          failed++;
          // 404（改名/删除/私有）也记缓存，避免下次重复请求
          cache.entries[full] = { at: new Date().toISOString(), repo: null };
          flush();
          continue;
        }
        repo = normalize(await res.json());
        fetched++;
      } else {
        cached++;
      }

      if (!SKIP_README && repo.readme == null) {
        const text = await fetchReadme(full);
        if (text) repo.readme = text;
      }

      cache.entries[full] = { at: new Date().toISOString(), repo };
      added.push(repo);
      flush();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker));

  writeFileSync(CACHE, JSON.stringify(cache));

  // 合并写回 raw：只追加真正拿到的仓库，保持原有条目不动
  const existing = new Set(raw.repos.map((r) => String(r.fullName).toLowerCase()));
  const appended = added.filter((r) => !existing.has(String(r.fullName).toLowerCase()));
  raw.repos = [...raw.repos, ...appended];
  raw.collectedAt = new Date().toISOString();
  raw.extraRepos = {
    addedAt: new Date().toISOString(),
    source: "awesome-dsh-plugin (CC0)",
    minDownloads: MIN_DL,
    count: appended.length,
  };
  writeFileSync(RAW, JSON.stringify(raw));

  const mins = ((Date.now() - started) / 60_000).toFixed(1);
  console.log(
    `✓ 补采完成：新增 ${appended.length} 个仓库（请求 ${requests} 次，失败 ${failed}），` +
      `数据集 ${raw.repos.length} 条，用时 ${mins} 分钟`,
  );
}

main().catch((err) => {
  console.error(`✗ 补采失败：${err.message}`);
  process.exit(1);
});
