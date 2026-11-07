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
    case "dsh-plugin-add":
      return "npm 包安装";
    default:
      return "通用 Git 克隆";
  }
}

/**
 * 下载量：0 也要显示成「0」，而不是「无」——
 * 「有包但一个月没人下载」本身就是判断依据，和「没有 npm 包」必须区分开。
 */
export function formatDownloads(dl: number | null | undefined): string {
  if (dl === null || dl === undefined) return "—";
  if (dl >= 10_000) return `${(dl / 10_000).toFixed(1).replace(/\.0$/, "")} 万`;
  return formatNumber(dl);
}

/**
 * 能力标签的中文化。
 * 这套标签来自上游的静态能力扫描（读文件/写文件/联网/执行命令…），
 * 比"这插件有风险吗"的布尔值有用得多：用户能看出它到底要动什么。
 */
const CAPABILITY_LABELS: Record<string, { label: string; tone: "read" | "write" | "net" | "exec" | "secret" | "other" }> = {
  "fs-read": { label: "读取文件", tone: "read" },
  "fs-write": { label: "写入文件", tone: "write" },
  network: { label: "访问网络", tone: "net" },
  shell: { label: "执行命令", tone: "exec" },
  env: { label: "读取环境变量", tone: "read" },
  credentials: { label: "读取凭据", tone: "secret" },
  llm: { label: "调用模型", tone: "other" },
  "host-runtime": { label: "访问宿主运行时", tone: "other" },
  "dynamic-code": { label: "动态执行代码", tone: "exec" },
  subagent: { label: "派生子代理", tone: "other" },
};

export function capabilityLabel(slug: string): string {
  return CAPABILITY_LABELS[slug]?.label ?? slug;
}

export function capabilityTone(slug: string): "read" | "write" | "net" | "exec" | "secret" | "other" {
  return CAPABILITY_LABELS[slug]?.tone ?? "other";
}

/**
 * 安全红线中文化。
 * 上游给的是英文判定句，直接展示等于把机器判断甩给用户；
 * 已知类型逐条翻译，未知形态保留英文原文但加前缀，保证不误导。
 */
export function redLineLabel(text: string): string {
  const t = String(text);
  if (/reads credentials\/secrets AND has network access/i.test(t)) {
    return "既读取凭据/密钥，又有网络访问 —— 存在外传可能";
  }
  if (/runs code at install time/i.test(t)) {
    return "安装时执行代码（postinstall 脚本）";
  }
  if (/uses plaintext http:\/\//i.test(t)) {
    const host = t.match(/http:\/\/([^\s,，]+)/i)?.[1] ?? "";
    return `以明文 http 连接 ${host}（可被中间人篡改）`;
  }
  if (/uses literal IP/i.test(t)) {
    const ip = t.match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0] ?? "";
    return `直接用 IP 地址 ${ip} 联网，绕过域名与证书校验`;
  }
  return t;
}
