#!/usr/bin/env node
/**
 * 写入 GitHub token 到 .env.local，并当场验证是否生效。
 *
 * 为什么要单独一个脚本：token 的坑几乎都出在"贴进去但没生效"——
 * 多了引号、多了空格、换了行、文件放错目录（不是项目根）、
 * 或者 token 本身权限/类型不对。所以写入后立刻打一次 /rate_limit，
 * 用返回的配额数字证明它真的被用上了，而不是让用户第二天才发现还是 10 次/分。
 *
 * 用法：
 *   node scripts/set-token.mjs github_pat_xxxxxxxx
 *   pnpm token github_pat_xxxxxxxx
 *   node scripts/set-token.mjs --status     # 只看当前凭据与配额，不写入
 */
import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(".env.local");
const KEY = "GITHUB_TOKEN";

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function readEnvFile(path) {
  if (!existsSync(path)) return new Map();
  const map = new Map();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) map.set(m[1], m[2].replace(/^["']|["']$/g, ""));
  }
  return map;
}

/** 打一次 /rate_limit 验证凭据，返回 { login, search, core } */
async function verify(token) {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "deepseek-plugin-market-set-token/1.0",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
  const res = await fetch("https://api.github.com/rate_limit", {
    headers,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) fail(`校验失败：HTTP ${res.status}（token 是否正确 / 是否已过期？）`);
  const { resources } = await res.json();

  let login = "(未认证)";
  if (token) {
    try {
      const me = await fetch("https://api.github.com/user", {
        headers,
        signal: AbortSignal.timeout(12_000),
      });
      if (me.ok) login = (await me.json()).login;
    } catch {
      // 只读公开数据的 fine-grained token 可能无权读 /user，不影响采集
    }
  }
  return { login, search: resources.search, core: resources.core };
}

function show(label, { login, search, core }) {
  console.log(`· ${label}`);
  console.log(`  身份      ${login}`);
  console.log(`  搜索配额  ${search.remaining}/${search.limit}（每分钟重置）`);
  console.log(`  核心配额  ${core.remaining}/${core.limit}（每小时重置）`);
}

async function main() {
  const arg = process.argv[2] || "";

  if (arg === "--status" || !arg) {
    const fromFile = readEnvFile(ENV_FILE).get(KEY) || "";
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || fromFile;
    if (!arg) {
      console.log("用法：pnpm token <你的 GitHub token>   （或 pnpm token --status）");
      console.log("");
    }
    show(
      token
        ? `当前凭据来自${process.env.GITHUB_TOKEN || process.env.GH_TOKEN ? "环境变量" : ".env.local"}（尾号 ${token.slice(-4)}）`
        : "当前无凭据（未认证）",
      await verify(token),
    );
    if (!token) {
      console.log("\n未认证时搜索 10 次/分、核心 60 次/时；认证后 30 次/分、5000 次/时。");
    }
    return;
  }

  const token = arg.trim().replace(/^["']|["']$/g, "");
  if (!/^[A-Za-z0-9_-]{20,}$/.test(token)) {
    fail("token 格式不对：应为一串 20 位以上的字母数字（github_pat_... 或 ghp_...）");
  }
  if (/\s/.test(token)) fail("token 里含有空白字符，复制时可能带进了换行或空格");

  console.log("· 校验中…");
  const info = await verify(token);

  // 保留 .env.local 里其它键，只更新/追加 GITHUB_TOKEN
  const map = readEnvFile(ENV_FILE);
  map.set(KEY, token);
  const body = [
    "# 本地凭据，已被 .gitignore 忽略（勿提交）",
    ...[...map].map(([k, v]) => `${k}=${v}`),
    "",
  ].join("\n");
  writeFileSync(ENV_FILE, body, { mode: 0o600 });
  try {
    chmodSync(ENV_FILE, 0o600);
  } catch {
    // 某些文件系统不支持，忽略
  }

  show(`已写入 ${ENV_FILE} 并验证通过`, info);
  console.log("\n下一步：pnpm sync --refresh   # 用认证配额重采，速度约为未认证的 3 倍以上");
}

main().catch((err) => fail(err?.stack || String(err)));
