import { absoluteUrl, DEMO_PATH, SITE_ORIGIN } from "@/lib/routes";

/**
 * Stable schema.org `@id` anchors. The Person, Organization and WebSite ids
 * belong to blode.co and are only ever referenced here, never redefined:
 * blode.co/react-vello is a path on blode.co behind a rewrite, not a site of
 * its own, and a zone-scoped `#person` publishes a second Matthew Blode on the
 * same domain. Contract:
 * blode-co/apps/web/.claude/knowledge/zone-conventions.md
 */
const personId = `${SITE_ORIGIN}/#person`;
const websiteId = `${SITE_ORIGIN}/#website`;
const orgId = `${SITE_ORIGIN}/#organization`;

const siteUrl = absoluteUrl(DEMO_PATH);

const webPageId = `${siteUrl}/#webpage`;
const softwareId = `${siteUrl}/#software`;
const breadcrumbId = `${siteUrl}/#breadcrumb`;

const description =
  "Write 2D scenes as React components and draw them on the GPU. A custom reconciler turns the React tree into a Vello scene graph, rendered through WebGPU.";

/**
 * One `@graph`, not one script per node: disconnected blocks cannot be merged
 * into a single entity, so they describe unrelated things.
 *
 * `SoftwareSourceCode` rather than `SoftwareApplication`. Google's Software App
 * rich result needs `offers` plus `aggregateRating` or `review`, and its review
 * guidelines forbid ratings you write about your own work, so the application
 * types could only ever fail validation here. This is an open-source renderer
 * you install from npm; source code is what the page actually shows.
 */
export const zoneRootJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": webPageId,
      "@type": "WebPage",
      about: { "@id": softwareId },
      breadcrumb: { "@id": breadcrumbId },
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": websiteId },
      name: "React Vello",
      url: siteUrl,
    },
    {
      "@id": softwareId,
      "@type": "SoftwareSourceCode",
      author: { "@id": personId },
      codeRepository: "https://github.com/mblode/react-vello",
      description,
      isAccessibleForFree: true,
      license: "https://opensource.org/licenses/MIT",
      name: "react-vello",
      programmingLanguage: ["TypeScript", "Rust"],
      publisher: { "@id": orgId },
      runtimePlatform: "React",
      url: "https://www.npmjs.com/package/react-vello",
    },
    // The trail starts at the blode.co root, not at this zone. It must read
    // identically to the visible trail in `components/zone-breadcrumb.tsx`,
    // down to the root crumb being the person rather than "Home", or Google
    // reads the mismatch as a markup error.
    {
      "@id": breadcrumbId,
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          item: `${SITE_ORIGIN}/`,
          name: "Matthew Blode",
          position: 1,
        },
        {
          "@type": "ListItem",
          item: `${SITE_ORIGIN}/projects`,
          name: "Projects",
          position: 2,
        },
        {
          "@type": "ListItem",
          item: siteUrl,
          name: "React Vello",
          position: 3,
        },
      ],
    },
  ],
};
