import type { Metadata } from "next";

import { absoluteUrl } from "@/lib/routes";

export const SITE_NAME = "React Vello";
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
