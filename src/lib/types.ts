/**
 * 插件数据模型 —— 与 scripts/build-data.mjs 的输出严格对应。
 * 上游 DSH 生态快照（1.8 万条）经裁剪后保留约 1600 条高信号条目。
 */

export type PluginType = "skill" | "cordis-plugin";

export interface ScoreBreakdown {
  /** 维护活跃度 */
  maintain: number;
  /** 实用度 */
  practical: number;
  /** 生态热度 */
  popularity: number;
  /** 上手便捷度 */
  ease: number;
  /** 信号质量（README 完整度、描述可信度） */
  signal: number;
}

export interface Plugin {
  slug: string;
  id: string;
  type: PluginType;
  name: string;
  owner: string;
  stars: number;
  forks: number;
  issues: number;
  language: string | null;
  license: string | null;
  homepage: string | null;
  curated: boolean;
  description: string;
  descriptionZh: string | null;
  tags: string[];
  pushedAt: string;
  createdAt: string;
  score: {
    total: number;
    breakdown: ScoreBreakdown;
    confidence: number;
    explanation: string;
  };
  install: {
    method: "skills-add" | "pnpm-profile" | "git-clone" | string;
    needsConfig: boolean;
    usageNeedsConfig: boolean;
    risky: boolean;
    riskyReasons: string[];
    commands: string[];
  };
  /** README 纯文本摘要，详情页用于提供可索引的正文内容 */
  readme: string;
}

export interface MarketMeta {
  generatedAt: string;
  builtAt: string;
  upstreamTotal: number;
  included: number;
  types: { skill: number; plugin: number };
  curated: number;
  avgScore: number;
  topTags: { name: string; count: number }[];
  languages: { name: string; count: number }[];
}

/** 客户端检索索引条目（public/catalog.json），字段做了压缩以控制体积 */
export interface CatalogItem {
  /** slug */
  s: string;
  /** name */
  n: string;
  /** owner */
  o: string;
  /** type: s=skill / p=plugin */
  t: "s" | "p";
  /** 总分 */
  c: number;
  /** stars */
  st: number;
  /** tags */
  g: string[];
  /** 描述 */
  d: string;
  /** pushedAt */
  u: string;
  /** 位标记：1=需配置 2=命令有风险 4=编辑精选 */
  f: number;
  /** 语言 */
  l: string | null;
}
