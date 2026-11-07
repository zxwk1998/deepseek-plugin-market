"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, Search, ArrowUpRight } from "lucide-react";
import { BrandLockup, GithubIcon } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { EXTERNAL_LINKS, NAV, SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // 滚动后加一条更实的分隔线，让 sticky header 与内容分离（不用阴影）
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl transition-colors",
        scrolled ? "border-border" : "border-transparent",
      )}
    >
      <div className="shell flex h-15 items-center justify-between gap-4">
        <div className="flex items-center gap-7">
          <Link href="/" aria-label={`${SITE.brand} 首页`} className="shrink-0">
            <BrandLockup />
          </Link>

          <nav aria-label="主导航" className="hidden items-center gap-1 lg:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors",
                  isActive(item.href)
                    ? "font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}

            {/* 竖线把"站内导航"和"站外站点"分开，避免误以为点了还在本站 */}
            <span aria-hidden className="mx-1.5 h-3.5 w-px bg-border" />

            {EXTERNAL_LINKS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-0.5 rounded-md px-2.5 py-1.5 text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
                <ArrowUpRight
                  className="size-3 opacity-40 transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
                <span className="sr-only">（在新窗口打开）</span>
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-1">
          <Link
            href="/plugins"
            className="mr-1 hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-foreground/25 hover:text-foreground sm:flex"
          >
            <Search className="size-3.5" />
            <span className="pr-8">搜索插件</span>
          </Link>

          <Link
            href={SITE.repo}
            target="_blank"
            rel="noreferrer noopener"
            className="hidden size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex"
            aria-label="GitHub 仓库"
          >
            <GithubIcon />
          </Link>

          <ThemeToggle />

          <Button
            asChild
            size="sm"
            className="ml-1 hidden h-8 bg-foreground px-3 text-background hover:bg-foreground/90 md:inline-flex"
          >
            <Link href="/plugins">浏览全部</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="lg:hidden" aria-label="打开菜单">
                <Menu className="size-4.5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px]">
              <SheetTitle className="sr-only">导航菜单</SheetTitle>
              <div className="mt-2 mb-6">
                <BrandLockup />
              </div>
              <nav aria-label="移动端导航" className="flex flex-col">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "border-b border-[var(--hairline)] py-3.5 text-[15px]",
                      isActive(item.href) ? "font-medium" : "text-muted-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href={SITE.repo}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 border-b border-[var(--hairline)] py-3.5 text-[15px] text-muted-foreground"
                >
                  <GithubIcon className="size-4" />
                  GitHub 仓库
                </Link>

                <p className="eyebrow mt-5 mb-1">相关站点</p>
                {EXTERNAL_LINKS.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setOpen(false)}
                    className="flex items-center justify-between py-3.5 text-[15px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {item.label}
                    <ArrowUpRight className="size-3.5 opacity-50" aria-hidden />
                  </a>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
