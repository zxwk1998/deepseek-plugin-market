#!/usr/bin/env node
/**
 * 从 GitHub 源头采集 DSH 生态仓库（不依赖任何第三方聚合快照）。
 *
 * 三个必须自己解决的技术问题：
 *
 * 1) **Search API 单查询最多返回 1000 条**
 *    → 按 star 区间分段查询（>=100 / 31-99 / 11-30 / 3-10 / 1-2 / 0），
 *      每段单独翻页，段内结果数天然低于上限。
 *
 * 2) **topic 检索有噪声**（`topic:dsh-plugin` 会带出大量泛 AI 项目）
 *    → 采集后做相关性闸门：仓库必须至少命中一条强信号
 *      （topic 以 dsh/cordis 开头、名称或描述含 dsh、描述含 deepseek harness）。
 *      宁可少收，也不要把无关的大项目混进目录 —— 那是"看起来很多但没用"。
 *
 * 3) **README 抓取是整个流程的真实瓶颈**
 *    → CDN（raw.githubusercontent.com / jsdelivr）在国内网络常常直接超时，
 *      而 jsdelivr 还会 301 跳回 raw，等于两条路一起断。
 *      所以启动时先探一次 CDN，不通就彻底不碰它 —— 否则每个仓库都要
 *      白等 8s 超时才降级，600 个仓库光超时就是 20 分钟以上。
 *      另配 README 本地缓存（按 pushed_at 判定失效），重跑只补新变更的仓库。
 *
 * 凭据来源（优先级从高到低）：环境变量 GITHUB_TOKEN / GH_TOKEN → `.env.local`
 * → `.env` → `gh auth token`（已登录 gh 时自动可用，零配置）。
 *
 * 用法：
 *   GITHUB_TOKEN=xxx node scripts/collect-github.mjs
 *   node scripts/collect-github.mjs --top 400 --out data/raw-github.json
 *   node scripts/collect-github.mjs --no-readme        # 跳过 README
 *   node scripts/collect-github.mjs --refresh          # 忽略搜索缓存重采
 *   node scripts/collect-github.mjs --concurrency 6
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

/**
 * 从 .env.local / .env 读取凭据（零依赖实现）。
 * 顺序：进程环境变量优先，其次文件 —— 这样 CI 的 secrets 不会被本地文件覆盖。
 * 必须在读取 TOKEN 之前执行。
 */
function loadEnvFiles(files = [".env.local", ".env"]) {
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      const value = rawValue.replace(/^["']|["']$/g, "");
      if (value && !process.env[key]) process.env[key] = value;
    }
  }
}
loadEnvFiles();

/**
 * 兜底：已登录 `gh` 的机器上直接复用它的 token。
 * 这样本地只要 `gh auth login` 一次，后面所有采集都自动带认证配额，
 * 不用再手动复制粘贴一个 PAT。
 */
function readGhCliToken() {
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 4000,
    }).trim();
  } catch {
    return "";
  }
}

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGhCliToken();

const OUT = resolve(getArg("out", "data/raw-github.json"));
/** 搜索结果缓存：重跑（补 README / 重算评分）时不必再花一遍搜索配额 */
const CACHE = resolve(getArg("cache", "data/.search-cache.json"));
const CACHE_MAX_AGE_MS = 6 * 3_600_000;
/** README 缓存：按 pushed_at 失效，重跑只补真正有变更的仓库 */
const README_CACHE = resolve(getArg("readme-cache", "data/.readme-cache.json"));
/**
 * README 抓取上限。
 * 为什么要抓全量而不是只抓前几百：评分里「实用度/信号质量」都依赖 README，
 * 没抓到 README 的仓库会被扣 30 分，和抓到了的仓库不可比 —— 目录里就会出现
 * "明明是好项目却排得很低"的假象。认证后核心配额 5000 次/小时，
 * 2000 多个仓库足够覆盖，没理由为了省几分钟牺牲评分公平性。
 */
const README_TOP = Number(getArg("readme-top", getArg("top", TOKEN ? "2500" : "600")));
const SKIP_README = hasFlag("no-readme");
const SKIP_ZERO = hasFlag("skip-zero");
const MAX_PAGES = Number(getArg("max-pages", "5"));
const TOPIC_OVERRIDE = getArg("topics", "")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
/** 认证后配额充裕，可以多开几个并发；未认证保持保守 */
const CONCURRENCY = Math.max(1, Number(getArg("concurrency", TOKEN ? "6" : "3")));
const API = "https://api.github.com";

