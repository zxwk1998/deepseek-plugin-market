import type { NextConfig } from "next";

/**
 * 纯静态导出（output: "export"）。
 *
 * 站点托管在自建服务器 / 任意 CDN，不需要 Node 运行时，也不占服务器内存。
 * 代价是每页都是一个实体 HTML 文件（2581 页约 265MB），发布时全量推送。
 * 这是刻意的取舍：零进程、零内存、零崩溃面，换来的是磁盘与带宽。
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
