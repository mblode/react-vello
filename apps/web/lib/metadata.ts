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

/** The product, for the places that are not `og:site_name`. */
const PRODUCT_NAME = "React Vello";

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

  // The layout's title template reaches `<title>` but not `og:title`: Next
  // resolves the card title against `openGraph.title.template`, which is a
  // different thing. Without this the share card for an inner page reads
  // "React DOM stress test" over "Matthew Blode" and never names the product.
  const cardTitle = `${title} | ${PRODUCT_NAME}`;

  return {
    // Not `{ absolute }`: that opted every inner page out of the layout's
    // "%s | React Vello" template, which is the one thing Rule 8 asks inner
    // pages to do. blode-co/apps/web/.claude/knowledge/zone-conventions.md
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      title: cardTitle,
      description,
      url,
      images: [{ url: OG_IMAGE }],
    },
    twitter: {
      card: "summary_large_image",
      // The layout sets this too, but a page-level `twitter` object replaces
      // the parent's wholesale rather than merging, so every route going
      // through this helper loses it. Same shape as the `og:site_name` loss
      // above: Rule 10, and the field most likely to be missing on an inner
      // route while the root looks fine.
      creator: "@mattblode",
      title: cardTitle,
      description,
      images: [OG_IMAGE],
    },
  };
}
