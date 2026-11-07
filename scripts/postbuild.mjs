#!/usr/bin/env node
/**
 * 构建后处理：
 * 1. 把品牌化 404 页面（/404/）复制为站点根目录的 404.html —— 静态托管对未知路径
 *    的默认兜底文件，避免落到平台自带的丑陋错误页。
 * 2. 打印产物概况，确认 SSG 真的跑完了。
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

/**
 * 域名一致性闸门。
 *
 * 为什么要在构建后卡这一道：
 *   canonical / sitemap / robots 的域名全部由构建时的 NEXT_PUBLIC_SITE_URL 决定，
 *   而静态导出没有"运行时"可以纠正。漏设这个变量时构建依然成功、页面依然能打开，
 *   只有搜索引擎会看到"本站页面的规范地址在另一个 404 域名上"——线上表现是收录长期为零，
 *   本地完全无感。这类错误必须让构建失败，而不是靠人去看 HTML 源码。
 */
const EXPECTED_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://deepseek.vuejs-core.cn").replace(
  /\/$/,
  "",
);

function originOf(value) {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

const indexPath = resolve(OUT, "index.html");
const canonical = existsSync(indexPath)
  ? (readFileSync(indexPath, "utf8").match(/<link rel="canonical" href="([^"]+)"/) ?? [])[1]
  : undefined;

const sitemapOrigins = existsSync(sitemapPath)
  ? [
      ...new Set(
        [...readFileSync(sitemapPath, "utf8").matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
          originOf(m[1].trim()),
        ),
      ),
    ]
  : [];

const problems = [];
if (!canonical) {
  problems.push("首页缺少 <link rel=\"canonical\">");
} else if (originOf(canonical) !== EXPECTED_ORIGIN) {
  problems.push(`首页 canonical 指向 ${originOf(canonical)}，期望 ${EXPECTED_ORIGIN}`);
}
const strayOrigins = sitemapOrigins.filter((o) => o && o !== EXPECTED_ORIGIN);
if (strayOrigins.length) {
  problems.push(`sitemap 混入了其他域名：${strayOrigins.join(", ")}`);
}

if (problems.length) {
  console.error(`✗ 域名不一致，产物不可发布：`);
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`  修复：构建时设置 NEXT_PUBLIC_SITE_URL=${EXPECTED_ORIGIN}`);
  process.exit(1);
}

console.log(`  canonical 基点 ${EXPECTED_ORIGIN}（sitemap ${sitemapOrigins.length} 个域名，一致）`);
