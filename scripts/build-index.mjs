#!/usr/bin/env node
/**
 * 生成客户端检索索引：目录页的搜索/筛选在浏览器里跑，需要一份轻量索引。
 * 只保留列表与筛选用得到的字段，详情页（readme/评分解释/安装命令）不进索引，
 * 避免移动端首屏多下载 3MB。
 *
 * 输出：public/catalog.json（约 400-600KB，gzip 后 ~120KB）
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const plugins = JSON.parse(readFileSync(resolve("data/plugins.json"), "utf8"));

const index = plugins.map((p) => ({
  s: p.slug,
  n: p.name,
  o: p.owner,
  t: p.type === "skill" ? "s" : "p",
  c: p.score.total,
  st: p.stars,
  g: p.tags,
  d: (p.descriptionZh || p.description || "").slice(0, 160),
  u: p.pushedAt,
  f: (p.install.needsConfig ? 1 : 0) | (p.install.risky ? 2 : 0) | (p.curated ? 4 : 0),
  l: p.language,
}));

mkdirSync("public", { recursive: true });
const payload = JSON.stringify({ generatedAt: new Date().toISOString(), items: index });
writeFileSync(resolve("public/catalog.json"), payload);

console.log(
  `✓ public/catalog.json  ${index.length} 条  ${(Buffer.byteLength(payload) / 1024).toFixed(0)} KB`,
);
