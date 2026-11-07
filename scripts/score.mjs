/**
 * 自建评分与信号抽取。
 *
 * 为什么自己算：目录的价值在排序口径透明。所有输入都来自 GitHub 公开字段
 * （stars / pushed_at / topics / readme / license），任何一条分数都能回溯到具体证据。
 *
 * 五维权重（合计 1.0）：
 *   维护活跃 0.25 · 实用度 0.25 · 生态热度 0.20 · 上手便捷 0.15 · 信号质量 0.15
 */

const DAY = 86_400_000;

/** topic 中文映射：覆盖生态里高频出现的那批，未命中保留原文 */
const TOPIC_ZH = {
  "dsh-plugin": "DSH 插件",
  "deepseek-harness": "DSH",
  "cordis-plugin": "Cordis 插件",
  "agent-skills": "Agent 技能",
  "dsh-skills": "DSH 技能",
  memory: "记忆",
  "agent-memory": "智能体记忆",
  session: "会话管理",
  "context-management": "上下文管理",
  cli: "命令行工具",
  tui: "终端界面",
  ui: "界面增强",
  theme: "主题",
  "dark-mode": "深色模式",
  sidebar: "侧栏",
  dashboard: "面板",
  visualization: "可视化",
  automation: "自动化",
  workflow: "工作流",
  "multi-agent": "多智能体协作",
  orchestration: "任务编排",
  mcp: "MCP",
  rag: "检索增强",
  search: "检索",
  database: "数据库",
  sql: "SQL",
  pdf: "PDF",
  ocr: "OCR",
  image: "图像",
  video: "视频",
  audio: "音频",
  "text-to-speech": "语音合成",
  "content-creation": "内容创作",
  security: "安全",
  audit: "审计",
  sandbox: "沙箱",
  permissions: "权限",
  git: "Git",
  testing: "测试",
  debugging: "调试",
  refactor: "重构",
  "code-review": "代码审查",
  documentation: "文档",
  "model-router": "模型路由",
  "cost-control": "成本控制",
  "token-usage": "Token 统计",
  translation: "翻译",
  notification: "通知",
  "file-manager": "文件管理",
  "data-analysis": "数据分析",
  scraping: "网页抓取",
  desktop: "桌面端",
  mobile: "移动端",
  localization: "本地化",
  i18n: "国际化",
};

/** README 里出现这些词，说明装完还得自己准备凭据才算能用 */
const CONFIG_SIGNAL =
  /(api[ _-]?key|access[ _-]?token|bearer|\.env\b|environment variable|export [A-Z][A-Z0-9_]{2,}=|config\.(json|ya?ml))/i;

/** 安装命令的形态风险 */
const RISK_PATTERNS = [
  { re: /curl[^\n|]*\|\s*(ba)?sh/i, reason: "远程脚本直接管道执行（curl | sh）" },
  { re: /wget[^\n|]*\|\s*(ba)?sh/i, reason: "远程脚本直接管道执行（wget | sh）" },
  { re: /(npm|pnpm|yarn)\s+(i|install|add)\s+(-g|--global)/i, reason: "全局安装，会改动系统级依赖" },
  { re: /sudo\s+/i, reason: "需要 sudo 提权" },
  { re: /chmod\s+\+x\s+.*&&\s*\.\//i, reason: "下载后赋权并直接执行" },
];

const COMMAND_RE = /^(?:\$\s+)?((?:npx|npm|pnpm|yarn|bun|git clone|dsh|pip|uv|brew)\s[^\n`]{3,160})$/gi;

export function stripHtml(input) {
  if (!input) return "";
  return String(input)
    .slice(0, 20_000)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/<[^>]*$/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/&#?\w+;/g, " ")
    .replace(/[#>*_`|~]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function stripEmoji(input) {
  if (!input) return "";
  return String(input)
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{2190}-\u{21FF}]/gu,
      "",
    )
    .replace(/^[\s:：·\-|]+/, "")
    .trim();
}

/** 从 README 抽取可直接执行的安装命令（去重、限 3 条） */
export function extractCommands(readme) {
  if (!readme) return [];
  const commands = [];
  const seen = new Set();
  for (const line of readme.split("\n")) {
    const m = line.trim().match(COMMAND_RE);
    if (!m) continue;
    const cmd = m[1].trim().replace(/\s+/g, " ");
    if (cmd.length < 8 || seen.has(cmd)) continue;
    seen.add(cmd);
    commands.push(cmd);
    if (commands.length >= 3) break;
  }
  return commands;
}

export function detectNeedsConfig(repo) {
  const hay = `${repo.description ?? ""}\n${repo.readme ?? ""}`;
  return CONFIG_SIGNAL.test(hay);
}

export function detectRisk(repo) {
  const hay = repo.readme ?? "";
  const reasons = [];
  for (const { re, reason } of RISK_PATTERNS) {
    if (re.test(hay)) reasons.push(reason);
  }
  return { risky: reasons.length > 0, riskyReasons: [...new Set(reasons)] };
}

