import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronRight, ShieldAlert, Star, Terminal } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { PluginCard, TypeChip } from "@/components/plugin-card";
import { ScoreBars, ScoreRadar } from "@/components/score";
import { JsonLd, breadcrumbJsonLd, pluginJsonLd } from "@/lib/seo";
import { SITE, absUrl } from "@/lib/site";
import { categoriesOf, SCORE_DIMENSIONS } from "@/lib/taxonomy";
import { SNAPSHOT, getPlugin, plugins, relatedPlugins, siblingsOf } from "@/lib/data";
import type { Plugin } from "@/lib/types";
import {
  capabilityLabel,
  capabilityTone,
  formatCount,
  formatDate,
  formatDownloads,
  formatNumber,
  installMethodLabel,
  redLineLabel,
  relativeFrom,
  typeLabel,
} from "@/lib/format";

/**
 * 按请求渲染（不再预生成 2581 个静态页）。
 * 页面内容仍是完整 HTML，爬虫拿到的东西和静态导出版本一致；
 * 差别只在"什么时候生成"——从构建期改成了第一次请求时。
 * 单页渲染约 20~40ms，配 nginx 反代缓存后接近静态。
 */
export const revalidate = 600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const plugin = getPlugin(slug);
  if (!plugin) return { title: "插件不存在" };

  const summary = plugin.descriptionZh || plugin.description;
  const title = `${plugin.name} — ${typeLabel(plugin.type)} 插件`;
  const description = `${summary}（实用分 ${plugin.score.total}／100，${formatCount(plugin.stars)} stars）`;

  return {
    title,
    description,
    alternates: { canonical: `/plugin/${plugin.slug}/` },
    openGraph: {
      type: "article",
      title: `${plugin.name} · DeepSeek 插件市场`,
      description,
      url: `/plugin/${plugin.slug}/`,
    },
    twitter: { card: "summary_large_image", title: `${plugin.name} · DeepSeek 插件市场`, description },
  };
}

