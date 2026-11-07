#!/usr/bin/env node
/**
 * 抓取 awesome-dsh-plugin 的 CC0 目录，压成一张按仓库索引的"富化表"。
 *
 * 为什么要单独一个脚本，而不是在 build-data 里顺手 fetch：
 *   build-data 必须是"离线可重现"的 —— 同一份输入永远产出同一份输出。
 *   一旦它在构建时联网，某天源站挂了就会静默产出缺字段的站点。
 *   所以网络动作留在这一步，build-data 只读本地索引，缺了就降级。
 *
 * 为什么可以合法使用：
 *   awesome-dsh-plugin/awesome-dsh-plugin 是 **CC0-1.0（公有领域）**，
 *   23k star，明确放弃著作权。中文简介、能力标注、npm 包名、下载量都可复用。
 *   但站点的评分与排序仍然只由我们自采的 GitHub 数据决定 —— 富化层不参与打分。
 *
 * 实体粒度：
 *   该目录是**包级**的，一个仓库可能有多个包，标识形如
 *     zhu1090093659/dsh-web#packages/dsh-task-board
 *   井号前是仓库，后面是包目录。本脚本同时产出：
 *     - 按仓库的主条目（下载量最大的那个包），供当前"仓库即插件"的模型使用；
 *     - 该仓库下的全部包，供后续切换到包级实体时直接用。
 *
 * 用法：
 *   node scripts/fetch-cc0.mjs               # 有缓存且未过期就复用
 *   node scripts/fetch-cc0.mjs --refresh     # 强制重抓
 *   node scripts/fetch-cc0.mjs --ttl 24      # 缓存有效期（小时）
 */
import { writeFileSync, readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const SOURCE = getArg("url", "https://awesome-dsh-plugin.com/plugins.json");
const RAW = resolve(getArg("cache", "data/.cc0-catalog.json"));
const OUT = resolve(getArg("out", "data/cc0-index.json"));
const TTL_MS = Number(getArg("ttl", "12")) * 3_600_000;
/** 低于这个条数就当抓取失败（目录正常在 9000+），避免把残缺数据写进索引 */
const MIN_COUNT = Number(getArg("min-count", "1000"));

/** `owner/repo#packages/x` → `owner/repo` */
function repoOf(id) {
  return String(id || "").split("#")[0].toLowerCase();
}

/**
 * 取子包目录。
 * 注意：井号出现在 **name** 字段（`dsh-gungnir#dsh-plugin`），不在 url 里 ——
 * url 是 `https://github.com/o/r/tree/main/packages/dsh-plugin` 这种形态。
 * 早期按 url 解析会全部返回空串，导致 monorepo 识别失效。
 */
function dirOf(name) {
  const idx = String(name || "").indexOf("#");
  return idx >= 0 ? String(name).slice(idx + 1) : "";
}

async function download() {
  console.log(`· 拉取 CC0 目录 ${SOURCE}`);
  const res = await fetch(SOURCE, {
    headers: { "user-agent": "deepseek-plugin-market-enricher/1.0" },
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : (data.plugins ?? []);
  if (!Array.isArray(list)) throw new Error("响应缺少 plugins 数组");
  if (list.length < MIN_COUNT) throw new Error(`条目数 ${list.length} 低于安全下限 ${MIN_COUNT}`);
  mkdirSync(resolve(RAW, ".."), { recursive: true });
  writeFileSync(RAW, text);
  return data;
}

function buildIndex(data) {
  const list = Array.isArray(data) ? data : (data.plugins ?? []);
  const categories = (Array.isArray(data) ? {} : data.categories) ?? {};
  const byRepo = new Map();

  for (const p of list) {
    const full = `${p.owner}/${p.name}`;
    const repo = repoOf(full);
    if (!repo.includes("/")) continue;

    const entry = {
      name: p.name,
      npm: p.npm || null,
      version: p.version || null,
      downloads: p.downloads ?? 0,
      downloadsStart: p.downloadsStart || null,
      downloadsEnd: p.downloadsEnd || null,
      install: p.install || null,
      category: p.category || null,
      zh: p.description?.zh || null,
      en: p.description?.en || null,
      cap: Array.isArray(p.capabilities) ? p.capabilities : [],
      red: Array.isArray(p.capabilityRedLines) ? p.capabilityRedLines : [],
      icon: p.icon || null,
      page: p.page || null,
      dir: dirOf(p.name),
      // 上游 id：monorepo 子包带 `#目录`，用于区分同仓库下的多个包
      id: full,
    };

    const cur = byRepo.get(repo);
    if (!cur) {
      byRepo.set(repo, { primary: entry, packages: [entry] });
      continue;
    }
    cur.packages.push(entry);
    // 主条目优先取"无子目录"的那个，否则取下载量最大的
    const better =
      entry.downloads > (cur.primary.downloads ?? 0) &&
      (cur.primary.dir !== "" || entry.dir === "");
    if (better) cur.primary = entry;
  }

  const repos = {};
  let multi = 0;
  for (const [repo, { primary, packages }] of byRepo) {
    if (packages.length > 1) multi++;
    repos[repo] = {
      ...primary,
      packageCount: packages.length,
      packages: packages
        .sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0))
        .map((x) => ({
          name: x.name,
          dir: x.dir,
          npm: x.npm,
          version: x.version,
          downloads: x.downloads,
          install: x.install,
          zh: x.zh,
        })),
    };
  }

  return {
    source: SOURCE,
    capturedAt: new Date().toISOString(),
    total: list.length,
    repoCount: byRepo.size,
    monorepoCount: multi,
    categories,
    repos,
  };
}

async function main() {
  const fresh = !hasFlag("refresh") && existsSync(RAW) && Date.now() - statSync(RAW).mtimeMs < TTL_MS;

  let data;
  if (fresh) {
    const ageH = ((Date.now() - statSync(RAW).mtimeMs) / 3_600_000).toFixed(1);
    console.log(`· 复用本地缓存（${ageH} 小时前）`);
    data = JSON.parse(readFileSync(RAW, "utf8"));
  } else {
    try {
      data = await download();
    } catch (err) {
      // 富化层不是站点存活的必要条件：抓不到就用旧缓存，连缓存都没有就跳过
      if (existsSync(RAW)) {
        console.warn(`! 抓取失败（${err.message}），回退到本地旧缓存`);
        data = JSON.parse(readFileSync(RAW, "utf8"));
      } else {
        console.warn(`! 抓取失败（${err.message}），且无本地缓存 —— 本次跳过富化，站点按原样构建`);
        process.exit(0);
      }
    }
  }

  const index = buildIndex(data);
  mkdirSync(resolve(OUT, ".."), { recursive: true });
  writeFileSync(OUT, JSON.stringify(index));

  const mb = (Buffer.byteLength(JSON.stringify(index)) / 1048576).toFixed(1);
  console.log(
    `✓ ${OUT}  ${index.repoCount} 个仓库 / ${index.total} 个包（含 ${index.monorepoCount} 个多包仓库）/ ${mb}MB`,
  );
}

main().catch((err) => {
  console.error(`✗ 富化索引生成失败：${err.message}`);
  process.exit(1);
});