/** skill 与 cordis-plugin 是两种安装方式，判定必须稳定可解释 */
export function detectType(repo) {
  const topics = (repo.topics ?? []).map((t) => t.toLowerCase());
  const name = (repo.name ?? "").toLowerCase();
  if (topics.some((t) => t.includes("skill"))) return "skill";
  if (/(^|[-_])skill($|[-_])/.test(name)) return "skill";
  if (topics.some((t) => t.includes("cordis") || t === "dsh-plugin")) return "cordis-plugin";
  return "cordis-plugin";
}

export function chineseTags(repo, limit = 6) {
  const topics = repo.topics ?? [];
  const out = [];
  const seen = new Set();
  for (const t of topics) {
    const lower = t.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    const zh = TOPIC_ZH[lower];
    if (zh) out.push(zh);
  }
  // 中文标签不够时，用原始 topic 补齐（保留英文可读性，不做假翻译）
  if (out.length < limit) {
    for (const t of topics) {
      if (out.length >= limit) break;
      if (TOPIC_ZH[t.toLowerCase()]) continue;
      if (t.length > 18) continue;
      if (out.includes(t)) continue;
      out.push(t);
    }
  }
  return out.slice(0, limit);
}

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreRepo(repo, now = Date.now()) {
  const pushedDays = (now - new Date(repo.pushedAt).getTime()) / DAY;
  const stars = repo.stars ?? 0;
  const readmeLen = (repo.readme ?? "").length;
  const descLen = (repo.description ?? "").length;
  const topics = repo.topics ?? [];
  const commands = extractCommands(repo.readme);
  const needsConfig = detectNeedsConfig(repo);

  /* 维护活跃：最近推送时间为主轴，归档仓库直接压到底 */
  let maintain;
  if (repo.archived) maintain = 4;
  else if (pushedDays <= 3) maintain = 100;
  else if (pushedDays <= 7) maintain = 96;
  else if (pushedDays <= 30) maintain = 86;
  else if (pushedDays <= 90) maintain = 70;
  else if (pushedDays <= 180) maintain = 52;
  else if (pushedDays <= 365) maintain = 32;
  else maintain = 12;

  /* 实用度：描述说清问题 + 有 topic 分类 + 有主页 */
  let practical = 0;
  if (descLen >= 120) practical += 52;
  else if (descLen >= 60) practical += 44;
  else if (descLen >= 24) practical += 34;
  else if (descLen > 0) practical += 20;
  practical += Math.min(topics.length, 8) * 4;
  if (repo.homepage) practical += 6;
  if (commands.length > 0) practical += 10;

  /* 生态热度：对数压缩，避免一个 8 万星项目把量纲拉爆 */
  const popularity = clamp((Math.log10(stars + 1) / 4.5) * 100);

  /* 上手便捷：有命令、无额外配置、有许可证就高 */
  let ease = 42;
  if (commands.length > 0) ease += 30;
  if (readmeLen >= 800) ease += 8;
  if (!needsConfig) ease += 14;
  else ease -= 12;
  if (repo.license) ease += 6;
  if (readmeLen === 0) ease -= 30;

  /* 信号质量：README 厚度 + 许可证 + 描述 */
  let signal = 10;
  if (readmeLen >= 6000) signal = 92;
  else if (readmeLen >= 2000) signal = 78;
  else if (readmeLen >= 600) signal = 60;
  else if (readmeLen > 0) signal = 38;
  if (repo.license) signal += 4;
  if (descLen >= 40) signal += 4;

  const total = clamp(
    maintain * 0.25 + clamp(practical) * 0.25 + popularity * 0.2 + ease * 0.15 + clamp(signal) * 0.15,
  );

  let confidence = 0.45;
  if (readmeLen > 0) confidence += 0.25;
  if (descLen >= 24) confidence += 0.15;
  if (stars > 0 && topics.length > 0) confidence += 0.15;
  confidence = Math.min(1, Number(confidence.toFixed(2)));

  /* 解释层：只陈述可核对的事实，不写"强烈推荐"这类空话 */
  const reasons = [];
  if (repo.archived) reasons.push("仓库已归档，作者不再维护");
  else if (pushedDays <= 7) reasons.push(`近 ${Math.max(1, Math.round(pushedDays))} 天仍在推送`);
  else if (pushedDays <= 90) reasons.push(`近 ${Math.round(pushedDays)} 天内有提交`);
  else if (pushedDays > 365) reasons.push("超过一年未推送，可能已适配不了当前版本");
  else reasons.push(`已 ${Math.round(pushedDays / 30)} 个月未推送`);

  if (commands.length > 0) reasons.push("README 给出了可直接复制的安装命令");
  else reasons.push("README 未给出明确安装命令，需要自己读");

  if (needsConfig) reasons.push("运行前需要准备 API Key 或环境变量");
  else reasons.push("装完即可用，无需额外配置");

  if (stars >= 500) reasons.push(`${stars} stars，社区使用面较广`);

  return {
    total,
    breakdown: { maintain, practical: clamp(practical), popularity, ease: clamp(ease), signal: clamp(signal) },
    confidence,
    explanation: reasons.join("；") + "。",
    commands,
    needsConfig,
    ...detectRisk(repo),
    type: detectType(repo),
    tags: chineseTags(repo),
  };
}
