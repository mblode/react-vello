import { BASE_PATH } from "./routes.ts";

const DOCS_ORIGIN = "https://react-vello.blode.md";

/** Where the docs are published, from a reader's point of view. */
const PUBLIC_DOCS_PATH = `${BASE_PATH}/docs`;

/**
 * The docs origin emits root-relative asset URLs. Those resolve against
 * blode.co, which fronts many projects and has no route for them, so every
 * stylesheet and script 404s. Serving through a handler lets us repoint those
 * URLs at a path blode.co already forwards to us.
 *
 * The public segment is deliberately not `_docs` / `_next`: Vercel resolves
 * `_next/static/immutable/**` against this app's own build wherever those
 * segments appear, so the request never reaches this handler.
 */
const UPSTREAM_ASSET_PREFIX = "/_docs/_next/";
const PUBLIC_ASSET_SEGMENT = "_chunks";
const PUBLIC_ASSET_PREFIX = `${PUBLIC_DOCS_PATH}/${PUBLIC_ASSET_SEGMENT}/`;

const isAssetSlug = (slug: string[]): boolean =>
  slug[0] === PUBLIC_ASSET_SEGMENT;

/** Map a public path onto the path the docs origin actually serves. */
export const toUpstreamPath = (slug: string[]): string => {
  if (isAssetSlug(slug)) {
    return `${UPSTREAM_ASSET_PREFIX}${slug.slice(1).join("/")}`;
  }
  return slug.length ? `/docs/${slug.join("/")}` : "/docs";
};

const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "if-modified-since",
  "if-none-match",
  "range",
  "user-agent",
];

const getForwardHeaders = (request: Request): Headers => {
  const headers = new Headers();
  for (const header of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }
  return headers;
};

const normaliseHeaders = (
  source: Headers,
  ok: boolean,
  cacheable: boolean
): Headers => {
  const headers = new Headers(source);
  for (const header of ["content-encoding", "content-length", "link"]) {
    headers.delete(header);
  }
  if (!(ok && cacheable)) {
    for (const header of ["cdn-cache-control", "vercel-cdn-cache-control"]) {
      headers.delete(header);
    }
    headers.set("cache-control", "no-store");
  }
  return headers;
};

const ASSET_URL_PATTERN = new RegExp(`(["'(])${UPSTREAM_ASSET_PREFIX}`, "g");

const ROOT_URL_REWRITES: readonly (readonly [string, string])[] = [
  ["/llms.txt", `${PUBLIC_DOCS_PATH}/llms.txt`],
  ["/llms-full.txt", `${PUBLIC_DOCS_PATH}/llms-full.txt`],
  ["/favicon.ico", `${BASE_PATH}/icon.svg`],
  ["/icon0.svg", `${BASE_PATH}/icon.svg`],
  ["/icon1.png", `${BASE_PATH}/apple-icon.png`],
  ["/apple-icon.png", `${BASE_PATH}/apple-icon.png`],
];

const ROOT_URL_PATTERNS = ROOT_URL_REWRITES.map(
  ([from, to]) =>
    [
      new RegExp(`(["'(])${from.replaceAll(".", "\\.")}`, "g"),
      `$1${to}`,
    ] as const
);

const rewriteRootUrls = (html: string): string => {
  let result = html;
  for (const [pattern, replacement] of ROOT_URL_PATTERNS) {
    result = result.replaceAll(pattern, replacement);
  }
  return result;
};

/**
 * The docs are a blode.md tenant, and its `docs.json` `name` drives both the
 * title suffix and `og:site_name`. Behind this rewrite these pages are blode.co
 * paths, so Rule 9 wants the person in `og:site_name`: the product is already
 * in `og:title` ("Introduction · React Vello"), and repeating it there spends
 * the one slot in the card that could say who made the thing.
 *
 * Rewritten here rather than in `docs.json` because `name` feeds the title too.
 * Setting it to "Matthew Blode" would make every docs page read "Introduction ·
 * Matthew Blode" and leave nothing on the card naming the product, which is the
 * exact failure Rule 9's "Do Rule 8 first" section describes.
 *
 * This is a stopgap. The real home is a `seo.siteName` in blode.md, which would
 * fix every tenant at once; the schema at https://blode.md/docs.json has no
 * such key today, and `allmd`, `diffhub`, `dnd-grid` and `stratasync` all serve
 * their product name here for the same reason.
 *
 * Both copies are replaced: the rendered `<meta>`, and the one React
 * re-renders from the flight payload on hydration.
 */
