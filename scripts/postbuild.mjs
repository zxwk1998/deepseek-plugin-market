#!/usr/bin/env node
/**
 * 构建后处理：
 * 1. 把品牌化 404 页面（/404/）复制为站点根目录的 404.html —— 静态托管对未知路径
 *    的默认兜底文件，避免落到平台自带的丑陋错误页。
 * 2. 打印产物概况，便于确认静态导出是否完整。
 */
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const OUT = resolve("out");

if (!existsSync(OUT)) {
  console.error("out/ 不存在，请先执行 next build");
  process.exit(1);
}

const source = resolve(OUT, "404/index.html");
if (existsSync(source)) {
  copyFileSync(source, resolve(OUT, "404.html"));
  console.log("✓ out/404.html（品牌化 404）");
} else {
  console.warn("! 未找到 out/404/index.html，跳过 404.html 生成");
}

/** 统计详情页数量，确认 SSG 真的跑完了 */
const pluginDir = resolve(OUT, "plugin");
const pluginPages = existsSync(pluginDir)
  ? readdirSync(pluginDir).filter((d) => statSync(resolve(pluginDir, d)).isDirectory()).length
  : 0;

const sitemapPath = resolve(OUT, "sitemap.xml");
const sitemapUrls = existsSync(sitemapPath)
  ? (readFileSync(sitemapPath, "utf8").match(/<url>/g) ?? []).length
  : 0;

console.log(`  详情页 ${pluginPages} 个 · sitemap ${sitemapUrls} 条 URL`);
