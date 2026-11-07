import { SCORE_DIMENSIONS } from "@/lib/taxonomy";
import type { ScoreBreakdown } from "@/lib/types";
import { cn } from "@/lib/utils";

/** 分档只用于"是否强调"，不用于红绿灯式评价 —— 低分不等于差，只代表信号弱 */
const TIER_TEXT: Record<string, string> = {
  top: "text-brand",
  good: "text-foreground",
  fair: "text-foreground/80",
  low: "text-muted-foreground",
};

export function ScoreBadge({
  total,
  tier,
  size = "md",
  className,
}: {
  total: number;
  tier: "top" | "good" | "fair" | "low";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <span
        className={cn(
          "tnum font-semibold tracking-[-0.02em]",
          TIER_TEXT[tier],
          size === "lg" ? "text-[40px] leading-none" : size === "md" ? "text-[19px] leading-none" : "text-[14px] leading-none",
        )}
      >
        {total}
      </span>
      <span className={cn("text-muted-foreground", size === "lg" ? "text-[13px]" : "text-[10px]")}>分</span>
    </span>
  );
}

/** 五维细条：比雷达图更适合列表侧栏，读数值不读面积 */
export function ScoreBars({
  breakdown,
  className,
  showLabels = true,
}: {
  breakdown: ScoreBreakdown;
  className?: string;
  showLabels?: boolean;
}) {
  return (
    <dl className={cn("space-y-2.5", className)}>
      {SCORE_DIMENSIONS.map((dim) => {
        const value = breakdown[dim.key];
        return (
          <div key={dim.key} className="grid grid-cols-[72px_1fr_28px] items-center gap-2.5">
            {showLabels ? (
              <dt className="text-[11.5px] text-muted-foreground">{dim.short}</dt>
            ) : (
              <dt className="sr-only">{dim.label}</dt>
            )}
            <div
              className="h-[5px] overflow-hidden rounded-full bg-muted"
              role="meter"
              aria-valuenow={value}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${dim.label} ${value} 分`}
            >
              <div
                className="h-full rounded-full bg-foreground/55"
                style={{ width: `${Math.max(value, 2)}%` }}
              />
            </div>
            <dd className="tnum text-right font-mono text-[10.5px] text-muted-foreground">{value}</dd>
          </div>
        );
      })}
    </dl>
  );
}

/** 五维雷达：详情页首屏用，几何参数固定，无外部依赖 */
export function ScoreRadar({
  breakdown,
  size = 200,
  className,
}: {
  breakdown: ScoreBreakdown;
  size?: number;
  className?: string;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.34;
  const labelR = size * 0.47;

  const point = (index: number, ratio: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio] as const;
  };
  const labelPoint = (index: number) => {
    const angle = (Math.PI * 2 * index) / 5 - Math.PI / 2;
    return [cx + Math.cos(angle) * labelR, cy + Math.sin(angle) * labelR] as const;
  };

  const polygon = (ratio: number) =>
    Array.from({ length: 5 }, (_, i) => point(i, ratio).join(",")).join(" ");

  const valuePolygon = SCORE_DIMENSIONS.map((dim, i) => point(i, breakdown[dim.key] / 100).join(",")).join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={`五维评分：${SCORE_DIMENSIONS.map((d) => `${d.label} ${breakdown[d.key]}`).join("，")}`}
    >
      {[0.25, 0.5, 0.75, 1].map((ratio) => (
        <polygon
          key={ratio}
          points={polygon(ratio)}
          fill="none"
          stroke="currentColor"
          strokeWidth={1}
          className="text-foreground/12"
        />
      ))}
      {Array.from({ length: 5 }, (_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeWidth={1} className="text-foreground/12" />
        );
      })}
      <polygon points={valuePolygon} className="fill-brand/12 stroke-brand" strokeWidth={1.75} strokeLinejoin="round" />
      {SCORE_DIMENSIONS.map((dim, i) => {
        const [x, y] = point(i, breakdown[dim.key] / 100);
        return <circle key={dim.key} cx={x} cy={y} r={2.5} className="fill-brand" />;
      })}
      {SCORE_DIMENSIONS.map((dim, i) => {
        const [x, y] = labelPoint(i);
        return (
          <text
            key={dim.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px]"
            style={{ fontSize: 10 }}
          >
            {dim.short}
          </text>
        );
      })}
    </svg>
  );
}
