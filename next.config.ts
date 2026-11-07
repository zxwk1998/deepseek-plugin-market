import type { NextConfig } from "next";

/**
 * 纯静态导出（output: "export"）：
 * 站点完全可以托管在 GitHub Pages / 对象存储 / 任意 CDN，无需 Node 运行时；
 * 同时所有插件详情页在构建期预渲染成真实 HTML —— 这是 SEO 的前提
 * （参照项目的纯客户端 SPA 首屏是空 <div>，爬虫拿不到任何插件内容）。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
