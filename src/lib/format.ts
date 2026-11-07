/** 纯展示层格式化函数。全部为确定性实现 —— 静态页面不存在 SSR/CSR 时间不一致问题。 */

/** 1234 → 1.2k；81_000 → 81k */
export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}m`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("zh-CN");
}

/** ISO → 2026-11-06 */
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * 相对时间。基准日固定传数据快照时间 —— 静态页面必须在构建期与浏览器端
 * 得到同一结果，否则会出现 hydration 文本不一致。
 */
export function relativeFrom(iso: string, baseIso: string): string {
  const diff = new Date(baseIso).getTime() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return formatDate(iso);
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "今天更新";
  if (days === 1) return "昨天更新";
  if (days < 30) return `${days} 天前更新`;
  if (days < 365) return `${Math.floor(days / 30)} 个月前更新`;
  return `${Math.floor(days / 365)} 年前更新`;
}

/** 评分分档：用于统一的视觉语义（高分才用品牌色，避免全站都是蓝） */
export function scoreTier(total: number): "top" | "good" | "fair" | "low" {
  if (total >= 90) return "top";
  if (total >= 78) return "good";
  if (total >= 60) return "fair";
  return "low";
}

export function typeLabel(type: string): string {
  return type === "skill" ? "Skill" : "Plugin";
}

/** 安装方式的人话描述 */
export function installMethodLabel(method: string): string {
  switch (method) {
    case "skills-add":
      return "克隆到 skills 目录";
    case "pnpm-profile":
      return "通过 profile 安装";
    default:
      return "通用 Git 克隆";
  }
}
