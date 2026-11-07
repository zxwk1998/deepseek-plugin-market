import meta from "../../data/meta.json";

/**
 * 只导出快照时间（约 300B）。
 * 客户端组件需要它做相对时间，但绝不能经由 lib/data.ts 引入 ——
 * 那会把整份 plugins.json 打进浏览器包（实测首包会从 100KB 涨到 1.2MB）。
 */
export const SNAPSHOT: string = meta.generatedAt;
export const SNAPSHOT_DATE: string = SNAPSHOT.slice(0, 10);
