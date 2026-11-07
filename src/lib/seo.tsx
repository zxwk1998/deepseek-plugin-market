import { SITE, absUrl } from "@/lib/site";
import { CATEGORIES, SCORE_DIMENSIONS } from "@/lib/taxonomy";
import type { Plugin } from "@/lib/types";

/** 结构化数据注入器：统一走 dangerouslySetInnerHTML，避免 React 转义破坏 JSON */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.shortTitle,
    alternateName: ["DeepSeek 插件市场", "DSH 插件目录"],
    url: SITE.url,
    description: SITE.description,
    inLanguage: "zh-CN",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absUrl("/plugins")}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function collectionJsonLd(name: string, url: string, plugins: Plugin[]) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    url,
    isPartOf: { "@type": "WebSite", name: SITE.shortTitle, url: SITE.url },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: plugins.length,
      itemListElement: plugins.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absUrl(`/plugin/${p.slug}/`),
        name: p.name,
      })),
    },
  };
}

export function pluginJsonLd(plugin: Plugin) {
  const url = absUrl(`/plugin/${plugin.slug}/`);
  const cat = CATEGORIES.filter((c) => plugin.tags.some((t) => c.keywords.some((k) => t.includes(k))));
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: plugin.name,
    url,
    description: plugin.descriptionZh || plugin.description,
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: cat[0]?.name ?? "DSH 插件",
    operatingSystem: "macOS, Linux, Windows",
    inLanguage: "zh-CN",
    isAccessibleForFree: true,
    license: plugin.license ?? undefined,
    codeRepository: `https://github.com/${plugin.id}`,
    author: { "@type": "Person", name: plugin.owner, url: `https://github.com/${plugin.owner}` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "CNY" },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: (plugin.score.total / 20).toFixed(1),
      bestRating: "5",
      worstRating: "0",
      ratingCount: Math.max(plugin.stars, 1),
    },
    datePublished: plugin.createdAt.slice(0, 10),
    dateModified: plugin.pushedAt.slice(0, 10),
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absUrl(item.path),
    })),
  };
}

export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export const scoreDimensionsFaq = () =>
  SCORE_DIMENSIONS.map((d) => ({ q: `${d.label}这一维怎么算？`, a: d.desc }));
