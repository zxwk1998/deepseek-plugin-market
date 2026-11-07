#!/usr/bin/env node
/**
 * 数据管线：把采集结果规范化为本站目录数据。
 *
 * 支持两种输入：
 *   A. 自采格式 data/raw-github.json（scripts/collect-github.mjs 产出，主路径）
 *   B. 上游聚合格式 plugins.json（legacy 兼容，字段更多但评分口径不可控）
 *
 * 输出：
 *   data/plugins.json  目录数据（站点构建期读取）
 *   data/meta.json     聚合统计（首页数字、标签云）
 *
 * 用法：
 *   node scripts/build-data.mjs --src data/raw-github.json --limit 1600
 *   node scripts/build-data.mjs --src /path/to/plugins.json --limit 1600   # legacy
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { scoreRepo, stripHtml, stripEmoji } from "./score.mjs";

const args = process.argv.slice(2);
const getArg = (name, fallback = "") => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const SRC = getArg("src", "data/raw-github.json");
const LIMIT = Number(getArg("limit", "1600"));
const OUT_DIR = resolve(getArg("out", "data"));

/** 平台级噪声标签：出现在卡片上等于没信息 */
const NOISE_TAGS = new Set([
  "dsh", "dsh-plugin", "dsh-plugins", "dsh-plugin-market", "dsh-bundle",
  "dsh-plugin-desktop", "deepseek", "deepseek-harness", "harness", "cordis",
  "cordis-plugin", "plugin", "plugins", "skill", "skills", "agent-skills",
  "agent-tools", "agentic-ai", "ai", "llm", "agent", "agents", "ai-agent",
  "ai-agents", "tools", "tool", "typescript", "javascript",
]);

function cleanTags(tags) {
  const seen = new Set();
  const pool = [];
  for (const raw of tags ?? []) {
    const t = String(raw).trim();
    if (!t || t.length > 18) continue;
    const key = t.toLowerCase();
    if (NOISE_TAGS.has(key) || seen.has(key)) continue;
    if (/^[a-z0-9-]+$/.test(key) && key.split("-").length > 3) continue;
    seen.add(key);
    pool.push(t);
  }
  const isZh = (t) => /[\u4e00-\u9fa5]/.test(t);
  pool.sort((a, b) => Number(isZh(b)) - Number(isZh(a)));
  return pool.slice(0, 6);
}

/* ---------------- 输入 A：自采 GitHub 数据 ---------------- */
function fromGithub(payload) {
  const now = Date.now();
  return payload.repos
    .map((r) => {
      const s = scoreRepo(r, now);
      return {
        id: r.fullName,
        type: s.type,
        name: r.name,
        owner: r.owner,
        stars: r.stars,
        forks: r.forks,
        issues: r.issues,
        language: r.language,
        license: r.license,
        homepage: r.homepage || null,
        curated: false,
        description: stripEmoji(r.description) || r.description || "",
        // 自采数据没有中文翻译：留空，前台回落到原始英文简介（不机器硬翻）
        descriptionZh: null,
        tags: cleanTags(s.tags),
        pushedAt: r.pushedAt,
        createdAt: r.createdAt,
        score: {
          total: s.total,
          breakdown: s.breakdown,
          confidence: s.confidence,
          explanation: s.explanation,
        },
        install: {
          method: s.type === "skill" ? "skills-add" : "pnpm-profile",
          needsConfig: s.needsConfig,
          usageNeedsConfig: s.needsConfig,
          risky: s.risky,
          riskyReasons: s.riskyReasons,
          commands: s.commands,
        },
        readme: stripHtml(r.readme ?? "").slice(0, 900),
        archived: r.archived ?? false,
      };
    })
    .filter((p) => p.id.includes("/") && p.description.length >= 8);
}

/* ---------------- 输入 B：上游聚合数据（legacy） ---------------- */
function fromUpstream(payload) {
  return (payload.plugins ?? [])
    .filter((p) => p.id && p.name && (p.descriptionZh || p.description || "").trim().length >= 8)
    .map((p) => {
      const sc = p.score ?? {};
      const ins = p.install ?? {};
      return {
        id: p.id,
        type: p.type === "skill" ? "skill" : "cordis-plugin",
        name: p.name,
        owner: p.owner,
        stars: p.stars ?? 0,
        forks: p.forks ?? 0,
        issues: p.openIssues ?? 0,
        language: p.language ?? null,
        license: p.license ?? null,
        homepage: p.homepage || null,
        curated: Boolean(p.curated),
        description: (p.description || "").trim(),
        descriptionZh: (p.descriptionZh || "").trim() || null,
        tags: cleanTags(p.tags),
        pushedAt: p.pushedAt,
        createdAt: p.createdAt,
        score: {
          total: Math.round(sc.total ?? 0),
          breakdown: {
            maintain: sc.breakdown?.maintain ?? 0,
            practical: sc.breakdown?.practical ?? 0,
            popularity: sc.breakdown?.popularity ?? 0,
            ease: sc.breakdown?.ease ?? 0,
            signal: sc.breakdown?.signal ?? 0,
          },
          confidence: Number((sc.confidence ?? 0).toFixed(2)),
          explanation: stripHtml(sc.explanation).slice(0, 240),
        },
        install: {
          method: ins.method ?? "git-clone",
          needsConfig: Boolean(ins.needsConfig),
          usageNeedsConfig: Boolean(ins.usageNeedsConfig),
          risky: Boolean(ins.risky),
          riskyReasons: ins.riskyReasons ?? [],
          commands: Array.isArray(ins.commands) ? ins.commands.slice(0, 3) : [],
        },
        readme: stripHtml(p.readmeSummary).slice(0, 900),
        archived: false,
      };
    });
}

