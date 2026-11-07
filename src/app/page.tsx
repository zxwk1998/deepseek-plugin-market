import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Star } from "lucide-react";
import { PluginCard, TypeChip } from "@/components/plugin-card";
import { ScoreBadge, ScoreBars, ScoreRadar } from "@/components/score";
import { JsonLd, collectionJsonLd, websiteJsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { CATEGORIES, SCORE_DIMENSIONS } from "@/lib/taxonomy";
import { SNAPSHOT, countByCategory, featured, mostStarred, plugins, stats } from "@/lib/data";
import { formatCount, formatNumber, relativeFrom, scoreTier } from "@/lib/format";

export const metadata: Metadata = {
  title: { absolute: SITE.title },
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  const top = plugins[0];
  const picks = featured(6);
  const fresh = [...plugins].sort((a, b) => +new Date(b.pushedAt) - +new Date(a.pushedAt)).slice(0, 6);
  const hottest = mostStarred(5);
  const categories = CATEGORIES.map((c) => ({ ...c, count: countByCategory(c.slug) }));

  return (
    <>
      <JsonLd data={[websiteJsonLd(), collectionJsonLd("DeepSeek 插件市场 · 全部插件", SITE.url, picks)]} />

      {/* ============ 首屏 ============ */}
      <section className="relative overflow-hidden border-b">
        <div className="hero-surface pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="shell relative grid gap-14 pt-14 pb-16 md:pt-20 md:pb-20 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)] lg:items-center lg:gap-20">
          <div>
            <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-brand" aria-hidden="true" />
                DSH Ecosystem
              </span>
              <span aria-hidden="true">/</span>
              <span>每日 06:00 更新</span>
              <span aria-hidden="true">/</span>
              <time dateTime={SNAPSHOT}>快照 {SNAPSHOT.slice(0, 10)}</time>
            </p>

            <h1 className="mt-6 text-[38px] leading-[1.05] font-semibold tracking-[-0.035em] md:text-[56px]">
              DeepSeek 插件市场
            </h1>

            <p className="mt-6 max-w-[44ch] text-[17px] leading-[1.65] text-foreground/80 text-pretty md:text-[19px]">
              把 {formatNumber(stats.total)} 个 DSH 插件与技能，按
              <span className="text-foreground">「能不能真的用起来」</span>
              重新排一遍。五维评分、中文分类、可直接复制的安装命令。
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/plugins"
                className="group inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-[13.5px] font-medium text-background transition-colors hover:bg-foreground/90"
              >
                浏览全部插件
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/guide"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13.5px] transition-colors hover:border-foreground/25"
              >
                评分怎么算
              </Link>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-y-6 border-t border-[var(--hairline)] pt-6 sm:grid-cols-4">
              <Stat label="本站收录" value={formatNumber(stats.total)} />
              <Stat label="GitHub 命中" value={formatNumber(stats.upstreamTotal)} />
              <Stat label="平均实用分" value={String(stats.avgScore)} />
              <Stat label="90 分以上" value={String(plugins.filter((p) => p.score.total >= 90).length)} suffix="个" />
            </dl>
          </div>

          {/* 评分标本卡：用真实数据展示方法论，替代常见的渐变装饰块 */}
          <div className="rounded-2xl border bg-card p-6 shadow-[0_1px_2px_oklch(0.2_0.02_265/4%)] md:p-7">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Top Rated / 评分最高</p>
              <span className="font-mono text-[10px] text-muted-foreground">#01</span>
            </div>

            <div className="mt-4 flex justify-center">
              <ScoreRadar breakdown={top.score.breakdown} size={196} />
            </div>

            <div className="mt-2 text-center">
              <p className="text-[15px] font-semibold tracking-[-0.01em]">{top.name}</p>
              <p className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground">{top.id}</p>
              <div className="mt-3 flex items-center justify-center gap-3">
                <ScoreBadge total={top.score.total} tier={scoreTier(top.score.total)} />
                <span className="h-3 w-px bg-border" aria-hidden="true" />
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground tnum">
                  <Star className="size-3" aria-hidden="true" />
                  {formatCount(top.stars)}
                </span>
                <TypeChip type={top.type} />
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--hairline)] pt-4">
              <ScoreBars breakdown={top.score.breakdown} />
            </div>

            <Link
              href={`/plugin/${top.slug}/`}
              className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border py-2 text-[12.5px] transition-colors hover:border-foreground/25 hover:bg-muted/50"
            >
              查看完整评分与安装方式
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 分类 ============ */}
      <section className="shell py-14 md:py-20" aria-labelledby="categories-heading">
        <SectionHead
          id="categories-heading"
          index="01"
          title="按你真正想解决的问题找"
          desc="散装标签只会让人更迷路。这里把收录条目收敛成 8 个意图分区，一个插件可属多个分区。"
          action={{ href: "/categories", label: "全部分类" }}
        />

        <ul className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((c) => (
            <li key={c.slug} className="bg-background">
              <Link
                href={`/categories/${c.slug}/`}
                className="group flex h-full flex-col justify-between gap-8 p-5 transition-colors hover:bg-muted/50"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[14px] font-medium tracking-[-0.01em]">{c.name}</h3>
                    <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                  <p className="mt-2 text-[12px] leading-[1.6] text-muted-foreground text-pretty">{c.blurb}</p>
                </div>
                <p className="font-mono text-[10.5px] tracking-[0.1em] text-muted-foreground uppercase tnum">
                  {c.count} 个条目
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ============ 编辑精选 ============ */}
      <section className="border-y bg-muted/30" aria-labelledby="picks-heading">
        <div className="shell py-14 md:py-20">
          <SectionHead
            id="picks-heading"
            index="02"
            title="高分推荐"
            desc="评分 88 以上且具备真实社区基础。不是「最热」，是「最不容易踩坑」。"
            action={{ href: "/plugins?sort=score", label: `查看全部 ${formatNumber(stats.total)} 个` }}
          />
          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {picks.map((p) => (
              <PluginCard key={p.slug} plugin={p} />
            ))}
          </div>
        </div>
      </section>

      {/* ============ 方法论 ============ */}
      <section className="shell py-14 md:py-20" aria-labelledby="method-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionHead
              id="method-heading"
              index="03"
              title="Star 数不能告诉你的事"
              desc="一个 8000 star 但半年没更新的插件，在快速迭代的宿主上大概率已经装不上了。五维评分就是把这件事量化。"
            />
            <Link
              href="/guide"
              className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
            >
              阅读完整评分方法
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <ol className="border-t border-[var(--hairline)]">
            {SCORE_DIMENSIONS.map((dim, i) => (
              <li
                key={dim.key}
                className="grid grid-cols-[40px_1fr] gap-x-4 gap-y-1 border-b border-[var(--hairline)] py-5 md:grid-cols-[56px_150px_1fr] md:items-baseline"
              >
                <span className="font-mono text-[11px] text-muted-foreground tnum">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h3 className="text-[14px] font-medium md:col-start-2">{dim.label}</h3>
                <p className="col-start-2 text-[12.5px] leading-[1.7] text-muted-foreground text-pretty md:col-start-3">
                  {dim.desc}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ============ 上新 / 高星 ============ */}
      <section className="border-t" aria-labelledby="fresh-heading">
        <div className="shell grid gap-12 py-14 md:py-20 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHead id="fresh-heading" index="04" title="最近在动的" desc="推送时间倒序。活跃度是插件还能用的第一信号。" />
            <ul className="mt-6">
              {fresh.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/plugin/${p.slug}/`}
                    className="group flex items-center gap-3 border-b border-[var(--hairline)] py-3 transition-colors hover:bg-muted/40"
                  >
                    <TypeChip type={p.type} />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">
                      {relativeFrom(p.pushedAt, SNAPSHOT)}
                    </span>
                    <ScoreBadge total={p.score.total} tier={scoreTier(p.score.total)} size="sm" className="w-9 justify-end" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <SectionHead id="hot-heading" index="05" title="社区热度最高" desc="按 Star 排序，与评分榜形成对照 —— 热度高不等于适合你。" />
            <ul className="mt-6">
              {hottest.map((p, i) => (
                <li key={p.slug}>
                  <Link
                    href={`/plugin/${p.slug}/`}
                    className="group flex items-center gap-3 border-b border-[var(--hairline)] py-3 transition-colors hover:bg-muted/40"
                  >
                    <span className="w-4 shrink-0 font-mono text-[11px] text-muted-foreground tnum">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{p.name}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground tnum">
                      ★ {formatCount(p.stars)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              href="/plugins?sort=stars"
              className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              按热度浏览全部
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* ============ 提交 CTA ============ */}
      <section className="shell pb-4">
        <div className="relative overflow-hidden rounded-2xl border bg-card p-8 md:p-12">
          <div className="hero-surface pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="eyebrow">Contribute</p>
              <h2 className="mt-3 max-w-[24ch] text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[32px]">
                你写的插件，也应该被正确地介绍
              </h2>
              <p className="mt-3 max-w-[46ch] text-[13.5px] leading-relaxed text-muted-foreground text-pretty">
                提交后我们补中文分类、核对安装命令、按统一口径重算分数。收录不收费，也不接受「买榜」。
              </p>
            </div>
            <a
              href={`${SITE.repo}/issues/new`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-foreground px-4 text-[13.5px] font-medium text-background transition-colors hover:bg-foreground/90"
            >
              提交插件
              <ArrowUpRight className="size-4" />
            </a>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="px-0 sm:border-l sm:border-[var(--hairline)] sm:pl-5 sm:first:border-l-0 sm:first:pl-0">
      <dt className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-1.5 text-[22px] leading-none font-semibold tracking-[-0.02em] tnum">
        {value}
        {suffix && <span className="ml-1 text-[11px] font-normal text-muted-foreground">{suffix}</span>}
      </dd>
    </div>
  );
}

function SectionHead({
  id,
  index,
  title,
  desc,
  action,
}: {
  id: string;
  index: string;
  title: string;
  desc?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-[62ch]">
        <p className="eyebrow">{index}</p>
        <h2 id={id} className="mt-2.5 text-[22px] leading-[1.2] font-semibold tracking-[-0.025em] md:text-[27px]">
          {title}
        </h2>
        {desc && <p className="mt-2.5 text-[13.5px] leading-[1.7] text-muted-foreground text-pretty">{desc}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="group inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {action.label}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
