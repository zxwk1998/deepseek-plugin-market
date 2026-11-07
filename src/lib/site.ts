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
   *
   * 默认值必须是**线上真实域名**，不能是 github.io：
   * canonical / sitemap / robots 全部由它派生，一旦构建时漏设 NEXT_PUBLIC_SITE_URL，
   * 全站 2500+ 页面的 canonical 就会指向一个 404 的镜像地址，搜索引擎据此判定
   * "原页面不在本站"，收录直接归零。宁可默认指向生产域名，也不留一个"看起来像示例"
   * 的占位域名。
   *
   * GitHub Pages 只是可选镜像，其工作流会显式覆盖该变量（见 .github/workflows/deploy.yml），
   * 不会用到这里的默认值。
   */
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://deepseek.vuejs-core.cn").replace(/\/$/, ""),
  locale: "zh-CN",
  author: "zxwk1998",
  repo: "https://github.com/zxwk1998/deepseek-plugin-market",
} as const;

export const NAV = [
  { href: "/plugins", label: "全部插件" },
  { href: "/categories", label: "分类" },
  { href: "/guide", label: "评分方法" },
] as const;

/**
 * 站外友情链接（同一域名下的兄弟站点）。
 * 与 NAV 分开定义的原因：这些是外链，渲染时要 target="_blank" + 外链箭头，
 * 不能和站内路由混在一个数组里，否则很容易被误写成 next/link 而做站内跳转。
 */
export const EXTERNAL_LINKS = [
  { href: "https://store.vuejs-core.cn", label: "模板市场" },
  { href: "https://qdii.vuejs-core.cn", label: "天天养基" },
] as const;

/** 静态资源前缀：配合 GitHub Pages 的项目子路径 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function absUrl(path: string): string {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
