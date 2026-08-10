import type { MetadataRoute } from "next";

import { absoluteUrl, DEMO_PATH, ROUTES } from "@/lib/routes";

export default function sitemap(): MetadataRoute.Sitemap {
  // Stamped from the build's HEAD commit in next.config.ts. Prerendered routes
  // cannot read the clock, and the commit date is the more honest answer
  // anyway: it holds still across deploys that changed nothing.
  const lastModified = process.env.BUILD_COMMIT_DATE;

  return ROUTES.map((path) => ({
    url: absoluteUrl(path),
    ...(lastModified ? { lastModified } : {}),
    priority: path === DEMO_PATH ? 1 : 0.8,
  }));
}
