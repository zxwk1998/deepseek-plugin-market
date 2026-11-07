<div align="center">

# DeepSeek 插件市场

**面向 DeepSeek Harness（DSH）的中文插件目录 —— 用五维评分替代 Star 数排行**

1,600 个插件与技能 · 中文简介 · 可直接复制的安装命令 · 安装风险提示

</div>

---

## 为什么不是又一个插件列表

插件生态的增长速度已经超过质量的增长速度。同一个「热门榜」里，既有维护良好的生产级工具，也有提交后再没动过的实验品。
安装本身不花时间，**装错之后排查的时间才是成本**。

所以本站的排序目标不是「发现更多」，而是「减少误装」：

| | 常见做法 | 本站做法 |
|---|---|---|
| 排序依据 | Star 数 | 五维实用分（维护活跃 / 实用度 / 生态热度 / 上手便捷 / 信号质量） |
| 分类 | 散装标签平铺 | 8 个意图分区，一个插件可属多个分区 |
| 详情页 | 一段简介 + GitHub 链接 | 评分拆解、置信度、中文简介、README 摘要、安装命令、风险提示、相关插件 |
| 渲染方式 | 客户端 SPA（首屏空 `<div>`） | 构建期预渲染全部页面，纯静态导出，搜索引擎与无 JS 环境可读 |
| 移动端 | 三列卡片挤成两列 | 行式目录 + 底部筛选抽屉，390px 宽度下可用 |

## 技术栈

- **Next.js 15**（App Router，`output: "export"` 纯静态导出）
- **React 19** + **TypeScript**
- **Tailwind CSS v4** + **shadcn/ui**（radix-nova 预设）
- 字体：`geist` 自托管（构建期不依赖 Google Fonts 网络）
- 数据：构建期读取 `data/plugins.json`，客户端检索走 `public/catalog.json` 轻量索引

## 本地开发

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

> `dev` / `build` 前会自动执行 `scripts/build-index.mjs` 重建检索索引，无需手动准备。

其他脚本：

```bash
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
pnpm build        # 静态导出到 out/
pnpm index        # 只重建 public/catalog.json
```

## 数据管线

数据不是"别人整理好的一份 JSON"，而是**每天直接从 GitHub 采集**：

```
GitHub Search API  →  collect-github.mjs  →  raw-github.json
                   →  build-data.mjs      →  plugins.json / meta.json
                   →  build-index.mjs     →  public/catalog.json
```

采集要跨过三个真实约束，都在 `scripts/collect-github.mjs` 里处理：

| 约束 | 处理方式 |
|---|---|
| Search API 单查询最多返回 1000 条 | 按 star 区间分段查询（`>=100` / `31..99` / `11..30` / `3..10` / `1..2` / `0`），段内翻页 |
| topic 检索有噪声，会带出无关的大项目 | 采集后过相关性闸门：topic 以 `dsh`/`cordis` 开头、名称含 dsh、描述含 deepseek harness，任一命中才算 |
| README 走 API 会爆配额（每仓库一次请求） | 改走 `raw.githubusercontent.com` 的 CDN 直读，只对评分靠前的仓库取 |

评分也由本项目自己算（`scripts/score.mjs`），输入全部是 GitHub 公开字段：

```
总分 = 维护活跃 0.25 + 实用度 0.25 + 生态热度 0.20 + 上手便捷 0.15 + 信号质量 0.15
```

生态热度取「star 折算分」与「npm 近月下载量折算分」中的**较大值**：
两个信号经常背离（有的插件 3 个 star、月下载 10 万），谁强看谁，不做加权求和。

每一维的判定都能回溯：推送距今多少天、README 里有没有可执行命令、是否要求 API Key、
是否出现 `curl | sh` / 全局安装这类风险形态。详情页展示的"为什么是这个分数"就是这些事实拼出来的。

```bash
pnpm sync                       # 采集 + 规范化 + 重建索引（需要 GITHUB_TOKEN，CI 自带）
pnpm sync --limit 1200          # 调整收录条数
pnpm sync --readme-top 800      # README 抓取数量（影响评分精度与耗时）
pnpm sync --dry-run             # 只采集校验，不写目录数据
pnpm sync --legacy              # 退回上游聚合快照（兼容旧流程，不推荐）

pnpm cc0                        # 拉 CC0 目录（中文简介 / 下载量 / 能力标注的富化源）
pnpm extra                      # 补采 CC0 里有下载量、但我们按 topic 检索漏掉的仓库
pnpm extra --min-downloads 500 --limit 3000 --concurrency 8
```

