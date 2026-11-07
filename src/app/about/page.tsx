import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { JsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { SITE } from "@/lib/site";
import { meta, stats } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";

const description =
  "关于 DeepSeek 插件市场：收录范围、五维评分口径、数据更新方式、纠错流程，以及本站与 DeepSeek 官方的关系说明。";

export const metadata: Metadata = {
  title: "关于本站",
  description,
  alternates: { canonical: "/about" },
  openGraph: { title: "关于本站 · DeepSeek 插件市场", description, url: "/about" },
};

export default function AboutPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "首页", path: "/" },
          { name: "关于本站", path: "/about" },
        ])}
      />

      <section className="border-b bg-muted/20">
        <div className="shell py-10 md:py-14">
          <p className="eyebrow">About / 关于</p>
          <h1 className="mt-3 max-w-[22ch] text-[30px] leading-[1.12] font-semibold tracking-[-0.03em] md:text-[40px]">
            一个不靠 Star 数排序的插件目录
          </h1>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-[1.75] text-muted-foreground text-pretty">
            {SITE.brand} 是一个面向 DeepSeek Harness（DSH）的第三方中文插件目录。
            我们直接调用 GitHub API 把散落在各处的插件与技能收进同一套分类，并按公开口径自己打分。
          </p>
        </div>
      </section>

      <div className="shell grid gap-12 py-10 md:py-14 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-16">
        <article className="max-w-[74ch]">
          <h2 className="text-[19px] font-semibold tracking-[-0.02em]">收录范围</h2>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            上游生态快照共 {formatNumber(stats.upstreamTotal)} 个仓库。其中大量条目没有可读描述、没有安装说明，
            或者是提交后即弃的空壳。本站保留其中 {formatNumber(stats.total)} 个信号足够的条目：
            Skill {stats.skillCount} 个、Plugin {stats.pluginCount} 个。
          </p>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            不是「精选」才收录，而是「有信息可用于判断」才收录。被排除的条目通常缺一样东西：
            能说清它解决什么问题的描述，或者一条能跑起来的安装命令。
          </p>

          <h2 className="mt-9 text-[19px] font-semibold tracking-[-0.02em]">评分与排序</h2>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            五个维度（维护活跃、实用度、生态热度、上手便捷、信号质量）融合成 0–100 的实用分。
            默认排序按实用分而不是 Star，理由写在
            <Link href="/guide" className="mx-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
              评分方法
            </Link>
            里。没有任何付费位或人工置顶。
          </p>

          <h2 className="mt-9 text-[19px] font-semibold tracking-[-0.02em]">数据更新</h2>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            当前数据快照时间 <time dateTime={meta.generatedAt}>{formatDate(meta.generatedAt)}</time>。
            站点为纯静态构建：数据重建后整站重新生成，插件详情页在构建期预渲染为真实 HTML，
            因此搜索引擎与无 JS 环境都能直接读到内容。
          </p>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            构建流程见仓库 <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">scripts/</code> 目录：
            一份数据管线负责裁剪与聚合，一份索引脚本产出目录页所需的轻量检索数据。
          </p>

          <h2 className="mt-9 text-[19px] font-semibold tracking-[-0.02em]">纠错与提交</h2>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            插件失效、描述过时、评分不合理 —— 都可以提 issue。为提高处理效率，请附上插件名与可验证的证据
            （提交记录、报错日志、安装失败截图）。新插件提交也走同一个入口。
          </p>

          <h2 className="mt-9 text-[19px] font-semibold tracking-[-0.02em]">免责声明</h2>
          <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
            本站与 DeepSeek 官方无隶属关系，评分与分类均为本站依据公开字段整理，不代表官方评价。
            插件由各自作者维护，安装前请自行阅读其 README 与许可证；标注「含风险命令」的条目尤其需要逐字读一遍命令。
          </p>

          <div className="mt-10 rounded-xl border bg-card p-5">
            <p className="text-[13.5px] font-medium">技术栈</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.75] text-muted-foreground">
              Next.js App Router（静态导出）+ TypeScript + Tailwind CSS v4 + shadcn/ui。
              全站无客户端路由水合负担，目录页的检索索引单独按需加载。
            </p>
            <a
              href={SITE.repo}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline"
            >
              查看源码
              <ArrowUpRight className="size-3" />
            </a>
          </div>
        </article>

        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <dl className="rounded-xl border bg-card p-5 text-[12px]">
            {[
              ["收录条目", formatNumber(stats.total)],
              ["上游总量", formatNumber(stats.upstreamTotal)],
              ["Skill", String(stats.skillCount)],
              ["Plugin", String(stats.pluginCount)],
              ["平均实用分", String(stats.avgScore)],
              ["数据快照", formatDate(meta.generatedAt)],
              ["许可证", "MIT"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-[var(--hairline)] py-2.5 last:border-0">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-foreground/90 tnum">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      </div>
    </>
  );
}
