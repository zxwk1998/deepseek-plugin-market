import Link from "next/link";
import { ArrowUpRight, Star } from "lucide-react";
import { ScoreBadge } from "@/components/score";
import { formatCount, relativeFrom, scoreTier } from "@/lib/format";
import { SNAPSHOT } from "@/lib/snapshot";
import type { Plugin } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 形态标记：skill 与 plugin 是两种安装方式，必须一眼可分 */
export function TypeChip({ type, className }: { type: string; className?: string }) {
  const isSkill = type === "skill";
  return (
    <span
      className={cn(
        "inline-flex h-[19px] items-center rounded-[5px] border px-1.5 font-mono text-[9.5px] tracking-[0.08em] uppercase",
        isSkill
          ? "border-brand/25 bg-brand-soft text-brand"
          : "border-border bg-muted/60 text-muted-foreground",
        className,
      )}
    >
      {isSkill ? "Skill" : "Plugin"}
    </span>
  );
}

export function PluginCard({ plugin, showTags = true }: { plugin: Plugin; showTags?: boolean }) {
  const tier = scoreTier(plugin.score.total);
  return (
    <Link
      href={`/plugin/${plugin.slug}/`}
      className="card-lift group relative flex h-full flex-col rounded-xl border bg-card p-4 md:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <TypeChip type={plugin.type} />
          {plugin.curated && (
            <span className="font-mono text-[9.5px] tracking-[0.08em] text-brand uppercase">编辑精选</span>
          )}
        </div>
        <ScoreBadge total={plugin.score.total} tier={tier} size="sm" />
      </div>

      <h3 className="mt-3 text-[14.5px] leading-snug font-semibold tracking-[-0.01em]">{plugin.name}</h3>
      <p className="mt-0.5 truncate font-mono text-[10.5px] text-muted-foreground">
        {plugin.owner}/{plugin.id.split("/")[1] ?? plugin.name}
      </p>

      <p className="mt-2.5 line-clamp-2 min-h-[2.6em] text-[12.5px] leading-[1.6] text-muted-foreground text-pretty">
        {plugin.descriptionZh || plugin.description}
      </p>

      {showTags && plugin.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {plugin.tags.slice(0, 2).map((tag) => (
            <li
              key={tag}
              className="rounded-[5px] border border-[var(--hairline)] px-1.5 py-0.5 text-[10.5px] text-muted-foreground"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex items-center gap-3 pt-4 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 tnum">
          <Star className="size-3" aria-hidden="true" />
          {formatCount(plugin.stars)}
          <span className="sr-only">个 star</span>
        </span>
        {plugin.language && <span aria-hidden="true" className="text-border">·</span>}
        {plugin.language && <span>{plugin.language}</span>}
        <span aria-hidden="true" className="text-border">·</span>
        <span>{relativeFrom(plugin.pushedAt, SNAPSHOT)}</span>
        <ArrowUpRight
          className="ml-auto size-3.5 -translate-x-0.5 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

/** 目录页用的横向行式卡片：信息密度更高，避免"卡片墙"同质化 */
export function PluginRow({ plugin }: { plugin: Plugin }) {
  const tier = scoreTier(plugin.score.total);
  return (
    <Link
      href={`/plugin/${plugin.slug}/`}
      className="group grid grid-cols-[1fr_auto] items-center gap-4 border-b border-[var(--hairline)] px-2 py-3.5 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1.6fr)_minmax(0,2fr)_auto] md:gap-6 md:px-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <TypeChip type={plugin.type} />
          <span className="truncate text-[13.5px] font-medium tracking-[-0.01em]">{plugin.name}</span>
        </div>
        <p className="mt-1 truncate font-mono text-[10.5px] text-muted-foreground">{plugin.id}</p>
      </div>

      <p className="hidden min-w-0 truncate text-[12.5px] text-muted-foreground md:block">
        {plugin.descriptionZh || plugin.description}
      </p>

      <div className="flex items-center gap-4 md:gap-6">
        <span className="hidden w-20 shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:flex tnum">
          <Star className="size-3" aria-hidden="true" />
          {formatCount(plugin.stars)}
        </span>
        <span className="w-9 text-right">
          <ScoreBadge total={plugin.score.total} tier={tier} size="sm" />
        </span>
        <ArrowUpRight
          className="size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