### 每日自动更新

这里的"每天更新"不是文案，是 `deploy-server.yml` 里的 cron 任务
（22:00 UTC = 次日 06:00 北京时间）：**采集 → 校验 → 构建 → 发布**。
构建放在 GitHub Actions 而不是服务器上：这台 2 核 / 1.7GB 的机器预渲染 2000+ 页面会 OOM。

三个刻意的设计取舍：

1. **校验优先于写入**。采集结果条目数低于下限、或缺 `repos` 数组，直接以非零状态退出。
   限流或查询失效时宁可让 job 失败，也不发布一个残缺的目录。
2. **失败即中止发布**。任一环节失败，CI 不部署，线上保留上一版可用站点。
3. **不把数据 commit 回仓库**。定时任务在 CI 工作区里采集、构建、直接发布，
   避免每天几百 KB 的数据变更把提交历史冲成噪音。仓库里的快照是"最后一次人工确认的基线"。

### 数据结构

```ts
interface Plugin {
  slug: string;          // URL 用，如 alchaincyf-nuwa-skill
  id: string;            // owner/repo
  type: "skill" | "cordis-plugin";
  score: {
    total: number;       // 0-100
    breakdown: { maintain; practical; popularity; ease; signal };
    confidence: number;  // 0-1，字段不全时下调
    explanation: string; // 人话理由
  };
  install: { method; needsConfig; risky; riskyReasons; commands };
  readme: string;        // 清洗后的纯文本，供详情页与 SEO 正文
}
```

## SEO

静态导出 + 预渲染是这套方案的地基，具体做了这些：

- 每个插件详情页在构建期生成真实 HTML（`generateStaticParams`），不是客户端渲染
- 每页独立 `title` / `description` / `canonical` / Open Graph / Twitter Card
- 结构化数据：`WebSite` + `SearchAction`、`SoftwareApplication`（含 `aggregateRating`）、
  `CollectionPage` + `ItemList`、`BreadcrumbList`、`FAQPage`
- `sitemap.xml` 动态生成（含全部插件 URL，`lastModified` 取仓库真实推送时间）
- `robots.txt` 显式声明 sitemap 与允许抓取
- 语义化 HTML：`h1` 唯一、`nav`/`article`/`aside` 区分、面包屑用 `<nav aria-label>`
- 目录页首屏 24 条由服务端预渲染，爬虫无需执行 JS 即可看到真实链接

**部署后还需要人做的一步**：把 `https://<你的域名>/sitemap.xml` 提交到
Google Search Console、Bing Webmaster Tools、百度搜索资源平台。
收录速度取决于提交与外部链接，robots 配置只是前提。

## 部署

### GitHub Pages（已内置工作流）

`.github/workflows/deploy.yml` 会在 push 到 `main` 时构建并发布到 Pages。
仓库 Settings → Pages → Source 选择 **GitHub Actions** 即可。

项目站点会自动带上子路径（`NEXT_PUBLIC_BASE_PATH=/<repo-name>`）；
绑定自定义域名时，把 `NEXT_PUBLIC_BASE_PATH` 置空、`NEXT_PUBLIC_SITE_URL` 设为完整域名。

### 任意静态托管

```bash
pnpm build       # 产物在 out/
```

`out/` 是纯静态目录，可直接丢给对象存储 / CDN / Nginx，无需 Node 运行时。

## 目录结构

```
data/                 目录快照（plugins.json / meta.json）
scripts/
  build-data.mjs      上游快照 → 本站数据（裁剪、清洗、slug、聚合）
  build-index.mjs     生成客户端检索索引 public/catalog.json
src/
  app/                路由：首页 / 插件目录 / 详情 / 分类 / 评分方法 / 关于
  components/         业务组件（卡片、评分可视化、目录筛选）
  components/ui/      shadcn/ui 基础组件
  lib/                数据访问、检索逻辑、分类体系、SEO 构造器
```

## 免责声明

本项目与 DeepSeek 官方无隶属关系。评分、分类与中文简介均为第三方整理，不代表官方评价。
插件由各自作者维护，安装前请阅读其 README 与许可证。

## License

MIT
