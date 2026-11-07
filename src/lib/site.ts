/** 站点级常量：SEO、导航、结构化数据共用，避免多处硬编码 */
export const SITE = {
  /** 品牌短名，用于 header 标识 */
  brand: "DeepSeek 插件市场",
  /** 品牌缩写，用于图形标识 */
  mark: "DP",
  /** 全站标题后缀 */
  title: "DeepSeek 插件市场 · 精选 DSH 插件与技能目录",
  shortTitle: "DeepSeek 插件市场",
  description:
    "面向 DeepSeek Harness（DSH）的插件市场：每天直接从 GitHub 采集仓库数据，提供五维实用评分、中文分类、安装命令与安全提示，帮助你判断哪个插件值得装。",
  keywords: [
    "DeepSeek 插件市场",
    "DSH 插件",
    "DeepSeek Harness",
    "cordis 插件",
    "agent skill",
    "插件市场",
    "AI 插件目录",
  ],
  /**
   * 站点根地址：静态导出时无法从请求推断域名，必须显式配置。
   * 部署到你自己的域名时，构建前设置 NEXT_PUBLIC_SITE_URL 即可。
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://zxwk1998.github.io/deepseek-plugin-market").replace(
    /\/$/,
    "",
  ),
  locale: "zh-CN",
  author: "zxwk1998",
  repo: "https://github.com/zxwk1998/deepseek-plugin-market",
} as const;

export const NAV = [
  { href: "/plugins", label: "全部插件" },
  { href: "/categories", label: "分类" },
  { href: "/guide", label: "评分方法" },
] as const;

/** 静态资源前缀：配合 GitHub Pages 的项目子路径 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function absUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
