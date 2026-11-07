import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
import { PluginCard } from "@/components/plugin-card";
import { JsonLd, breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { CATEGORIES, categoryBySlug } from "@/lib/taxonomy";
import { pluginsInCategory } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) return { title: "分类不存在" };
  const count = pluginsInCategory(slug).length;
  const description = `${cat.blurb} 共收录 ${formatNumber(count)} 个 DeepSeek Harness 插件与技能，按五维实用分排序。`;
  return {
    title: `${cat.name}插件`,
    description,
    alternates: { canonical: `/categories/${cat.slug}/` },
    openGraph: { title: `${cat.name} · DeepSeek 插件市场`, description, url: `/categories/${cat.slug}/` },
  };
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const cat = categoryBySlug(slug);
  if (!cat) notFound();

  const items = pluginsInCategory(slug);
  const shown = items.slice(0, 30);
  const others = CATEGORIES.filter((c) => c.slug !== slug);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "分类", path: "/categories" },
            { name: cat.name, path: `/categories/${cat.slug}/` },
          ]),
          collectionJsonLd(
            `${cat.name}插件`,
            `${process.env.NEXT_PUBLIC_SITE_URL || ""}/categories/${cat.slug}`,
            items.slice(0, 20),
          ),
        ]}
      />

      <section className="border-b bg-muted/20">
        <div className="shell py-9 md:py-12">
          <nav aria-label="面包屑" className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              首页
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <Link href="/categories" className="hover:text-foreground">
              分类
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="text-foreground/70">{cat.name}</span>
          </nav>

          <h1 className="mt-4 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[38px]">
            {cat.name}
          </h1>
          <p className="mt-3 max-w-[60ch] text-[13.5px] leading-[1.7] text-muted-foreground text-pretty">
            {cat.blurb}
          </p>
          <p className="mt-4 font-mono text-[11px] tracking-wide text-muted-foreground tnum">
            收录 {formatNumber(items.length)} 个 · 按实用分排序 · 显示前 {shown.length} 个
          </p>
        </div>
      </section>

      <div className="shell py-8 md:py-10">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((p) => (
            <PluginCard key={p.slug} plugin={p} />
          ))}
        </div>

        {items.length > shown.length && (
          <div className="mt-8 flex justify-center">
            <Link
              href={`/plugins?category=${cat.slug}`}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] transition-colors hover:border-foreground/25"
            >
              查看全部 {formatNumber(items.length)} 个「{cat.name}」插件
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        )}

        <nav aria-label="其他分类" className="mt-14 border-t border-[var(--hairline)] pt-8">
          <h2 className="eyebrow">其他分类</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
            {others.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/categories/${c.slug}/`}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
