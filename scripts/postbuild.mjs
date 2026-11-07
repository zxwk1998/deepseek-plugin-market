#!/usr/bin/env node
/**
 * 构建后打包（standalone）。
 *
 * Next 的 output: "standalone" 只产出 server.js + 最小 node_modules，
 * `.next/static` 与 `public/` 需要手工放进去，否则线上资源全部 404。
 * 数据文件（SQLite）也一并放进包内，部署时只传一个目录、不用管路径对应关系。
 *
 * 产物：.next/standalone/  ← 直接 rsync 到服务器即可运行
 */
import { cpSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const STANDALONE = resolve(".next/standalone");

if (!existsSync(STANDALONE)) {
  console.error("✗ .next/standalone 不存在，检查 next.config.ts 的 output 是否为 standalone");
  process.exit(1);
}

const copies = [
  [resolve(".next/static"), resolve(STANDALONE, ".next/static"), "静态资源"],
  [resolve("public"), resolve(STANDALONE, "public"), "public"],
  // 运行时数据：SQLite 是主数据源，JSON 作为兜底（两者都带，方便线上排障）
  [resolve("data/site.db"), resolve(STANDALONE, "data/site.db"), "SQLite 数据"],
  [resolve("data/plugins.json"), resolve(STANDALONE, "data/plugins.json"), "JSON 兜底"],
  [resolve("data/meta.json"), resolve(STANDALONE, "data/meta.json"), "聚合统计"],
];

for (const [from, to, label] of copies) {
  if (!existsSync(from)) {
    console.warn(`! 缺少 ${from}，跳过（${label}）`);
    continue;
  }
  cpSync(from, to, { recursive: true });
}

function dirSize(dir) {
  let total = 0;
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = resolve(d, e.name);
      if (e.isDirectory()) walk(p);
      else total += statSync(p).size;
    }
  };
  walk(dir);
  return total;
}

const mb = (n) => (n / 1048576).toFixed(1);
console.log(`✓ .next/standalone  ${mb(dirSize(STANDALONE))} MB（含静态资源与数据）`);
