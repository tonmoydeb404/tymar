import type { MetadataRoute } from "next";
import { sitePaths, siteUrl, staticRoutes } from "@/config/paths-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = staticRoutes.map((route) => ({
    url: siteUrl(route),
    lastModified: now,
    changeFrequency: "monthly",
    priority: route === sitePaths.home ? 1 : 0.8,
  }));

  return staticEntries;
}