/** 生态 topic：不同项目的打标习惯不同，取并集再过滤（可用 --topics 覆盖） */
const DEFAULT_TOPICS = [
  "dsh-plugin",
  "deepseek-harness",
  "cordis-plugin",
  "dsh",
  "dsh-skills",
  "agent-skills",
];

/** star 分段：绕开单查询 1000 条上限 */
const TOPICS = TOPIC_OVERRIDE.length ? TOPIC_OVERRIDE : DEFAULT_TOPICS;

const STAR_BUCKETS = [">=100", "31..99", "11..30", "3..10", "1..2", "0"];

const HEADERS = {
  accept: "application/vnd.github+json",
  "x-github-api-version": "2022-11-28",
  "user-agent": "deepseek-plugin-market-collector/1.0",
  ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let requestCount = 0;

/**
 * 配额闸门：令牌桶（允许突发 + 长期限速）。
 *
 * 为什么不是"窗口内最多 N 次"的滑动窗口：滑动窗口会把 600 个 README
 * 强行摊到 4500/小时 ≈ 0.8s/个，明明 5000 的额度只用 600 也要跑 8 分钟。
 * GitHub 的配额是"每小时 5000 次"而不是"每次间隔均匀"，突发 600 次完全合法。
 * 令牌桶刚好对上这个语义：桶满时直接放行，消耗完才按补充速率排队。
 * 串行取票（chain）保证并发下不会超额。
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

/** 搜索接口：未认证 10 次/分，认证 30 次/分 */
const searchLimiter = createBucket(TOKEN ? 30 : 10, (TOKEN ? 30 : 10) / 60_000);
/** 核心接口：未认证 60 次/时，认证 5000 次/时（桶留 5% 余量给重试） */
const coreLimiter = createBucket(
  TOKEN ? 4750 : 57,
  (TOKEN ? 4750 : 57) / 3_600_000,
);

/** 搜索请求：限速排队 + 撞限退避重试 */
async function gh(path, attempt = 0) {
  await searchLimiter();
  requestCount++;
  const res = await fetch(`${API}${path}`, { headers: HEADERS });

  if (res.status === 403 || res.status === 429) {
    const retryAfter = Number(res.headers.get("retry-after") ?? 0) * 1000;
    const reset = Number(res.headers.get("x-ratelimit-reset") ?? 0) * 1000;
    const waitMs = Math.min(Math.max(retryAfter || reset - Date.now(), 2000), 120_000);
    if (attempt < 3) {
      console.warn(`  ! 触发限流，等待 ${(waitMs / 1000).toFixed(0)}s 后重试`);
      await sleep(waitMs);
      return gh(path, attempt + 1);
    }
    throw new Error(`GitHub API 限流未恢复：${path}`);
  }
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}：${path}`);

  return res.json();
}

/** 相关性闸门：任一强信号即通过 */
function isRelevant(repo) {
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  const name = repo.name.toLowerCase();
  const desc = (repo.description ?? "").toLowerCase();

  if (topics.some((t) => /^(dsh|cordis)(-|$)/.test(t) || t === "deepseek-harness")) return true;
  if (/(^|[-_.])dsh([-_.]|$)/.test(name)) return true;
  if (/\bdsh\b|deepseek[\s-]?harness/.test(desc)) return true;
  return false;
}

function starBucketFilter(bucket) {
  return bucket === "0" ? "stars:0" : `stars:${bucket}`;
}

async function collect() {
  const seen = new Map();
  let rawCount = 0;

  for (const topic of TOPICS) {
    for (const bucket of STAR_BUCKETS) {
      // 0 星仓库里绝大多数是刚建的空壳，噪声最高，可用 --skip-zero 跳过
      if (SKIP_ZERO && bucket === "0") continue;
      const q = encodeURIComponent(`topic:${topic} ${starBucketFilter(bucket)}`);
      let page = 1;
      let total = null;

      while (page <= MAX_PAGES) {
        const data = await gh(
          `/search/repositories?q=${q}&sort=updated&order=desc&per_page=100&page=${page}`,
        );
        total ??= data.total_count;
        const items = data.items ?? [];
        if (items.length === 0) break;

        for (const r of items) {
          rawCount++;
          if (seen.has(r.full_name)) continue;
          seen.set(r.full_name, r);
        }

        if (items.length < 100) break;
        page++;
      }

      if (total !== null) {
        process.stdout.write(`  ${topic} ${bucket}: ${total} 命中\n`);
      }
    }
  }

  const all = [...seen.values()];
  const relevant = all.filter(isRelevant);

  console.log(
    `· 原始去重 ${rawCount} → ${all.length} 个仓库，相关性过滤后 ${relevant.length} 个` +
      `（剔除 ${all.length - relevant.length}）`,
  );
  return relevant;
}

/**
 * README 抓取策略：先探一次 CDN，再决定走哪条路。
 *
 * 现实情况（本机实测）：raw.githubusercontent.com 直接超时，
 * cdn.jsdelivr.net 返回 301 跳回 raw —— 两条"免费"通道全断，
 * 只剩 api.github.com 可用，而它是**要配额的**。
 *
 * 所以：
 *   1) 启动探针（3.5s）不通就彻底关掉 CDN，避免每个仓库白等 8s；
 *      600 个仓库 × 8s ÷ 并发 3 ≈ 26 分钟的纯浪费。
 *   2) README 结果本地缓存，按 pushed_at 判定失效 —— 重跑只补有提交的仓库。
 *   3) 核心接口走滑动窗口限速，认证后 4500 次/时可覆盖全量；
 *      未认证只有 60 次/时，所以硬性截断到一小时能承受的量并明确告警。
 */
let cdnMode = null;

async function cdnReachable() {
  if (cdnMode !== null) return cdnMode;
  if (hasFlag("no-cdn")) return (cdnMode = false);
  if (hasFlag("cdn")) return (cdnMode = true);
  const probe = "https://raw.githubusercontent.com/github/gitignore/main/Node.gitignore";
  try {
    const res = await fetch(probe, {
      headers: { "user-agent": HEADERS["user-agent"] },
      signal: AbortSignal.timeout(3500),
    });
    cdnMode = res.ok;
  } catch {
    cdnMode = false;
  }
  return cdnMode;
}

const readmeCache = {};

function loadReadmeCache() {
  if (!existsSync(README_CACHE)) return;
  try {
    const parsed = JSON.parse(readFileSync(README_CACHE, "utf8"));
    Object.assign(readmeCache, parsed.entries ?? {});
    console.log(`· README 缓存载入：${Object.keys(readmeCache).length} 条`);
  } catch {
    console.warn("! README 缓存损坏，忽略并重建");
  }
}

function saveReadmeCache() {
  mkdirSync(resolve(README_CACHE, ".."), { recursive: true });
  writeFileSync(
    README_CACHE,
    JSON.stringify({ savedAt: new Date().toISOString(), entries: readmeCache }),
  );
}

async function fetchReadmeViaCdn(repo) {
  const branch = repo.default_branch || "HEAD";
  for (const file of ["README.md", "readme.md", "README.MD", "README.rst", "README"]) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${repo.full_name}/${branch}/${file}`,
        { headers: { "user-agent": HEADERS["user-agent"] }, signal: AbortSignal.timeout(8000) },
      );
      if (!res.ok) continue;
      const text = await res.text();
      if (text.trim().length >= 20) return text.slice(0, 20_000);
    } catch {
      // 探针说通、这里却超时：小概率抖动，直接降级，不再逐个文件名重试
      return null;
    }
  }
  return null;
}

