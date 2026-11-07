import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { JsonLd, breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";
import { SCORE_DIMENSIONS } from "@/lib/taxonomy";
import { meta, stats } from "@/lib/data";
import { formatDate, formatNumber } from "@/lib/format";

const description =
  "DeepSeek 插件市场的五维评分口径：维护活跃、实用度、生态热度、上手便捷、信号质量分别衡量什么，以及怎样用分数做安装决策。";

export const metadata: Metadata = {
  title: "评分方法",
  description,
  alternates: { canonical: "/guide" },
  openGraph: { title: "评分方法 · DeepSeek 插件市场", description, url: "/guide" },
};

const FAQ = [
  {
    q: "高分插件一定好用吗？",
    a: "不一定。评分衡量的是「可用的证据是否充分」——维护是否活跃、文档是否完整、是否开箱即装，而不是「这个功能对你是否有用」。功能匹配度需要你自己判断，评分只负责排除明显不可用的选项。",
  },
  {
    q: "为什么有些几万 Star 的插件分数不高？",
    a: "Star 只反映生态热度这一维。如果仓库长期不推送、README 缺少可用命令，或安装需要额外的密钥与系统依赖，其余四维会把总分拉下来。在快速迭代的宿主上，这类插件失效的概率明显更高。",
  },
  {
    q: "Skill 和 Plugin 有什么区别？",
    a: "Skill 通常是遵循 SKILL.md 的提示词与脚本集合，安装方式是把仓库克隆到 skills 目录；Plugin 是宿主侧的代码扩展，通过 profile 安装并加载。卡片左上角的标记用来区分两者，因为它们解决问题的层次不同。",
  },
  {
    q: "「需要 API Key」是怎么判断的？",
    a: "依据仓库 README 与配置文件中是否出现模型供应商、密钥、环境变量等要求。标注为需要的插件，安装本身可能成功，但要真正跑起来还得自己准备凭据。",
  },
  {
    q: "收录标准是什么？数据多久更新一次？",
    a: `本站从一个覆盖 ${formatNumber(stats.upstreamTotal)} 个仓库的生态快照中，筛选出有明确中文/英文描述、信号足够的 ${formatNumber(stats.total)} 个条目。数据快照时间为 ${formatDate(meta.generatedAt)}，评分与简介会随快照重建。`,
  },
  {
    q: "可以付费让自己的插件排在前面吗？",
    a: "不可以。排序逻辑只看评分与 Star，没有任何人工干预位或付费位。编辑精选项由统一口径筛出，规则公开在本页。",
  },
];

export default function GuidePage() {
  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "首页", path: "/" },
            { name: "评分方法", path: "/guide" },
          ]),
          faqJsonLd(FAQ),
        ]}
      />

      <section className="border-b bg-muted/20">
        <div className="shell py-10 md:py-14">
          <p className="eyebrow">Methodology / 方法</p>
          <h1 className="mt-3 max-w-[20ch] text-[30px] leading-[1.12] font-semibold tracking-[-0.03em] md:text-[40px]">
            Star 数不能告诉你的事
          </h1>
          <p className="mt-4 max-w-[62ch] text-[14px] leading-[1.75] text-muted-foreground text-pretty">
            一个 8000 Star 但半年没推送的插件，在每周都在改协议的宿主上，很可能已经装不上了。
            本站用五个维度替代单一热度指标，把「还能不能用」这件事尽量量化。
          </p>
        </div>
      </section>

      <div className="shell grid gap-12 py-10 md:py-14 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="页内导航" className="hidden lg:block">
          <p className="eyebrow">本页目录</p>
          <ul className="mt-3 space-y-2 text-[12.5px]">
            {[
              { href: "#why", label: "为什么重排一遍" },
              { href: "#dimensions", label: "五个维度" },
              { href: "#how-to-use", label: "分数怎么用" },
              { href: "#data", label: "数据来源" },
              { href: "#faq", label: "常见问题" },
            ].map((item) => (
              <li key={item.href}>
                <a href={item.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <article className="min-w-0 max-w-[76ch]">
          <section id="why" className="scroll-mt-24">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">为什么要把插件重排一遍</h2>
            <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
              插件生态的增长速度远超过质量增长速度。同一个人气榜单里，既有维护良好的生产级工具，也有提交后就再没动过的实验品。
              对使用者来说，真正的成本不是安装，而是<b className="font-medium text-foreground">装错之后浪费的时间与信任</b>——
              配置半天发现不兼容、把密钥交给一个来路不明的脚本、或者装好之后发现它和你已有的插件抢同一个面板。
            </p>
            <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
              所以这里的排序目标不是「发现更多」，而是<b className="font-medium text-foreground">「减少误装」</b>。
              为此我们优先呈现四类信号：是否在维护、文档是否完整、安装是否需要额外条件、社区是否有真实使用痕迹。
            </p>
          </section>

          <section id="dimensions" className="mt-10 scroll-mt-24">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">五个维度分别衡量什么</h2>
            <ol className="mt-4 divide-y divide-[var(--hairline)] border-y border-[var(--hairline)]">
              {SCORE_DIMENSIONS.map((dim, i) => (
                <li key={dim.key} className="grid grid-cols-[36px_1fr] gap-3 py-4 md:grid-cols-[44px_150px_1fr]">
                  <span className="font-mono text-[11px] text-muted-foreground tnum">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-[14px] font-medium">{dim.label}</h3>
                  <p className="col-start-2 text-[13px] leading-[1.8] text-muted-foreground text-pretty md:col-start-3">
                    {dim.desc}
                  </p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-[12.5px] leading-[1.8] text-muted-foreground text-pretty">
              总分由五维融合而来，并在字段缺失、样本过少时下调置信度。置信度低的条目，分数仅供参考——
              详情页会同时给出置信度百分比，这是很多人忽略但很关键的指标。
            </p>
          </section>

          <section id="how-to-use" className="mt-10 scroll-mt-24">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">分数该怎么用，以及不该怎么用</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div className="rounded-lg border bg-card p-4">
                <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">建议</p>
                <ul className="mt-2.5 space-y-2 text-[12.5px] leading-[1.7] text-muted-foreground">
                  <li>· 先按分类缩小到你要解决的问题，再看分数</li>
                  <li>· 优先「开箱即用」：少一步配置就少一个失败点</li>
                  <li>· 详情页的置信度低于 60% 时，去仓库看最近提交</li>
                  <li>· 安装命令先读一遍，尤其带 <code className="font-mono text-[11.5px]">-g</code> 或 <code className="font-mono text-[11.5px]">curl | sh</code></li>
                </ul>
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">不要</p>
                <ul className="mt-2.5 space-y-2 text-[12.5px] leading-[1.7] text-muted-foreground">
                  <li>· 不要用分数替代功能匹配度判断</li>
                  <li>· 不要把 Star 数当质量证明</li>
                  <li>· 不要跳过「需要 API Key」提示直接装</li>
                  <li>· 不要在一个 profile 里堆十几个插件再排障</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="data" className="mt-10 scroll-mt-24">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">数据从哪来</h2>
            <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
              插件元信息（仓库名、Star、Fork、推送时间、许可证、README）全部来自 GitHub API 的公开字段；
              中文分类与标签由仓库 topic 映射整理；风险提示来自对 README 安装命令的形态识别。
              当前快照时间 <time dateTime={meta.generatedAt}>{formatDate(meta.generatedAt)}</time>，
              覆盖 {formatNumber(stats.upstreamTotal)} 个上游仓库，本站展示其中 {formatNumber(stats.total)} 个。
            </p>
            <p className="mt-3 text-[13.5px] leading-[1.85] text-muted-foreground text-pretty">
              本站与 DeepSeek 官方无隶属关系，评分不代表官方评价。
              <Link href="/about" className="mx-1 text-foreground underline decoration-border underline-offset-4 hover:decoration-foreground">
                关于本站
              </Link>
              说明了完整的收录与纠错流程。
            </p>
          </section>

          <section id="faq" className="mt-10 scroll-mt-24">
            <h2 className="text-[19px] font-semibold tracking-[-0.02em]">常见问题</h2>
            <dl className="mt-4 divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
              {FAQ.map((item) => (
                <div key={item.q} className="py-4">
                  <dt className="text-[13.5px] font-medium">{item.q}</dt>
                  <dd className="mt-1.5 text-[13px] leading-[1.8] text-muted-foreground text-pretty">{item.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-10 rounded-xl border bg-card p-5">
            <p className="text-[13.5px] font-medium">发现评分不合理，或者插件已经失效？</p>
            <p className="mt-1.5 text-[12.5px] leading-[1.7] text-muted-foreground">
              直接在仓库提 issue，附上插件名与证据（提交记录、报错日志）。我们按同一口径复核，并优先修正影响安装的情况。
            </p>
            <Link
              href="/about"
              className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-brand hover:underline"
            >
              查看纠错流程
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </article>
      </div>
    </>
  );
}
