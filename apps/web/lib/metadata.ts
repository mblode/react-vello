import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/routes";

/**
 * `og:site_name` is the person on every blode.co path, zones included: the 33
 * zones are one site, and the product name is already in `og:title`, so
 * repeating it there spends the only slot in the card that could say who made
 * the thing. Rule 9 of
 * blode-co/apps/web/.claude/knowledge/zone-conventions.md.
 */
export const SITE_NAME = "Matthew Blode";

export const OG_IMAGE = "/react-vello/opengraph-image.png";

/**
 * Page-level `openGraph` and `twitter` objects replace the layout's rather
 * than merging into them, so every page has to restate the shared image,
 * type, and card fields.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const url = absoluteUrl(path);

  return {
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title,
      description,
      url,
      images: [{ url: OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}