/* ---------------- 通用：选品 + slug + 聚合 ---------------- */
function select(candidates) {
  const byScore = [...candidates].sort((a, b) => b.score.total - a.score.total || b.stars - a.stars);
  const byStars = [...candidates].sort((a, b) => b.stars - a.stars);
  const byFresh = [...candidates]
    .filter((p) => p.stars >= 2)
    .sort((a, b) => +new Date(b.pushedAt) - +new Date(a.pushedAt));
  const bySkill = byScore.filter((p) => p.type === "skill");

  const picked = new Map();
  const take = (list, n) => {
    for (const p of list) {
      if (picked.size >= LIMIT) return;
      if (n-- <= 0) return;
      if (!picked.has(p.id)) picked.set(p.id, p);
    }
  };

  take(candidates.filter((p) => p.curated), Number.MAX_SAFE_INTEGER);
  take(bySkill, Math.round(LIMIT * 0.12));
  take(byScore, Math.round(LIMIT * 0.5));
  take(byStars, Math.round(LIMIT * 0.18));
  take(byFresh, Math.round(LIMIT * 0.12));
  take(byScore, LIMIT);

  return [...picked.values()].sort((a, b) => b.score.total - a.score.total || b.stars - a.stars);
}

function withSlugs(list) {
  const used = new Set();
  for (const p of list) {
    const base =
      p.id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "plugin";
    let slug = base;
    let n = 2;
    while (used.has(slug)) slug = `${base}-${n++}`;
    used.add(slug);
    p.slug = slug;
  }
  return list;
}

function aggregate(list, sourceMeta) {
  const tagCount = new Map();
  const langCount = new Map();
  let scoreSum = 0;

  for (const p of list) {
    scoreSum += p.score.total;
    for (const t of p.tags) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    if (p.language) langCount.set(p.language, (langCount.get(p.language) ?? 0) + 1);
  }

  return {
    generatedAt: sourceMeta.generatedAt,
    builtAt: new Date().toISOString(),
    source: sourceMeta.source,
    upstreamTotal: sourceMeta.upstreamTotal,
    included: list.length,
    types: {
      skill: list.filter((p) => p.type === "skill").length,
      plugin: list.filter((p) => p.type !== "skill").length,
    },
    curated: list.filter((p) => p.curated).length,
    avgScore: Math.round(scoreSum / Math.max(list.length, 1)),
    topTags: [...tagCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 24)
      .map(([name, count]) => ({ name, count })),
    languages: [...langCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
  };
}

/* ---------------- 主流程 ---------------- */
const payload = JSON.parse(readFileSync(resolve(SRC), "utf8"));
const isGithub = Array.isArray(payload.repos);
const candidates = isGithub ? fromGithub(payload) : fromUpstream(payload);

if (candidates.length === 0) {
  console.error(`✗ ${SRC} 没有可用条目，中止（避免写出空目录）`);
  process.exit(1);
}

const plugins = withSlugs(select(candidates));
const meta = aggregate(plugins, {
  generatedAt: payload.collectedAt ?? payload.generatedAt ?? new Date().toISOString(),
  source: isGithub ? "github-api" : "upstream-snapshot",
  upstreamTotal: isGithub ? payload.repos.length : (payload.plugins ?? []).length,
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, "plugins.json"), JSON.stringify(plugins));
writeFileSync(resolve(OUT_DIR, "meta.json"), JSON.stringify(meta, null, 2));

const mb = (Buffer.byteLength(JSON.stringify(plugins)) / 1048576).toFixed(2);
console.log(`✓ 来源 ${meta.source} · 候选 ${candidates.length} → 收录 ${plugins.length}`);
console.log(`  data/plugins.json ${mb} MB`);
console.log(
  `  skill ${meta.types.skill} · plugin ${meta.types.plugin} · 均分 ${meta.avgScore} · 快照 ${meta.generatedAt.slice(0, 10)}`,
);
console.log(`  标签 ${meta.topTags.slice(0, 8).map((t) => `${t.name}(${t.count})`).join(" ")}`);
