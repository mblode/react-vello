import { BASE_PATH } from "./routes";

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

export const rewriteDocsHtml = (html: string): string =>
  rewriteRootUrls(
    html
      .replaceAll(ASSET_URL_PATTERN, `$1${PUBLIC_ASSET_PREFIX}`)
      .replaceAll(`${DOCS_ORIGIN}/docs`, `https://blode.co${PUBLIC_DOCS_PATH}`)
      .replaceAll(DOCS_ORIGIN, `https://blode.co${PUBLIC_DOCS_PATH}`)
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
