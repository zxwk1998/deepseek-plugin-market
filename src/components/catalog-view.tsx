"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, RotateCcw, Search, SlidersHorizontal, Star, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TypeChip } from "@/components/plugin-card";
import { ScoreBadge } from "@/components/score";
import { CATEGORIES } from "@/lib/taxonomy";
import { scoreTier, formatCount } from "@/lib/format";
import {
  DEFAULT_STATE,
  activeFilterCount,
  facetTags,
  filterAndSort,
  itemDesc,
  itemLanguage,
  itemName,
  itemNeedsConfig,
  itemOwner,
  itemScore,
  itemSlug,
  itemStars,
  itemTags,
  itemType,
  searchToState,
  stateToSearch,
  type CatalogState,
} from "@/lib/catalog";
import type { CatalogItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function CatalogView({
  initialItems,
  initialTags,
}: {
  initialItems: CatalogItem[];
  total: number;
  initialTags: { name: string; count: number }[];
}) {
  const [items, setItems] = useState<CatalogItem[]>(initialItems);
  const [loaded, setLoaded] = useState(false);
  const [state, setState] = useState<CatalogState>(DEFAULT_STATE);
  const [queryInput, setQueryInput] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [sheetOpen, setSheetOpen] = useState(false);
  const urlReady = useRef(false);

  /** 首屏用服务端预渲染的前 24 条（爬虫可见）；完整索引在浏览器空闲时补齐 */
  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`${BASE_PATH}/catalog.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data: { items: CatalogItem[] }) => {
          if (cancelled || !Array.isArray(data.items)) return;
          setItems(data.items);
          setLoaded(true);
        })
        .catch(() => setLoaded(true));
    };
    const id = window.setTimeout(load, 60);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, []);

  /** 从 URL 恢复筛选（首页跳转 /plugins?sort=stars 时生效） */
  useEffect(() => {
    const next = searchToState(window.location.search);
    setState(next);
    setQueryInput(next.q);
    urlReady.current = true;

    const onPop = () => {
      const s = searchToState(window.location.search);
      setState(s);
      setQueryInput(s.q);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  /** 写回地址栏：直接操作 history，避免静态站点触发整页导航 */
  useEffect(() => {
    if (!urlReady.current) return;
    const search = stateToSearch(state);
    const url = `${window.location.pathname}${search}`;
    window.history.replaceState(null, "", url);
  }, [state]);

  /* 搜索输入防抖：打字时不必每键重算 1600 条 */
  useEffect(() => {
    const t = window.setTimeout(() => {
      setState((s) => (s.q === queryInput ? s : { ...s, q: queryInput }));
    }, 160);
    return () => window.clearTimeout(t);
  }, [queryInput]);

  const filtered = useMemo(() => filterAndSort(items, state), [items, state]);
  const shown = filtered.slice(0, visible);
  const tags = useMemo(() => (initialTags.length ? initialTags : facetTags(items)), [items, initialTags]);
  const filterCount = activeFilterCount(state);

  const patch = useCallback((next: Partial<CatalogState>) => {
    setState((s) => ({ ...s, ...next }));
    setVisible(PAGE_SIZE);
  }, []);

  const reset = useCallback(() => {
    setState(DEFAULT_STATE);
    setQueryInput("");
    setVisible(PAGE_SIZE);
  }, []);

  return (
    <div>
      {/* 搜索 + 排序 */}
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            placeholder="搜插件名、作者或功能，如「记忆」「侧栏」「pdf」"
            aria-label="搜索插件"
            className="h-10 rounded-lg bg-card pl-9 text-[13.5px]"
          />
          {queryInput && (
            <button
              type="button"
              onClick={() => setQueryInput("")}
              aria-label="清空搜索"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={state.sort} onValueChange={(v) => patch({ sort: v as CatalogState["sort"] })}>
            <SelectTrigger className="h-10 w-[132px] rounded-lg bg-card text-[13px]" aria-label="排序方式">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="score">按实用分</SelectItem>
              <SelectItem value="stars">按 Star 数</SelectItem>
              <SelectItem value="updated">按更新时间</SelectItem>
            </SelectContent>
          </Select>

          {/* 移动端：筛选收进底部抽屉 */}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="h-10 gap-2 rounded-lg px-3 md:hidden">
                <SlidersHorizontal className="size-3.5" />
                筛选
                {filterCount > 0 && (
                  <span className="tnum rounded bg-foreground px-1 font-mono text-[10px] text-background">
                    {filterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[86svh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-[15px]">筛选条件</SheetTitle>
              </SheetHeader>
              <div className="mt-4">
                <FilterControls state={state} tags={tags} onChange={patch} onReset={reset} />
              </div>
              <Button className="mt-6 h-10 w-full" onClick={() => setSheetOpen(false)}>
                查看 {filtered.length} 个结果
              </Button>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* 分类快筛：单行横向滚动，不在移动端换行成"标签墙" */}
      <nav aria-label="分类筛选" className="mt-4 -mx-5 overflow-x-auto px-5 no-scrollbar md:mx-0 md:px-0">
        <ul className="flex w-max items-center gap-1.5 md:w-auto md:flex-wrap">
          <li>
            <CategoryChip active={!state.category} onClick={() => patch({ category: "" })}>
              全部
            </CategoryChip>
          </li>
          {CATEGORIES.map((c) => (
            <li key={c.slug}>
              <CategoryChip active={state.category === c.slug} onClick={() => patch({ category: c.slug })}>
                {c.name}
              </CategoryChip>
            </li>
          ))}
        </ul>
      </nav>

      {/* 桌面端筛选条 */}
      <div className="mt-5 hidden border-y border-[var(--hairline)] py-3 md:block">
        <FilterControls state={state} tags={tags} onChange={patch} onReset={reset} inline />
      </div>

      {/* 已选条件 */}
      {(filterCount > 0 || state.q) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11.5px] text-muted-foreground">已选</span>
          {state.q && <ActiveChip label={`「${state.q}」`} onClear={() => { setQueryInput(""); patch({ q: "" }); }} />}
          {state.type && (
            <ActiveChip
              label={state.type === "skill" ? "仅 Skill" : "仅 Plugin"}
              onClear={() => patch({ type: "" })}
            />
          )}
          {state.category && (
            <ActiveChip
              label={CATEGORIES.find((c) => c.slug === state.category)?.name ?? state.category}
              onClear={() => patch({ category: "" })}
            />
          )}
          {state.score && <ActiveChip label={`评分 ≥ ${state.score}`} onClear={() => patch({ score: "" })} />}
          {state.setup && (
            <ActiveChip
              label={state.setup === "ready" ? "开箱即用" : "需要配置"}
              onClear={() => patch({ setup: "" })}
            />
          )}
          {state.tags.map((t) => (
            <ActiveChip key={t} label={t} onClear={() => patch({ tags: state.tags.filter((x) => x !== t) })} />
          ))}
          <button
            type="button"
            onClick={reset}
            className="ml-1 inline-flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" />
            清空
          </button>
        </div>
      )}

      {/* 结果计数 */}
      <p className="mt-4 font-mono text-[11px] tracking-wide text-muted-foreground tnum" aria-live="polite">
        {filtered.length.toLocaleString("zh-CN")} 个结果
        {!loaded && <span className="ml-2 text-muted-foreground/70">· 索引加载中</span>}
        {loaded && filtered.length > shown.length && <span className="ml-2">· 已显示 {shown.length}</span>}
      </p>

      {/* 列表 */}
      {shown.length > 0 ? (
        <div className="mt-2 border-t border-[var(--hairline)]">
          {shown.map((item) => (
            <CatalogRow key={itemSlug(item)} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <Search className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="mt-3 text-[14px] font-medium">没有匹配的插件</p>
          <p className="mt-1 max-w-[36ch] text-[12.5px] text-muted-foreground text-pretty">
            换个关键词，或清空筛选条件重试。收录持续更新，也欢迎直接提交你需要的插件。
          </p>
          <Button variant="outline" className="mt-4 h-9" onClick={reset}>
            清空全部条件
          </Button>
        </div>
      )}

      {filtered.length > shown.length && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="h-10 px-5" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            加载更多（剩余 {filtered.length - shown.length}）
          </Button>
        </div>
      )}
    </div>
  );
}

function CategoryChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-7 rounded-full border px-3 text-[12.5px] whitespace-nowrap transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      type="button"
      onClick={onClear}
      className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-card pr-1.5 pl-2 text-[11.5px] text-foreground/80 transition-colors hover:border-foreground/30"
    >
      {label}
      <X className="size-3 text-muted-foreground" />
    </button>
  );
}

function FilterControls({
  state,
  tags,
  onChange,
  onReset,
  inline = false,
}: {
  state: CatalogState;
  tags: { name: string; count: number }[];
  onChange: (patch: Partial<CatalogState>) => void;
  onReset: () => void;
  inline?: boolean;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-3", !inline && "flex-col items-stretch gap-4")}>
      <FilterGroup label="类型">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {[
            { key: "", label: "全部" },
            { key: "skill", label: "Skill" },
            { key: "cordis-plugin", label: "Plugin" },
          ].map((opt) => (
            <button
              key={opt.key || "all"}
              type="button"
              onClick={() => onChange({ type: opt.key as CatalogState["type"] })}
              aria-pressed={state.type === opt.key}
              className={cn(
                "rounded-[6px] px-2.5 py-1 text-[12px] transition-colors",
                state.type === opt.key
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="评分">
        <Select
          value={state.score || "any"}
          onValueChange={(v) => onChange({ score: (v === "any" ? "" : v) as CatalogState["score"] })}
        >
          <SelectTrigger className="h-7 w-[104px] rounded-md bg-card px-2 text-[11.5px]" aria-label="最低评分">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">不限</SelectItem>
            <SelectItem value="90">90 分以上</SelectItem>
            <SelectItem value="78">78 分以上</SelectItem>
            <SelectItem value="60">60 分以上</SelectItem>
          </SelectContent>
        </Select>
      </FilterGroup>

      <FilterGroup label="配置">
        <Select
          value={state.setup || "any"}
          onValueChange={(v) => onChange({ setup: (v === "any" ? "" : v) as CatalogState["setup"] })}
        >
          <SelectTrigger className="h-7 w-[116px] rounded-md bg-card px-2 text-[11.5px]" aria-label="配置成本">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">不限</SelectItem>
            <SelectItem value="ready">开箱即用</SelectItem>
            <SelectItem value="config">需要 API Key</SelectItem>
          </SelectContent>
        </Select>
      </FilterGroup>

      <FilterGroup label="标签">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="inline-flex h-6 items-center gap-1.5 rounded border border-border px-2 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              {state.tags.length ? `已选 ${state.tags.length} 个` : "选择标签"}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-[280px] p-2">
            <div className="max-h-[260px] overflow-y-auto">
              {tags.map((tag) => {
                const active = state.tags.includes(tag.name);
                return (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() =>
                      onChange({
                        tags: active ? state.tags.filter((t) => t !== tag.name) : [...state.tags, tag.name],
                      })
                    }
                    className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-muted"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "flex size-3.5 items-center justify-center rounded-[3px] border",
                          active ? "border-foreground bg-foreground text-background" : "border-border",
                        )}
                      >
                        {active && <Check className="size-2.5" />}
                      </span>
                      {tag.name}
                    </span>
                    <span className="font-mono text-[10px] text-muted-foreground">{tag.count}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </FilterGroup>

      {inline && activeFilterCount(state) > 0 && (
        <button
          type="button"
          onClick={onReset}
          className="ml-auto text-[11.5px] text-muted-foreground hover:text-foreground"
        >
          重置筛选
        </button>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function CatalogRow({ item }: { item: CatalogItem }) {
  const slug = itemSlug(item);
  return (
    <Link
      href={`/plugin/${slug}/`}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-[var(--hairline)] px-1 py-3 transition-colors hover:bg-muted/40 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.5fr)_auto] md:gap-5 md:px-3"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <TypeChip type={itemType(item)} />
          <span className="truncate text-[13.5px] font-medium tracking-[-0.01em]">{itemName(item)}</span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 truncate font-mono text-[10.5px] text-muted-foreground">
          <span className="truncate">{itemOwner(item)}</span>
          {itemLanguage(item) && (
            <>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span>{itemLanguage(item)}</span>
            </>
          )}
          {itemNeedsConfig(item) && (
            <>
              <span aria-hidden="true" className="text-border">
                /
              </span>
              <span className="text-warning">需 API Key</span>
            </>
          )}
        </p>
      </div>

      <div className="col-span-2 min-w-0 md:col-span-1">
        <p className="truncate text-[12.5px] text-muted-foreground">{itemDesc(item)}</p>
        {itemTags(item).length > 0 && (
          <ul className="mt-1.5 hidden items-center gap-1.5 md:flex">
            {itemTags(item).slice(0, 3).map((tag) => (
              <li key={tag} className="rounded border border-[var(--hairline)] px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {tag}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-end gap-4">
        <span className="hidden w-16 items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex tnum">
          <Star className="size-3" aria-hidden="true" />
          {formatCount(itemStars(item))}
        </span>
        <span className="w-9 text-right">
          <ScoreBadge total={itemScore(item)} tier={scoreTier(itemScore(item))} size="sm" />
        </span>
        <ArrowUpRight
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}
