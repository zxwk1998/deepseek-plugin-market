import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { JsonLd, breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { CATEGORIES } from "@/lib/taxonomy";
import { countByCategory, categoryPreview } from "@/lib/data";

const description =
  "把 DSH 插件按使用意图分成 8 类：记忆与会话、界面与主题、自动化与编排、开发与代码、数据与检索、安全与审计、多模态与内容、模型与成本。";

export const metadata: Metadata = {
  title: "插件分类",
  description,
  alternates: { canonical: "/categories" },
  openGraph: { title: "插件分类 · DeepSeek 插件市场", description, url: "/categories" },
};

export default function CategoriesPage() {
  const cats = CATEGORIES.map((c) => ({
    ...c,
    count: countByCategory(c.slug),
    preview: categoryPreview(c.slug, 3),
  }));

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "分类", path: "/categories" },
          ]),
          collectionJsonLd(
            "插件分类",
            `${process.env.NEXT_PUBLIC_SITE_URL || ""}/categories`,
            cats.flatMap((c) => c.preview),
          ),
        ]}
      />

      <section className="border-b bg-muted/20">
        <div className="shell py-10 md:py-14">
          <p className="eyebrow">Taxonomy / 分类</p>
          <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[38px]">
            按使用意图分类
          </h1>
          <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.7] text-muted-foreground text-pretty">
            {description}
          </p>
        </div>
      </section>

      <div className="shell py-10">
        <ul className="grid gap-3 md:grid-cols-2">
          {cats.map((c) => (
            <li key={c.slug}>
              {/* relative 必须保留：拉伸链接用 after:absolute after:inset-0，
                  缺了定位上下文覆盖层会铺满整页，导致所有卡片都跳到最后一个分类 */}
              <div className="group relative flex h-full flex-col rounded-xl border bg-card p-5 transition-colors hover:border-foreground/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
                      <Link href={`/categories/${c.slug}/`} className="after:absolute after:inset-0">
                        {c.name}
                      </Link>
                    </h2>
                    <p className="mt-1.5 text-[12.5px] leading-[1.65] text-muted-foreground text-pretty">{c.blurb}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tnum">{c.count} 个</span>
                </div>

                <div className="mt-auto flex items-end justify-between gap-4 pt-5">
                  <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                    {c.preview.map((p) => (
                      <li key={p.slug} className="relative z-10">
                        <Link href={`/plugin/${p.slug}/`} className="hover:text-foreground hover:underline">
                          {p.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
