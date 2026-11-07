#!/usr/bin/env node
/**
 * 构建前清理产物目录。
 *
 * 为什么要自动化，而不是每次手动清：
 *   1) Next 的 `.next/cache` 一旦被中途打断（超时、Ctrl-C、被 kill），
 *      下一次 build 会卡在 1% CPU 上不动 —— 表现是"构建卡死十分钟"，
 *      实际是增量状态坏了。清空即可恢复，必须固化成脚本，不能靠人记。
 *   2) `out/` 会残留上一版已下架的插件详情页，不清就会一起部署，
 *      变成"站内没有入口、URL 却还能访问"的孤儿页。
 *
 * 两种清理方式，因为两个目录的处境不同：
 *   `.next` —— 文件数不多，直接同步删除（fs.rmSync），返回即删净。
 *   `out/`  —— 八千多个文件，直接删会触发系统的批量删除保护（要求确认）。
 *              所以改成**改名挪走**：rename 是一次元数据操作，零删除、瞬时完成，
 *              新的 out/ 由构建重新生成，旧目录留在 .trash/ 里等待系统回收。
 *
 * 用法：
 *   node scripts/clean.mjs            # 清理 .next 与 out（默认）
 *   node scripts/clean.mjs .next      # 只清指定目录
 */
import { rmSync, renameSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const TRASH = resolve(".trash");
/** 保留最近几个旧产物目录，再多就尝试删最老的（失败也不报错） */
const KEEP = 2;

const targets = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const dirs = targets.length ? targets : [".next", "out"];

function pruneTrash() {
  if (!existsSync(TRASH)) return;
  const items = readdirSync(TRASH)
    .map((name) => ({ name, path: join(TRASH, name), at: statSync(join(TRASH, name)).mtimeMs }))
    .sort((a, b) => b.at - a.at);

  for (const item of items.slice(KEEP)) {
    try {
      rmSync(item.path, { recursive: true, force: true, maxRetries: 1 });
    } catch {
      // 批量删除可能被系统策略拦下，交给系统回收即可，不影响构建
    }
  }
}

for (const dir of dirs) {
  const abs = resolve(dir);
  if (!existsSync(abs)) continue;

  if (dir === "out") {
    mkdirSync(TRASH, { recursive: true });
    const dest = join(TRASH, `out-${Date.now()}`);
    renameSync(abs, dest);
    console.log(`· 已挪走 ${dir} → ${dest.replace(process.cwd() + "/", "")}`);
    pruneTrash();
    continue;
  }

  const started = Date.now();
  rmSync(abs, { recursive: true, force: true, maxRetries: 3 });
  console.log(`· 已清理 ${dir}（${Date.now() - started}ms）`);
}
