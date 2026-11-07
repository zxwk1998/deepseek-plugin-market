import pluginsRaw from "../../data/plugins.json";
import metaRaw from "../../data/meta.json";
import type { MarketMeta, Plugin } from "./types";
import { categoriesOf } from "./taxonomy";

/**
 * 数据访问层（仅构建期使用）。
 * 数据在构建时打进产物，页面全部预渲染成实体 HTML —— 线上没有任何 Node 进程。
 */
export const plugins = pluginsRaw as unknown as Plugin[];
export const meta = metaRaw as MarketMeta;

/** 数据快照日：作为相对时间的统一基准，保证页面文本稳定 */
import { SNAPSHOT } from "./snapshot";
export { SNAPSHOT, SNAPSHOT_DATE } from "./snapshot";

const bySlug = new Map(plugins.map((p) => [p.slug, p]));

export function getPlugin(slug: string): Plugin | undefined {
  return bySlug.get(slug);
}

/** 全部 slug：generateStaticParams 用，构建期预渲染每个详情页 */
export function allSlugs(): string[] {
  return plugins.map((p) => p.slug);
}

/** 编辑精选：高分 + 有真实社区基础，代表当前生态水位 */
export function featured(count = 6): Plugin[] {
  return plugins.filter((p) => p.score.total >= 88 && p.stars >= 20).slice(0, count);
}

/** 本周上新（相对快照日 14 天内推送） */
export function recentlyUpdated(count = 8): Plugin[] {
  const base = new Date(SNAPSHOT).getTime();
  return [...plugins]
    .filter((p) => base - new Date(p.pushedAt).getTime() <= 14 * 86_400_000)
    .sort((a, b) => +new Date(b.pushedAt) - +new Date(a.pushedAt))
    .slice(0, count);
}

/** 高星榜：生态热度视角，和评分榜形成对照（评分 ≠ 热度，写进文案） */
export function mostStarred(count = 6): Plugin[] {
  return [...plugins].sort((a, b) => b.stars - a.stars).slice(0, count);
}

/**
 * 同仓库的其他包（monorepo 展开出来的兄弟条目）。
 *
 * 按仓库 id 分组 —— 主条目与子条目的 id 相同，所以这里要排除自己（按 slug）。
 * 没有兄弟条目（绝大多数仓库）时返回空数组，页面据此决定是否渲染该区块。
 */
const byRepo = new Map<string, Plugin[]>();
for (const p of plugins) {
  const list = byRepo.get(p.id);
  if (list) list.push(p);
  else byRepo.set(p.id, [p]);
}

export function siblingsOf(plugin: Plugin): Plugin[] {
  const group = byRepo.get(plugin.id) ?? [];
  if (group.length < 2) return [];
  return group.filter((p) => p.slug !== plugin.slug).sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
}

export function countByCategory(slug: string): number {
  let n = 0;
  for (const p of plugins) {
    if (!p.tags.length) continue;
    if (categoriesOf(p).some((c) => c.slug === slug)) n++;
  }
  return n;
}

export function pluginsInCategory(slug: string): Plugin[] {
  return plugins.filter((p) => categoriesOf(p).some((c) => c.slug === slug));
}

export function categoryPreview(slug: string, count = 4): Plugin[] {
  return pluginsInCategory(slug).slice(0, count);
}

/**
 * 相关推荐：标签重合度优先，其次同类目、同作者 —— 用于详情页形成内部链接网
 * （对 SEO 有价值：让每个详情页都能被从任意入口爬达）。
 */
export function relatedPlugins(plugin: Plugin, count = 4): Plugin[] {
  const own = new Set(plugin.tags.map((t) => t.toLowerCase()));
  const ownCats = new Set(categoriesOf(plugin).map((c) => c.slug));
  return plugins
    // 同仓库的其他包另有专区，别在这里重复出现
    .filter((p) => p.id !== plugin.id)
    .map((p) => {
      const overlap = p.tags.filter((t) => own.has(t.toLowerCase())).length;
      const sameCat = categoriesOf(p).some((c) => ownCats.has(c.slug)) ? 1 : 0;
      const sameOwner = p.owner === plugin.owner ? 1 : 0;
      return { p, w: overlap * 3 + sameCat * 2 + sameOwner };
    })
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w || b.p.score.total - a.p.score.total)
    .slice(0, count)
    .map((x) => x.p);
}

/** 全站高频标签：用于筛选器与分类页的标签云（取真实计数，不硬编码） */
export function topTags(limit = 30): { name: string; count: number }[] {
  return meta.topTags.slice(0, limit);
}

export const stats = {
  total: meta.included,
  upstreamTotal: meta.upstreamTotal,
  avgScore: meta.avgScore,
  skillCount: meta.types.skill,
  pluginCount: meta.types.plugin,
};
