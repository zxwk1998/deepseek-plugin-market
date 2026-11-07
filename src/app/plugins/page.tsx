import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog-view";
import { JsonLd, breadcrumbJsonLd, collectionJsonLd } from "@/lib/seo";
import { plugins, stats, topTags } from "@/lib/data";
import { toCatalogItem } from "@/lib/catalog";
import { formatNumber } from "@/lib/format";

const title = "全部插件";
const description = `按五维实用分浏览 ${formatNumber(stats.total)} 个 DeepSeek Harness（DSH）插件与技能：可按分类、类型、评分、配置成本、标签筛选，并按 Star 数或更新时间排序。`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/plugins" },
  openGraph: { title: `${title} · DeepSeek 插件市场`, description, url: "/plugins" },
};

export default function PluginsPage() {
  // 首屏预渲染前 24 条，保证无 JS 与爬虫能看到真实内容；完整索引由客户端按需加载
  const initialItems = plugins.slice(0, 24).map(toCatalogItem);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "全部插件", path: "/plugins" },
          ]),
          collectionJsonLd("全部插件", `${process.env.NEXT_PUBLIC_SITE_URL || ""}/plugins`, plugins.slice(0, 20)),
        ]}
      />

      <section className="border-b bg-muted/20">
        <div className="shell flex flex-col gap-8 py-10 md:flex-row md:items-end md:justify-between md:py-14">
          <div>
            <p className="eyebrow">Index / 目录</p>
            <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] md:text-[38px]">
              全部插件
            </h1>
            <p className="mt-3 max-w-[64ch] text-[13.5px] leading-[1.7] text-muted-foreground text-pretty">
              收录 {formatNumber(stats.total)} 个条目（GitHub 匹配到 {formatNumber(stats.upstreamTotal)} 个）。
              评分口径见
              <a
                href="/guide/"
                className="mx-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
              >
                评分方法
              </a>
              ，排序默认按实用分而非 Star 数。
            </p>
          </div>

          <dl className="grid shrink-0 grid-cols-3 gap-6 md:gap-8">
            {[
              { label: "Skill", value: formatNumber(stats.skillCount) },
              { label: "Plugin", value: formatNumber(stats.pluginCount) },
              { label: "平均分", value: String(stats.avgScore) },
            ].map((s) => (
              <div key={s.label} className="md:text-right">
                <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">{s.label}</dt>
                <dd className="mt-1.5 text-[20px] leading-none font-semibold tracking-[-0.02em] tnum">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="shell py-8">
        <CatalogView initialItems={initialItems} total={stats.total} initialTags={topTags(18)} />
      </div>
    </>
  );
}
