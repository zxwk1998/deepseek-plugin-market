/**
 * `node:sqlite` 的最小类型声明。
 *
 * 项目里的 @types/node 还停留在没有内置 SQLite 的版本，而运行时（Node ≥22.5）
 * 早就带了这个模块。只为用到的三个 API 补声明，比升级整套 @types/node 更可控 ——
 * 升级会顺带改动一堆无关的全局类型。
 */
declare module "node:sqlite" {
  interface Statement {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): unknown;
  }

  export class DatabaseSync {
    constructor(path: string, options?: { readOnly?: boolean; open?: boolean });
    prepare(sql: string): Statement;
    exec(sql: string): void;
    close(): void;
  }
}
