import type { MetadataRoute } from "next";

import { absoluteUrl, DEMO_PATH, ROUTES } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({
    url: absoluteUrl(path),
    priority: path === DEMO_PATH ? 1 : 0.8,
  }));
}