async function fetchReadmeViaApi(repo) {
  await coreLimiter();
  try {
    const res = await fetch(`${API}/repos/${repo.full_name}/readme`, {
      headers: { ...HEADERS, accept: "application/vnd.github.raw+json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.trim().length >= 20 ? text.slice(0, 20_000) : null;
  } catch {
    return null;
  }
}

async function fetchReadme(repo, useCdn) {
  if (!useCdn) return fetchReadmeViaApi(repo);
  return (await fetchReadmeViaCdn(repo)) ?? (await fetchReadmeViaApi(repo));
}

async function enrichReadmes(repos) {
  const target = repos.slice(0, README_TOP);
  const useCdn = await cdnReachable();
  console.log(
    useCdn
      ? "· README 通道：raw CDN 优先（不计 API 配额）"
      : "· README 通道：仅 API（CDN 不可达已跳过；这部分消耗核心配额）",
  );

  // 未认证核心配额 60 次/时，抓 600 个要 10 小时 —— 不如明确截断，别假装能跑完
  const budget = TOKEN
    ? target.length
    : Math.min(target.length, Number(getArg("readme-budget", "40")));
  if (!TOKEN) {
    console.warn(
      `! 未认证：核心配额仅 60 次/小时，本次 README 只抓前 ${budget} 个（其余靠仓库元数据评分）\n` +
        "! 配上 GITHUB_TOKEN（见 .env.example）后配额升到 5000 次/小时，可全量抓取",
    );
  }

  // 先把缓存命中铺到所有仓库（不占预算），再算真正要抓的
  for (const r of target) {
    const hit = readmeCache[r.full_name];
    if (hit && hit.pushedAt === r.pushed_at) r.readme = hit.readme ?? null;
  }
  const cachedHits = target.filter((r) => r.readme).length;

  const stale = target.slice(0, budget).filter((r) => {
    const hit = readmeCache[r.full_name];
    return !(hit && hit.pushedAt === r.pushed_at);
  });

  console.log(`· README 计划 ${budget} 个：缓存命中 ${cachedHits}，本次需抓 ${stale.length}`);

  let done = 0;
  let ok = 0;
  const queue = [...stale];
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (queue.length) {
      const repo = queue.shift();
      if (!repo) break;
      const text = await fetchReadme(repo, useCdn);
      if (text) {
        repo.readme = text;
        ok++;
      }
      // null 也写进缓存：避免下一轮对一个确实没有 README 的仓库反复重试
      readmeCache[repo.full_name] = { pushedAt: repo.pushed_at, readme: text };
      done++;
      if (done % 25 === 0) {
        process.stdout.write(`  README ${done}/${stale.length}（新命中 ${ok}）\n`);
        saveReadmeCache();
      }
    }
  });
  await Promise.all(workers);
  saveReadmeCache();
  console.log(`· README 完成：新增命中 ${ok}/${stale.length}，累计可用 ${cachedHits + ok}`);
}

function normalize(repo) {
  return {
    fullName: repo.full_name,
    name: repo.name,
    owner: repo.owner?.login ?? repo.full_name.split("/")[0],
    description: repo.description ?? "",
    topics: repo.topics ?? [],
    language: repo.language ?? null,
    license: repo.license?.spdx_id && repo.license.spdx_id !== "NOASSERTION" ? repo.license.spdx_id : null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    issues: repo.open_issues_count ?? 0,
    homepage: repo.homepage || null,
    archived: Boolean(repo.archived),
    pushedAt: repo.pushed_at,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    defaultBranch: repo.default_branch ?? "main",
    readme: repo.readme ?? null,
  };
}

async function main() {
  if (!TOKEN) {
    console.warn(
      "! 未找到 GitHub 凭据：搜索限 10 次/分、核心 60 次/时，全量采集会明显变慢\n" +
        "! 解决：在 .env.local 写入 GITHUB_TOKEN=... （见 .env.example），或执行 gh auth login",
    );
  } else {
    console.log(`· 已认证（token 尾号 ${TOKEN.slice(-4)}）：搜索 30 次/分、核心 5000 次/时`);
  }
  const started = Date.now();

  let repos;
  const cacheFresh =
    !hasFlag("refresh") && existsSync(CACHE) && Date.now() - statSync(CACHE).mtimeMs < CACHE_MAX_AGE_MS;

  if (cacheFresh) {
    const cached = JSON.parse(readFileSync(CACHE, "utf8"));
    repos = cached.repos ?? [];
    console.log(
      `· 复用搜索结果缓存（${repos.length} 个仓库，${((Date.now() - statSync(CACHE).mtimeMs) / 60000).toFixed(0)} 分钟前；--refresh 可强制重采）`,
    );
  } else {
    console.log("· 开始采集 GitHub 仓库");
    repos = await collect();
    mkdirSync(resolve(CACHE, ".."), { recursive: true });
    writeFileSync(CACHE, JSON.stringify({ cachedAt: new Date().toISOString(), repos }));
  }

  // 先按热度粗排，再取 README —— README 是评分里"实用度/信号质量"的依据
  repos.sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0));
  if (!SKIP_README) {
    loadReadmeCache();
    await enrichReadmes(repos);
  }

  const payload = {
    schemaVersion: 1,
    source: "github-api",
    collectedAt: new Date().toISOString(),
    topics: TOPICS,
    starBuckets: STAR_BUCKETS,
    requests: requestCount,
    repos: repos.map(normalize),
  };

  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload));
  const mb = (JSON.stringify(payload).length / 1048576).toFixed(1);

  console.log(
    `✓ ${OUT}  ${payload.repos.length} 条 / ${mb}MB  请求 ${requestCount} 次  用时 ${(
      (Date.now() - started) / 1000
    ).toFixed(0)}s`,
  );
}

main().catch((err) => {
  console.error(`✗ 采集失败：${err.message}`);
  process.exit(1);
});
