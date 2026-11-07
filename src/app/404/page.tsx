import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { BrandMark } from "@/components/brand";

/**
 * 品牌化 404。
 * 说明：Next 15.5 在 `output: "export"` 下使用自定义 `not-found.tsx` 会触发
 * `Invariant: no direct app page entry found for /_not-found`（构建期直接失败），
 * 因此这里退化成一条普通静态路由，构建后由 scripts/postbuild.mjs 把
 * out/404/index.html 复制为 out/404.html —— 静态托管平台（GitHub Pages / OSS / Nginx）
 * 对未知路径会命中该文件。
 */
export const metadata: Metadata = {
  title: "页面不存在",
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return (
    <div className="shell flex min-h-[68svh] flex-col items-center justify-center py-20 text-center">
      <BrandMark className="size-10 rounded-[10px]" />
      <p className="mt-7 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">404</p>
      <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.03em] md:text-[34px]">这个页面不存在</h1>
      <p className="mt-3 max-w-[42ch] text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
        插件可能已从收录中移除，或者链接拼错了。回目录页重新搜索是最快的办法。
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
        <Link
          href="/plugins"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[13px] font-medium text-background"
        >
          <Search className="size-3.5" />
          浏览全部插件
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-[13px] transition-colors hover:border-foreground/25"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
