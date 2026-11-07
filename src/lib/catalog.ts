import { CATEGORIES } from "./taxonomy";
import type { CatalogItem, Plugin } from "./types";

/**
 * 目录检索逻辑（纯函数，客户端与服务端共用）。
 * 数据源是 public/catalog.json 的压缩索引，字段名为单字母以控制体积，
 * 这里统一提供访问器，避免业务代码里到处出现 `.st` `.c` 这类缩写。
 */
export interface CatalogState {
  q: string;
  type: "" | "skill" | "cordis-plugin";
  category: string;
  tags: string[];
  score: "" | "90" | "78" | "60";
  setup: "" | "ready" | "config";
  sort: "score" | "stars" | "updated";
}

export const DEFAULT_STATE: CatalogState = {
  q: "",
  type: "",
  category: "",
  tags: [],
  score: "",
  setup: "",
  sort: "score",
};

export const itemSlug = (i: CatalogItem) => i.s;
export const itemName = (i: CatalogItem) => i.n;
export const itemOwner = (i: CatalogItem) => i.o;
export const itemScore = (i: CatalogItem) => i.c;
export const itemStars = (i: CatalogItem) => i.st;
/** 近一月下载量；0 / undefined 都表示没有可用的 npm 分发数据 */
export const itemDownloads = (i: CatalogItem) => i.dl ?? 0;
export const itemTags = (i: CatalogItem) => i.g;
export const itemDesc = (i: CatalogItem) => i.d;
export const itemPushed = (i: CatalogItem) => i.u;
export const itemLanguage = (i: CatalogItem) => i.l;
export const itemType = (i: CatalogItem): "skill" | "cordis-plugin" => (i.t === "s" ? "skill" : "cordis-plugin");
export const itemNeedsConfig = (i: CatalogItem) => (i.f & 1) !== 0;

const norm = (s: string) => s.toLowerCase().trim();

/** 服务端把完整 Plugin 压成索引条目，供首屏预渲染与客户端接管共用同一形状 */
export function toCatalogItem(p: Plugin): CatalogItem {
  return {
    s: p.slug,
    n: p.name,
    o: p.owner,
    t: p.type === "skill" ? "s" : "p",
    c: p.score.total,
    st: p.stars,
    g: p.tags,
    d: (p.descriptionZh || p.description || "").slice(0, 110),
    u: p.pushedAt,
    f:
      (p.install.needsConfig ? 1 : 0) |
      (p.install.risky ? 2 : 0) |
      (p.curated ? 4 : 0) |
      ((p.redLines ?? []).length ? 8 : 0),
    l: p.language,
    dl: p.downloads ?? 0,
  };
}

/**
 * 查询匹配：多关键词 AND，每个词可命中名称/作者/描述/标签。
 * 不做拼音与同义词扩展 —— 那是上游插件的卖点，这里保持"输入什么就搜什么"的可预期性。
 */
export function matchesQuery(item: CatalogItem, q: string): boolean {
  const query = norm(q);
  if (!query) return true;
  const tokens = query.split(/\s+/).filter(Boolean);
  const haystack = `${item.n} ${item.o} ${item.d} ${item.g.join(" ")}`.toLowerCase();
  return tokens.every((t) => haystack.includes(t));
}

function matchesCategory(item: CatalogItem, slug: string): boolean {
  if (!slug) return true;
  const cat = CATEGORIES.find((c) => c.slug === slug);
  if (!cat) return true;
  const tags = item.g.map(norm);
  return cat.keywords.some((k) => tags.some((t) => t.includes(norm(k))));
}

export function filterAndSort(items: CatalogItem[], state: CatalogState): CatalogItem[] {
  const result = items.filter((item) => {
    if (!matchesQuery(item, state.q)) return false;
    if (state.type && itemType(item) !== state.type) return false;
    if (!matchesCategory(item, state.category)) return false;
    if (state.tags.length && !state.tags.every((t) => item.g.includes(t))) return false;
    if (state.score) {
      const min = Number(state.score);
      if (item.c < min) return false;
    }
    if (state.setup === "ready" && itemNeedsConfig(item)) return false;
    if (state.setup === "config" && !itemNeedsConfig(item)) return false;
    return true;
  });

  const sorted = [...result];
  if (state.sort === "stars") sorted.sort((a, b) => b.st - a.st);
  else if (state.sort === "updated") sorted.sort((a, b) => +new Date(b.u) - +new Date(a.u));
  else sorted.sort((a, b) => b.c - a.c || b.st - a.st);

  return sorted;
}

/** 侧栏标签云：按命中集合内的真实频次排序，避免展示一堆当前结果里为 0 的标签 */
export function facetTags(items: CatalogItem[], limit = 18): { name: string; count: number }[] {
  const counter = new Map<string, number>();
  for (const item of items) {
    for (const tag of item.g) counter.set(tag, (counter.get(tag) ?? 0) + 1);
  }
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

export function activeFilterCount(state: CatalogState): number {
  return (
    (state.type ? 1 : 0) +
    (state.category ? 1 : 0) +
    state.tags.length +
    (state.score ? 1 : 0) +
    (state.setup ? 1 : 0)
  );
}

/** 把筛选状态写回 URL，便于分享与返回 —— 直接改 history，不触发 RSC 请求 */
export function stateToSearch(state: CatalogState): string {
  const params = new URLSearchParams();
  if (state.q) params.set("q", state.q);
  if (state.type) params.set("type", state.type);
  if (state.category) params.set("category", state.category);
  if (state.tags.length) params.set("tag", state.tags.join(","));
  if (state.score) params.set("score", state.score);
  if (state.setup) params.set("setup", state.setup);
  if (state.sort !== "score") params.set("sort", state.sort);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function searchToState(search: string): CatalogState {
  const params = new URLSearchParams(search);
  const type = params.get("type");
  const score = params.get("score");
  const setup = params.get("setup");
  const sort = params.get("sort");
  return {
    q: params.get("q") ?? "",
    type: type === "skill" || type === "cordis-plugin" ? type : "",
    category: params.get("category") ?? "",
    tags: (params.get("tag") ?? "").split(",").filter(Boolean),
    score: score === "90" || score === "78" || score === "60" ? score : "",
    setup: setup === "ready" || setup === "config" ? setup : "",
    sort: sort === "stars" || sort === "updated" ? sort : "score",
  };
}
