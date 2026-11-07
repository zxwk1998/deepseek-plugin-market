#!/usr/bin/env node
/**
 * 每日数据同步（主路径：直接采 GitHub）。
 *
 * 流程：采集 → 校验 → 规范化 → 重建检索索引
 *
 * 为什么每一步都要拦住：
 *   上游（GitHub API）会限流、会返回空页、仓库会改名。任何一次异常如果被静默吞掉，
 *   静态站就会带着空目录发布出去。所以这里所有异常一律非零退出，
 *   CI 中止发布，线上保留上一版。
 *
 * 用法：
 *   node scripts/sync-data.mjs                       # 采 GitHub（默认）
 *   node scripts/sync-data.mjs --limit 1200          # 调整收录条数
 *   node scripts/sync-data.mjs --readme-top 800      # 限制 README 抓取数量（默认全量）
 *   node scripts/sync-data.mjs --refresh             # 忽略搜索缓存强制重采
 *   node scripts/sync-data.mjs --legacy              # 退回上游聚合快照（兼容用）
 *   node scripts/sync-data.mjs --legacy --url <地址>  # 指定上游
 *   node scripts/sync-data.mjs --dry-run             # 只采集校验，不落盘
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const hasFlag = (name) => args.includes(`--${name}`);

const LEGACY = hasFlag("legacy");
const DRY_RUN = hasFlag("dry-run");
const LIMIT = getArg("limit", "1600");
const MIN_REPOS = Number(getArg("min-repos", "80"));
const MIN_UPSTREAM = Number(getArg("min-count", "5000"));
const UPSTREAM_URL = getArg("url", process.env.UPSTREAM_DATA_URL || "");

const RAW = resolve("data/raw-github.json");

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function run(script, extra = []) {
  console.log(`\n› node scripts/${script} ${extra.join(" ")}`.trimEnd());
  const r = spawnSync(process.execPath, [resolve("scripts", script), ...extra], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) fail(`${script} 执行失败（exit ${r.status}）`);
}

async function downloadLegacy(url, dest) {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "deepseek-plugin-market/1.0 (+https://github.com/zxwk1998/deepseek-plugin-market)",
    },
    redirect: "follow",
  });
  if (!res.ok) fail(`下载上游快照失败：HTTP ${res.status}`);
  const { writeFileSync } = await import("node:fs");
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  return dest;
}

function validateCollected() {
  if (!existsSync(RAW)) fail(`采集结果不存在：${RAW}`);
  const payload = JSON.parse(readFileSync(RAW, "utf8"));
  const repos = payload.repos;
  if (!Array.isArray(repos)) fail("采集结果缺少 repos 数组");
  if (repos.length < MIN_REPOS) {
    fail(`采集到 ${repos.length} 个仓库，低于安全下限 ${MIN_REPOS}（限流或查询失效？）`);
  }
  const noDesc = repos.filter((r) => !r.description).length;
  const noReadme = repos.filter((r) => !r.readme).length;
  console.log(
    `· 校验通过：${repos.length} 个仓库（无描述 ${noDesc}，无 README ${noReadme}），采集于 ${payload.collectedAt}`,
  );
  return repos.length;
}

function validateLegacy(path) {
  const payload = JSON.parse(readFileSync(path, "utf8"));
  const list = payload.plugins;
  if (!Array.isArray(list)) fail("上游快照缺少 plugins 数组");
  if (list.length < MIN_UPSTREAM) {
    fail(`上游条目 ${list.length} 低于安全下限 ${MIN_UPSTREAM}，疑似抓取失败`);
  }
  console.log(`· 校验通过：上游 ${list.length} 条`);
  return list.length;
}

async function main() {
  const started = Date.now();

  if (LEGACY) {
    const url =
      UPSTREAM_URL || "https://raw.githubusercontent.com/2BingLing/dsh-market/master/web/public/plugins.json";
    const tmp = "/tmp/dpm-upstream-plugins.json";
    console.log(`· [legacy] 下载上游快照\n  ${url}`);
    await downloadLegacy(url, tmp);
    const count = validateLegacy(tmp);
    if (DRY_RUN) return console.log(`· --dry-run，未写入（${count} 条）`);
    run("build-data.mjs", ["--src", tmp, "--limit", LIMIT]);
    run("build-index.mjs");
  } else {
    run("collect-github.mjs", [
      "--out",
      RAW,
      // 不显式传 --readme-top 时，让采集脚本自己按有无凭据决定默认值
      ...(getArg("readme-top") ? ["--readme-top", getArg("readme-top")] : []),
      "--max-pages",
      getArg("max-pages", "5"),
      ...(hasFlag("refresh") ? ["--refresh"] : []),
      ...(hasFlag("skip-zero") ? ["--skip-zero"] : []),
      ...(hasFlag("no-readme") ? ["--no-readme"] : []),
      ...(getArg("concurrency") ? ["--concurrency", getArg("concurrency")] : []),
      ...(getArg("topics") ? ["--topics", getArg("topics")] : []),
      ...(hasFlag("no-cdn") ? ["--no-cdn"] : []),
    ]);
    const count = validateCollected();
    if (DRY_RUN) return console.log(`· --dry-run，未写入目录数据（采集 ${count} 个）`);
    run("build-data.mjs", ["--src", RAW, "--limit", LIMIT]);
    run("build-index.mjs");
  }

  console.log(`\n✓ 同步完成，用时 ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

main().catch((err) => fail(err?.stack || String(err)));
