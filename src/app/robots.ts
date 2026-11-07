import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

/**
 * 允许全部主流搜索引擎抓取；显式声明 sitemap 位置。
 * 部署后请在 Google Search Console / Bing Webmaster / 百度搜索资源平台分别提交
 * `${SITE.url}/sitemap.xml`，收录速度取决于提交与外部链接，而不是 robots 配置。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: [] },
      // 抓取预算有限的中文搜索引擎，同样放行
      { userAgent: "Baiduspider", allow: "/" },
      { userAgent: "bingbot", allow: "/" },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
