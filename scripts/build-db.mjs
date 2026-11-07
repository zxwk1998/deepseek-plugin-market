#!/usr/bin/env node
/**
 * 把 data/plugins.json 装进 SQLite（data/site.db）。
 *
 * 为什么要有这一步：
 *   站点从「预渲染 2581 个 HTML」改成「按请求渲染」，运行时需要按 slug 取一条数据。
 *   6MB 的 JSON 全量读进内存也能跑，但那样每次数据更新都要重启进程；
 *   做成 SQLite 后，数据更新只需要替换一个文件，查询是主键索引，微秒级。
 *
 * 表结构刻意保持极简 —— 这里不是业务库，只是「按 slug 读一条 JSON」的索引：
 *   plugins(slug PK, id, score, stars, pushed_at, json)
 *   查询频繁按 score 排序、按 id 聚合，所以 id 也建索引。
 *
 * 用法：
 *   node scripts/build-db.mjs                 # data/plugins.json → data/site.db
 *   node scripts/build-db.mjs --in x.json --out y.db
 */
import { DatabaseSync } from "node:sqlite";
import { readFileSync, existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SRC = resolve(getArg("in", "data/plugins.json"));
const META = resolve(getArg("meta", "data/meta.json"));
const OUT = resolve(getArg("out", "data/site.db"));

if (!existsSync(SRC)) {
  console.error(`✗ 找不到 ${SRC}，先跑 pnpm data`);
  process.exit(1);
}

const plugins = JSON.parse(readFileSync(SRC, "utf8"));
const meta = existsSync(META) ? JSON.parse(readFileSync(META, "utf8")) : null;

// 每次全量重建：数据库是派生产物，增量更新只会带来"删掉的插件还留在库里"的问题
if (existsSync(OUT)) unlinkSync(OUT);

const db = new DatabaseSync(OUT);
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  CREATE TABLE plugins (
    slug       TEXT PRIMARY KEY,
    id         TEXT NOT NULL,
    score      INTEGER NOT NULL,
    stars      INTEGER NOT NULL,
    pushed_at  TEXT NOT NULL,
    json       TEXT NOT NULL
  );
  CREATE INDEX idx_plugins_id ON plugins(id);
  CREATE INDEX idx_plugins_score ON plugins(score DESC);
  CREATE TABLE kv (k TEXT PRIMARY KEY, v TEXT NOT NULL);
`);

const insert = db.prepare(
  "INSERT INTO plugins (slug, id, score, stars, pushed_at, json) VALUES (?, ?, ?, ?, ?, ?)",
);
db.exec("BEGIN");
for (const p of plugins) {
  insert.run(p.slug, p.id, p.score.total, p.stars, p.pushedAt, JSON.stringify(p));
}
if (meta) {
  db.prepare("INSERT INTO kv (k, v) VALUES (?, ?)").run("meta", JSON.stringify(meta));
  db.prepare("INSERT INTO kv (k, v) VALUES (?, ?)").run("builtAt", new Date().toISOString());
}
db.exec("COMMIT");

const count = db.prepare("SELECT COUNT(*) AS n FROM plugins").get().n;
db.close();

const mb = (readFileSync(OUT).length / 1048576).toFixed(1);
console.log(`✓ data/site.db  ${count} 条  ${mb} MB`);
