import type { NextConfig } from "next";

/**
 * Node 运行时（output: "standalone"）。
 *
 * 之前是纯静态导出：2581 个详情页 × 每页约 100KB HTML = 265MB 产物，
 * 而数据本身只有 6MB —— 体积全是"把每一页复制成一个文件"的成本。
 * 改成按请求渲染后：磁盘上只有一份数据（SQLite）+ 一个服务端进程，
 * 页面照旧是完整 HTML（SEO 不变），但不再有 2500 份重复拷贝。
 *
 * basePath 仍保留：子目录部署时 Next 会自己给资源加前缀。
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;
