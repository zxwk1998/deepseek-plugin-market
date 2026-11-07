import { cn } from "@/lib/utils";

/**
 * 品牌标识：墨黑方块 + 三条递进短线（索引/目录的隐喻）。
 * 纯几何图形 —— 不使用渐变色块或发光，小尺寸下依然清晰。
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-foreground",
        className,
      )}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="3" y="3.5" width="10" height="1.6" rx="0.8" fill="currentColor" className="text-background" />
        <rect x="3" y="7.2" width="6.5" height="1.6" rx="0.8" fill="currentColor" className="text-background opacity-70" />
        <rect x="3" y="10.9" width="3.2" height="1.6" rx="0.8" fill="currentColor" className="text-background opacity-40" />
      </svg>
    </span>
  );
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="flex flex-col leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.01em]">DeepSeek 插件市场</span>
        <span className="mt-1 hidden font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase sm:block">
          DSH Plugin Index
        </span>
      </span>
    </span>
  );
}

/** GitHub 标记（lucide 1.x 已移除品牌图标，这里内联官方路径） */
export function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className={cn("size-4", className)} aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38l-.01-1.34c-2.23.49-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.88.5-1.08-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