export default async function PluginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const plugin = getPlugin(slug);
  if (!plugin) notFound();

  const cats = categoriesOf(plugin);
  // 卡片只需要展示字段。readme 有 900 字，每个卡片带一份会让 RSC payload 翻倍
  // （多包仓库的页面原本能到 260KB），传之前先剥掉。
  const related = relatedPlugins(plugin, 3).map(toCard);
  const siblings = siblingsOf(plugin).slice(0, 6).map(toCard);
  const primaryCat = cats[0];

  const commands =
    plugin.install.commands.length > 0 ? plugin.install.commands : [defaultCommand(plugin)];
  const commandsAreParsed = plugin.install.commands.length > 0;

  return (
    <>
      <JsonLd
        data={[
          pluginJsonLd(plugin),
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "全部插件", path: "/plugins" },
            ...(primaryCat ? [{ name: primaryCat.name, path: `/categories/${primaryCat.slug}` }] : []),
            { name: plugin.name, path: `/plugin/${plugin.slug}/` },
          ]),
        ]}
      />

      {/* ============ 头部 ============ */}
      <section className="border-b bg-muted/20">
        <div className="shell py-8 md:py-11">
          <nav aria-label="面包屑" className="flex items-center gap-1 text-[11.5px] text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              首页
            </Link>
            <ChevronRight className="size-3" aria-hidden="true" />
            <Link href="/plugins" className="hover:text-foreground">
              全部插件
            </Link>
            {primaryCat && (
              <>
                <ChevronRight className="size-3" aria-hidden="true" />
                <Link href={`/categories/${primaryCat.slug}/`} className="hover:text-foreground">
                  {primaryCat.name}
                </Link>
              </>
            )}
            <ChevronRight className="size-3" aria-hidden="true" />
            <span className="truncate text-foreground/70">{plugin.name}</span>
          </nav>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <TypeChip type={plugin.type} />
            {plugin.curated && (
              <span className="font-mono text-[9.5px] tracking-[0.08em] text-brand uppercase">编辑精选</span>
            )}
            {plugin.install.risky && (
              <span className="inline-flex items-center gap-1 rounded border border-warning/30 bg-warning/10 px-1.5 py-0.5 text-[10px] text-warning">
                <ShieldAlert className="size-2.5" />
                安装含风险命令
              </span>
            )}
            {(plugin.redLines?.length ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive">
                <ShieldAlert className="size-2.5" />
                {plugin.redLines!.length} 项安全红线
              </span>
            )}
            {(plugin.packageCount ?? 1) > 1 && (
              <span className="rounded border border-[var(--hairline)] px-1.5 py-0.5 font-mono text-[9.5px] tracking-[0.06em] text-muted-foreground">
                {plugin.siblingOf ? "同仓库子包" : "多包仓库"} · 共 {plugin.packageCount} 个
              </span>
            )}
          </div>

          <h1 className="mt-3 text-[30px] leading-[1.1] font-semibold tracking-[-0.032em] md:text-[40px]">
            {plugin.name}
          </h1>

          <p className="mt-2 font-mono text-[12px] text-muted-foreground">
            <a
              href={`https://github.com/${plugin.id}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 hover:text-foreground"
            >
              {plugin.id}
              <ArrowUpRight className="size-3" />
            </a>
          </p>

          <p className="mt-5 max-w-[68ch] text-[14.5px] leading-[1.75] text-foreground/85 text-pretty md:text-[15.5px]">
            {plugin.descriptionZh || plugin.description}
          </p>

          {plugin.tags.length > 0 && (
            <ul className="mt-5 flex flex-wrap gap-1.5">
              {plugin.tags.map((tag) => (
                <li key={tag}>
                  <Link
                    href={`/plugins?tag=${encodeURIComponent(tag)}`}
                    className="inline-block rounded border border-[var(--hairline)] bg-background px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground"
                  >
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {/* 速览：移动端侧栏在下方，关键决策信息必须首屏可见 */}
          <dl className="mt-6 grid max-w-[680px] grid-cols-2 gap-x-8 gap-y-3 border-t border-[var(--hairline)] pt-4 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { label: "形态", value: plugin.type === "skill" ? "Skill 技能" : "Plugin 插件" },
              { label: "安装", value: installMethodLabel(plugin.install.method) },
              { label: "需要密钥", value: plugin.install.needsConfig ? "是" : "否" },
              {
                label: "近月下载",
                // 没有 npm 分发时显示「—」，不要写成 0：那是两种完全不同的处境
                value: plugin.downloads == null ? "—" : formatDownloads(plugin.downloads),
              },
              { label: "最近推送", value: relativeFrom(plugin.pushedAt, SNAPSHOT) },
            ].map((f) => (
              <div key={f.label}>
                <dt className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">{f.label}</dt>
                <dd className="mt-1 text-[12.5px] text-foreground/90">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="shell grid gap-12 py-10 md:py-12 lg:grid-cols-[minmax(0,1fr)_336px] lg:gap-14">
        {/* ============ 正文 ============ */}
        <div className="min-w-0">
          {plugin.readme && (
            <section aria-labelledby="readme-heading">
              <h2 id="readme-heading" className="text-[17px] font-semibold tracking-[-0.02em]">
                项目说明
              </h2>
              <p className="mt-1 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                From README
              </p>
              <div className="mt-4 space-y-3.5">
                {toParagraphs(plugin.readme).map((para, i) => (
                  <p key={i} className="text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
                    {para}
                  </p>
                ))}
              </div>
            </section>
          )}

          {/* 若存在中文简介（人工/外部提供），同时保留仓库原文便于核对 */}
          {plugin.descriptionZh && plugin.description && plugin.description !== plugin.descriptionZh && (
            <section className="mt-6 rounded-lg border bg-muted/40 p-4" aria-labelledby="original-desc">
              <h2 id="original-desc" className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                Original description
              </h2>
              <p className="mt-2 text-[12.5px] leading-[1.75] text-foreground/75" lang="en">
                {plugin.description}
              </p>
            </section>
          )}

          <section id="install" className="mt-10 scroll-mt-24 border-t border-[var(--hairline)] pt-8" aria-labelledby="install-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 id="install-heading" className="text-[17px] font-semibold tracking-[-0.02em]">
                  安装方式
                </h2>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {installMethodLabel(plugin.install.method)} ·{" "}
                  {plugin.install.needsConfig ? "需要额外配置密钥" : "安装无需配置"}
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                <Terminal className="size-3" />
                {commandsAreParsed ? "README 解析" : "参考命令"}
              </span>
            </div>

            <div className="mt-4 space-y-2">
              {commands.map((cmd) => (
                <div key={cmd} className="group overflow-hidden rounded-lg border bg-card">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--hairline)] px-3 py-1.5">
                    <span className="font-mono text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                      shell
                    </span>
                    <CopyButton value={cmd} />
                  </div>
                  <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12px] leading-relaxed text-foreground/90">
                    <code>{cmd}</code>
                  </pre>
                </div>
              ))}
            </div>

            {!commandsAreParsed && (
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
                该仓库 README 未给出可直接解析的安装命令，以上为按插件形态生成的参考写法。
                执行前请以
                <a
                  href={`https://github.com/${plugin.id}#readme`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mx-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground"
                >
                  仓库 README
                </a>
                为准。
              </p>
            )}

            {plugin.install.risky && (
              <div className="mt-4 rounded-lg border border-warning/30 bg-warning/6 p-4">
                <p className="flex items-center gap-2 text-[12.5px] font-medium text-warning">
                  <ShieldAlert className="size-4" />
                  安装命令包含风险形态
                </p>
                <ul className="mt-2 space-y-1 pl-6 text-[12px] leading-relaxed text-muted-foreground">
                  {(plugin.install.riskyReasons.length
                    ? plugin.install.riskyReasons
                    : ["检测到全局安装或远程脚本执行"]
                  ).map((r) => (
                    <li key={r} className="list-disc">
                      {r}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  全局安装会修改系统级依赖；远程脚本执行等于把执行权交给仓库作者。装前请通读命令。
                </p>
              </div>
            )}
          </section>

          {/* ============ 同仓库其他包：monorepo 里读者最容易找错入口的地方 ============ */}
          {siblings.length > 0 && (
            <section
              className="mt-10 scroll-mt-24 border-t border-[var(--hairline)] pt-8"
              aria-labelledby="siblings-heading"
            >
              <h2 id="siblings-heading" className="text-[17px] font-semibold tracking-[-0.02em]">
                同仓库的其他插件
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {plugin.id} 是一个多包仓库，下面这些都是可以单独安装的包 · 共 {plugin.packageCount} 个
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {siblings.map((p) => (
                  <PluginCard key={p.slug} plugin={p} showTags={false} />
                ))}
              </div>
            </section>
          )}

          {/* ============ 安全能力：决定"敢不敢装"的信息，必须在正文里 ============ */}
          {((plugin.capabilities?.length ?? 0) > 0 || (plugin.redLines?.length ?? 0) > 0) && (
            <section
              id="safety"
              className="mt-10 scroll-mt-24 border-t border-[var(--hairline)] pt-8"
              aria-labelledby="safety-heading"
            >
              <h2 id="safety-heading" className="text-[17px] font-semibold tracking-[-0.02em]">
                安全能力
              </h2>
              <p className="mt-1 text-[12px] text-muted-foreground">
                静态扫描源码得到的权限画像 —— 回答的是「它要动什么」，而不是「它好不好」
              </p>

              {(plugin.capabilities?.length ?? 0) > 0 && (
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {plugin.capabilities!.map((cap) => {
                    const tone = capabilityTone(cap);
                    const style =
                      tone === "secret"
                        ? "border-destructive/30 bg-destructive/8 text-destructive"
                        : tone === "exec"
                          ? "border-warning/30 bg-warning/8 text-warning"
                          : tone === "net"
                            ? "border-brand/25 bg-brand-soft text-brand"
                            : "border-[var(--hairline)] bg-card text-muted-foreground";
                    return (
                      <li
                        key={cap}
                        className={`rounded border px-2 py-1 text-[11.5px] ${style}`}
                        title={cap}
                      >
                        {capabilityLabel(cap)}
                      </li>
                    );
                  })}
                </ul>
              )}

              {(plugin.redLines?.length ?? 0) > 0 ? (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/6 p-4">
                  <p className="flex items-center gap-2 text-[12.5px] font-medium text-destructive">
                    <ShieldAlert className="size-4" />
                    发现 {plugin.redLines!.length} 项需要留意的行为
                  </p>
                  <ul className="mt-2 space-y-1.5 text-[12px] leading-relaxed text-foreground/80">
                    {plugin.redLines!.map((line) => (
                      <li key={line} className="flex gap-2">
                        <span aria-hidden className="mt-[7px] size-1 shrink-0 rounded-full bg-destructive/60" />
                        <span>{redLineLabel(line)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 rounded-lg border border-[var(--hairline)] bg-muted/40 p-3 text-[12px] text-muted-foreground">
                  未发现已知红线（明文传输、安装期执行代码、凭据外传等）。
                </p>
              )}

              <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/80">
                能力与红线来自 awesome-dsh-plugin 的静态扫描结果（CC0 公有领域），本站未逐行复核源码；
                它只覆盖能被静态识别的模式，不等于安全审计结论。
              </p>
            </section>
          )}

          <section className="mt-10 border-t border-[var(--hairline)] pt-8" aria-labelledby="score-note-heading">
            <h2 id="score-note-heading" className="text-[17px] font-semibold tracking-[-0.02em]">
              为什么是这个分数
            </h2>
            <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
              {plugin.score.explanation || "该条目数据信号较弱，评分仅供参考。"}
            </p>
            {plugin.scoreScope === "repo" && (
              <p className="mt-2 text-[11.5px] leading-relaxed text-muted-foreground/80">
                该分数取自整个仓库 <span className="font-mono">{plugin.id}</span>，不是这个包单独算出来的。
              </p>
            )}
            <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3.5 sm:grid-cols-3">
              {SCORE_DIMENSIONS.map((dim) => (
                <div key={dim.key} className="border-t border-[var(--hairline)] pt-2.5">
                  <dt className="text-[11px] text-muted-foreground">{dim.label}</dt>
                  <dd className="mt-1 text-[17px] leading-none font-semibold tnum">
                    {plugin.score.breakdown[dim.key]}
                  </dd>
                </div>
              ))}
              <div className="border-t border-[var(--hairline)] pt-2.5">
                <dt className="text-[11px] text-muted-foreground">数据置信度</dt>
                <dd className="mt-1 text-[17px] leading-none font-semibold tnum">
                  {Math.round(plugin.score.confidence * 100)}
                  <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">%</span>
                </dd>
              </div>
            </dl>
            <Link
              href="/guide"
              className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
            >
              评分怎么算
              <ArrowUpRight className="size-3" />
            </Link>
          </section>

          {related.length > 0 && (
            <section className="mt-10 border-t border-[var(--hairline)] pt-8" aria-labelledby="related-heading">
              <h2 id="related-heading" className="text-[17px] font-semibold tracking-[-0.02em]">
                相关插件
              </h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((p) => (
                  <PluginCard key={p.slug} plugin={p} showTags={false} />
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ============ 侧栏 ============ */}
        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <div className="rounded-xl border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="eyebrow">实用分</p>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="text-[38px] leading-none font-semibold tracking-[-0.03em] tnum">
                    {plugin.score.total}
                  </span>
                  <span className="text-[12px] text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div className="text-right">
                <p className="inline-flex items-center gap-1 text-[12px] text-muted-foreground tnum">
                  <Star className="size-3" aria-hidden="true" />
                  {formatCount(plugin.stars)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{rankLabel(plugin.score.total)}</p>
              </div>
            </div>

            <div className="mt-2 flex justify-center">
              <ScoreRadar breakdown={plugin.score.breakdown} size={168} />
            </div>

            <div className="mt-2 border-t border-[var(--hairline)] pt-4">
              <ScoreBars breakdown={plugin.score.breakdown} />
            </div>

            <a
              href={`https://github.com/${plugin.id}`}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border text-[12.5px] transition-colors hover:border-foreground/25 hover:bg-muted/50"
            >
              在 GitHub 查看
              <ArrowUpRight className="size-3.5" />
            </a>
          </div>

          <dl className="mt-4 rounded-xl border bg-card p-5 text-[12px]">
            <MetaRow label="类型" value={plugin.type === "skill" ? "Skill（技能）" : "Plugin（插件）"} />
            <MetaRow label="安装方式" value={installMethodLabel(plugin.install.method)} />
            {plugin.npm && (
              <MetaRow label="npm 包" value={`${plugin.npm}${plugin.npmVersion ? `@${plugin.npmVersion}` : ""}`} />
            )}
            <MetaRow label="需要密钥" value={plugin.install.needsConfig ? "是" : "否"} />
            <MetaRow label="Star" value={formatNumber(plugin.stars)} />
            {plugin.downloads != null && (
              <MetaRow
                label="近月下载"
                value={`${formatNumber(plugin.downloads)}${plugin.downloadsRange ? `（${plugin.downloadsRange}）` : ""}`}
              />
            )}
            <MetaRow label="Fork" value={formatNumber(plugin.forks)} />
            <MetaRow label="语言" value={plugin.language ?? "—"} />
            <MetaRow label="许可证" value={plugin.license ?? "未声明"} />
            <MetaRow label="创建于" value={formatDate(plugin.createdAt)} />
            <MetaRow label="最近推送" value={`${formatDate(plugin.pushedAt)}（${relativeFrom(plugin.pushedAt, SNAPSHOT)}）`} />
            {cats.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--hairline)] py-2.5 last:border-0">
                <dt className="w-20 shrink-0 text-muted-foreground">分类</dt>
                <dd className="flex flex-wrap gap-1">
                  {cats.map((c) => (
                    <Link
                      key={c.slug}
                      href={`/categories/${c.slug}/`}
                      className="rounded border border-[var(--hairline)] px-1.5 py-0.5 text-[11px] text-foreground/80 hover:border-foreground/30"
                    >
                      {c.name}
                    </Link>
                  ))}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between py-2.5">
              <dt className="w-20 shrink-0 text-muted-foreground">页面地址</dt>
              <dd className="truncate font-mono text-[10.5px] text-muted-foreground">{absUrl(`/plugin/${plugin.slug}/`).replace(SITE.url, "")}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--hairline)] py-2.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="truncate text-right text-foreground/90">{value}</dd>
    </div>
  );
}

/** README 纯文本 → 段落：按句号切分并合并到约 300 字，避免整块文字墙 */
function toParagraphs(text: string, maxLen = 300): string[] {
  const sentences = text.split(/(?<=[。！？.!?])\s*/g).filter(Boolean);
  const paragraphs: string[] = [];
  let buffer = "";
  for (const s of sentences) {
    if (buffer.length + s.length > maxLen && buffer) {
      paragraphs.push(buffer.trim());
      buffer = s;
    } else {
      buffer += s;
    }
  }
  if (buffer.trim()) paragraphs.push(buffer.trim());
  return paragraphs.slice(0, 8);
}

/** 卡片视图用不到 README 正文，剥掉能显著减小页面里的 RSC payload */
function toCard(p: Plugin): Plugin {
  return p.readme ? { ...p, readme: "" } : p;
}

function defaultCommand(plugin: Plugin): string {
  // 有 npm 包就按包名装 —— 子包尤其需要，否则会装到整个仓库
  if (plugin.npm) return `dsh plugin add ${plugin.npm}`;
  if (plugin.type === "skill") return `npx skills add ${plugin.id}`;
  return `dsh plugin --profile web add github:${plugin.id}`;
}

/** 相对排名：比裸分数更有解释力，且随数据自动变化 */
function rankLabel(total: number): string {
  const below = plugins.filter((p) => p.score.total <= total).length;
  const pct = Math.round((below / plugins.length) * 100);
  if (pct >= 95) return "前 5%";
  if (pct >= 80) return "前 20%";
  if (pct >= 50) return "中位以上";
  return "中位以下";
}
