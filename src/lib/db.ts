import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { MarketMeta, Plugin } from "./types";

/**
 * 数据访问层：SQLite（data/site.db）。
 *
 * 为什么不是直接 import plugins.json：
 *   - 6MB JSON 进 bundle 会把构建产物撑大，而且数据一变就得重新构建；
 *   - SQLite 里按 slug 取一条是主键查询，数据更新只需替换一个文件再重启进程。
 *
 * 性能：全量列表（列表页、sitemap、首页统计）走一次性加载 + 进程内缓存。
 * 2500 条 × 约 2KB，常驻内存约 6MB，换来零查询开销。
 * 数据更新后由部署脚本重启进程，缓存自然失效。
 */
const DB_PATH = process.env.SITE_DB || resolve(process.cwd(), "data/site.db");
const JSON_PATH = process.env.SITE_JSON || resolve(process.cwd(), "data/plugins.json");
const META_PATH = resolve(process.cwd(), "data/meta.json");

type Row = { json: string };

let db: DatabaseSync | null = null;
let dbTried = false;
let allCache: Plugin[] | null = null;
let metaCache: MarketMeta | null = null;
let loadError: string | null = null;

function connect(): DatabaseSync | null {
  if (dbTried) return db;
  dbTried = true;
  if (!existsSync(DB_PATH)) return null;
  try {
    db = new DatabaseSync(DB_PATH, { readOnly: true });
  } catch {
    db = null;
  }
  return db;
}

/** 兜底：没有 SQLite 文件时直接读 JSON（CI 构建、本地首次跑都能用） */
function fromJson(): Plugin[] {
  if (!existsSync(JSON_PATH)) return [];
  return JSON.parse(readFileSync(JSON_PATH, "utf8")) as Plugin[];
}

export function allPlugins(): Plugin[] {
  if (allCache) return allCache;

  const conn = connect();
  if (conn) {
    try {
      const rows = conn.prepare("SELECT json FROM plugins ORDER BY score DESC, stars DESC").all() as Row[];
      allCache = rows.map((r) => JSON.parse(r.json) as Plugin);
      return allCache;
    } catch (err) {
      loadError = (err as Error).message;
    }
  }

  allCache = fromJson();
  return allCache;
}

export function findPlugin(slug: string): Plugin | undefined {
  // 列表已加载时直接走内存；否则用主键查询，避免为了一个详情页把 2500 条全解一遍
  if (!allCache) {
    const conn = connect();
    if (conn) {
      try {
        const row = conn.prepare("SELECT json FROM plugins WHERE slug = ?").get(slug) as Row | undefined;
        return row ? (JSON.parse(row.json) as Plugin) : undefined;
      } catch (err) {
        loadError = (err as Error).message;
      }
    }
  }
  return allPlugins().find((p) => p.slug === slug);
}

export function siteMeta(): MarketMeta {
  if (metaCache) return metaCache;

  const conn = connect();
  if (conn) {
    try {
      const row = conn.prepare("SELECT v FROM kv WHERE k = ?").get("meta") as { v: string } | undefined;
      if (row) {
        metaCache = JSON.parse(row.v) as MarketMeta;
        return metaCache;
      }
    } catch (err) {
      loadError = (err as Error).message;
    }
  }

  metaCache = existsSync(META_PATH)
    ? (JSON.parse(readFileSync(META_PATH, "utf8")) as MarketMeta)
    : ({ included: allPlugins().length } as MarketMeta);
  return metaCache;
}

/** 数据文件的修改时间：部署后可核对"线上是不是新数据" */
export function dataUpdatedAt(): string | null {
  try {
    const target = existsSync(DB_PATH) ? DB_PATH : JSON_PATH;
    return existsSync(target) ? statSync(target).mtime.toISOString() : null;
  } catch {
    return null;
  }
}

export function dataHealth(): { ok: boolean; error: string | null; source: "sqlite" | "json" } {
  const list = allPlugins();
  return { ok: list.length > 0, error: loadError, source: connect() ? "sqlite" : "json" };
}
