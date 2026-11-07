import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/lib/taxonomy";
import { plugins } from "@/lib/data";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

/**
 * 全站 sitemap：静态页 + 分类页 + 全部插件详情页。
 * 详情页数量与数据量同步（当前约 1600 条），每条带 pushedAt 作为 lastModified，
 * 让搜索引擎优先重抓真正有更新的条目。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE.url}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE.url}/plugins/`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE.url}/categories/`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE.url}/guide/`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE.url}/about/`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORIES.map((c) => ({
    url: `${SITE.url}/categories/${c.slug}/`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const pluginRoutes: MetadataRoute.Sitemap = plugins.map((p) => ({
    url: `${SITE.url}/plugin/${p.slug}/`,
    lastModified: new Date(p.pushedAt),
    changeFrequency: "weekly",
    priority: p.score.total >= 85 ? 0.7 : 0.5,
  }));

  return [...staticRoutes, ...categoryRoutes, ...pluginRoutes];
}
