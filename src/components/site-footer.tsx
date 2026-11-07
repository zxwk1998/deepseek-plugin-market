import Link from "next/link";
import { BrandMark, GithubIcon } from "@/components/brand";
import { CATEGORIES } from "@/lib/taxonomy";
import { NAV, SITE } from "@/lib/site";

import meta from "../../data/meta.json";

/** 只读 meta 快照，避免页脚把整份目录数据带进布局 */
const SNAPSHOT_DATE = meta.generatedAt.slice(0, 10);

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t">
      <div className="shell py-14">
        <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5">
              <BrandMark />
              <span className="text-[15px] font-semibold">{SITE.brand}</span>
            </Link>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground text-pretty">
              面向 DeepSeek Harness 的中文插件目录。用五维评分替代 Star 数排名，装之前先知道它会做什么。
            </p>
          </div>

          <nav aria-label="站点导航">
            <h2 className="eyebrow mb-3.5">导航</h2>
            <ul className="space-y-2.5 text-[13px]">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/about" className="text-muted-foreground transition-colors hover:text-foreground">
                  关于本站
                </Link>
              </li>
            </ul>
          </nav>

          <nav aria-label="分类导航">
            <h2 className="eyebrow mb-3.5">分类</h2>
            <ul className="space-y-2.5 text-[13px]">
              {CATEGORIES.slice(0, 5).map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="外部链接">
            <h2 className="eyebrow mb-3.5">资源</h2>
            <ul className="space-y-2.5 text-[13px]">
              <li>
                <a
                  href={SITE.repo}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <GithubIcon className="size-3.5" />
                  本站源码
                </a>
              </li>
              <li>
                <a
                  href={`${SITE.repo}/issues/new`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  提交插件
                </a>
              </li>
              <li>
                <Link href="/guide" className="text-muted-foreground transition-colors hover:text-foreground">
                  评分方法
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--hairline)] pt-6 text-[12px] text-muted-foreground md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {SITE.brand} · 插件信息每日取自 GitHub API，评分与分类为本站整理
          </p>
          <p className="font-mono text-[11px] tracking-wide">
            MIT License · 每日 06:00 同步 · 快照 <time dateTime={SNAPSHOT_DATE}>{SNAPSHOT_DATE}</time>
          </p>
        </div>
      </div>
    </footer>
  );
}
