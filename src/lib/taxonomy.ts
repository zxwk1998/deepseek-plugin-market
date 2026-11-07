import type { Plugin } from "./types";

/**
 * 主题分类：不按上游的散装标签平铺（那是参照站"标签墙"的根源），
 * 而是收敛成 8 个用户能直接理解的意图分区，一个插件可属多个分区。
 */
export interface Category {
  slug: string;
  name: string;
  /** 用于首页/分类页的一句话说明 */
  blurb: string;
  /** 命中任一标签即归入该分类（大小写不敏感的子串匹配） */
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  {
    slug: "memory",
    name: "记忆与会话",
    blurb: "让对话跨会话延续：记忆写入、上下文压缩、历史恢复。",
    keywords: ["会话管理", "状态持久化", "memory", "agent-memory", "上下文", "会话", "记忆", "session"],
  },
  {
    slug: "interface",
    name: "界面与主题",
    blurb: "改造宿主外观与交互：主题、侧栏、可视化面板。",
    keywords: ["界面美化", "主题", "前端增强", "可视化", "设置面板", "交互体验", "桌宠", "theme"],
  },
  {
    slug: "workflow",
    name: "自动化与编排",
    blurb: "把零散步骤串成流水线：任务编排、多智能体协作。",
    keywords: ["工作流增强", "自动化", "automation", "任务编排", "多智能体协作", "multi-agent", "流水线"],
  },
  {
    slug: "devtools",
    name: "开发与代码",
    blurb: "面向编码场景：代码审查、重构、命令行工具链。",
    keywords: ["命令行工具", "开发者体验", "代码", "重构", "cli", "git", "测试", "coding-agent", "debug"],
  },
  {
    slug: "data",
    name: "数据与检索",
    blurb: "接数据库、文档与网页：检索增强、数据清洗、文件管理。",
    keywords: ["数据分析", "检索", "文件管理", "知识库", "rag", "搜索", "数据库", "爬取"],
  },
  {
    slug: "security",
    name: "安全与审计",
    blurb: "安装前先看清风险：密钥泄漏、越权修改、权限围栏。",
    keywords: ["安全审查", "安全", "权限", "审计", "密钥", "隐私", "sandbox"],
  },
  {
    slug: "media",
    name: "多模态与内容",
    blurb: "图像、视频、语音、文档：把非文本素材接进工作流。",
    keywords: ["视觉理解", "图像", "视频", "语音", "内容创作", "图片", "ocr", "pdf", "文档"],
  },
  {
    slug: "model",
    name: "模型与成本",
    blurb: "切换模型、适配供应商、压 token 成本。",
    keywords: ["模型配置", "模型适配", "成本控制", "零配置", "模型路由", "token", "api"],
  },
];

/** 评分维度：详情页雷达图与说明文案共用同一份定义 */
export const SCORE_DIMENSIONS = [
  {
    key: "maintain" as const,
    label: "维护活跃",
    short: "维护",
    desc: "最近提交时间、提交频率、issue 响应。长期不更新的插件在快速迭代的宿主上很容易失效。",
  },
  {
    key: "practical" as const,
    label: "实用度",
    short: "实用",
    desc: "描述是否说清「解决什么问题」，以及是否具备可验证的功能边界。",
  },
  {
    key: "popularity" as const,
    label: "生态热度",
    short: "热度",
    desc: "Star / Fork 数与增长速度，反映真实使用规模，而非单纯营销曝光。",
  },
  {
    key: "ease" as const,
    label: "上手便捷",
    short: "便捷",
    desc: "安装是否需要额外配置、是否依赖密钥、README 是否给出可直接执行的命令。",
  },
  {
    key: "signal" as const,
    label: "信号质量",
    short: "信号",
    desc: "README 完整度、文档结构、Release 规范度。信号越弱，越可能是半成品。",
  },
];

export function categoriesOf(plugin: Pick<Plugin, "tags">): Category[] {
  const tags = plugin.tags.map((t) => t.toLowerCase());
  return CATEGORIES.filter((c) =>
    c.keywords.some((k) => tags.some((t) => t.includes(k.toLowerCase()))),
  );
}

export function categoryBySlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function inCategory(plugin: Pick<Plugin, "tags">, slug: string): boolean {
  const cat = categoryBySlug(slug);
  if (!cat) return false;
  return categoriesOf(plugin).some((c) => c.slug === cat.slug);
}