export const HOST_SITE_NAME = "Matthew Blode";

/**
 * Matched on `og:site_name` alone, then the `content` attribute is replaced
 * inside whatever matched. An earlier version required `property` before
 * `content` in one pattern: if the platform ever emits them the other way the
 * regex matches nothing, rewrites nothing, and the old value ships while any
 * assertion phrased as "the new value is present" still passes.
 */
const OG_SITE_NAME_META = /<meta\b[^>]*\bproperty="og:site_name"[^>]*>/giu;
const META_CONTENT_ATTR = /\bcontent="[^"]*"/iu;
const OG_SITE_NAME_FLIGHT = /\{[^{}]*\\"og:site_name\\"[^{}]*\}/gu;
const FLIGHT_CONTENT_ATTR = /\\"content\\":\\"[^"\\]*\\"/u;

const rewriteOgSiteName = (html: string): string =>
  html
    .replace(OG_SITE_NAME_META, (tag) =>
      tag.replace(META_CONTENT_ATTR, `content="${HOST_SITE_NAME}"`)
    )
    .replace(OG_SITE_NAME_FLIGHT, (node) =>
      node.replace(FLIGHT_CONTENT_ATTR, `\\"content\\":\\"${HOST_SITE_NAME}\\"`)
    );

/**
 * `twitter:creator` is absent from the upstream entirely: blode.md has no field
 * for it, so unlike `og:site_name` there is nothing to rewrite and the tag has
 * to be added. Rule 10 wants person-level attribution on every blode.co path,
 * and these are blode.co paths.
 *
 * Inserted into `<head>` only, not into the flight payload. Social crawlers do
 * not run JavaScript, so the served HTML is what builds the card; React may
 * drop the tag on hydration since it is not in the payload it renders from.
 * Adding it there too would mean hand-forging a serialized React element, which
 * is far more likely to break the page than to help it. The upstream `seo`
 * config is the real fix.
 */
const TWITTER_CREATOR = "@mattblode";
const TWITTER_CREATOR_META = /<meta[^>]*name="twitter:creator"[^>]*>/iu;
const HEAD_OPEN = /<head\b[^>]*>/iu;

const ensureTwitterCreator = (html: string): string => {
  if (TWITTER_CREATOR_META.test(html)) {
    return html;
  }
  return html.replace(
    HEAD_OPEN,
    (tag) => `${tag}<meta name="twitter:creator" content="${TWITTER_CREATOR}"/>`
  );
};

export const rewriteDocsHtml = (html: string): string =>
  ensureTwitterCreator(
    rewriteOgSiteName(
      rewriteRootUrls(
        html
          .replaceAll(ASSET_URL_PATTERN, `$1${PUBLIC_ASSET_PREFIX}`)
          .replaceAll(
            `${DOCS_ORIGIN}/docs`,
            `https://blode.co${PUBLIC_DOCS_PATH}`
          )
          .replaceAll(DOCS_ORIGIN, `https://blode.co${PUBLIC_DOCS_PATH}`)
      )
    )
  );

const rewriteLocation = (location: string): string => {
  if (location.startsWith(`${DOCS_ORIGIN}/docs`)) {
    return `https://blode.co${PUBLIC_DOCS_PATH}${location.slice(`${DOCS_ORIGIN}/docs`.length)}`;
  }
  if (location.startsWith("/docs")) {
    return `${PUBLIC_DOCS_PATH}${location.slice("/docs".length)}`;
  }
  return location;
};

export const proxyDocsRequest = async (
  request: Request,
  slug: string[]
): Promise<Response> => {
  const { search } = new URL(request.url);
  const upstream = new URL(`${toUpstreamPath(slug)}${search}`, DOCS_ORIGIN);

  const response = await fetch(upstream, {
    headers: getForwardHeaders(request),
    method: request.method,
    redirect: "manual",
  });

  const headers = normaliseHeaders(
    response.headers,
    response.ok,
    request.method === "GET"
  );

  const location = response.headers.get("location");
  if (location) {
    headers.set("location", rewriteLocation(location));
    return new Response(null, {
      headers,
      status: response.status,
      statusText: response.statusText,
    });
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("text/html")
    ? rewriteDocsHtml(await response.text())
    : response.body;

  return new Response(body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
};
