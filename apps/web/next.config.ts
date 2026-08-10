import { execFileSync } from "node:child_process";

import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/*
 * Committer date of the build's HEAD, ISO 8601, handed to the sitemap as
 * `lastmod`. These four routes shipped without one, so crawlers had no recrawl
 * signal at all.
 *
 * next.config runs in Node outside prerender, so shelling out to git here is
 * safe where reading the clock inside a route would not be. The commit date
 * rather than the clock is the point: a build timestamp moves on every deploy
 * and would claim all four pages changed when none did.
 *
 * Undefined if git is unavailable, in which case no `lastmod` is emitted. That
 * is the state these URLs are in today, so the fallback cannot regress them.
 */
const commitDate = (() => {
  try {
    return execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], {
      encoding: "utf-8",
    }).trim();
  } catch {
    return undefined;
  }
})();

// Analytics is proxied through r.blode.co so tracker blockers do not drop it.
// Defaulted rather than left empty: an unset var would compile down to
// `connect-src 'self'`, which silently blocks PostHog outright — the exact
// state blode.co/dnd-grid shipped before this sweep.
const posthogOrigin =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://r.blode.co";

/*
 * `'wasm-unsafe-eval'` is load-bearing here and is the whole reason this app's
 * policy differs from the other zones'. The renderer is Rust compiled to
 * WebAssembly and started through `WebAssembly.instantiateStreaming`
 * (packages/react-vello/src/wasm/rvello.js). Once any `script-src` is present,
 * Chrome requires an explicit wasm token to compile a module at all, so a
 * policy copied from a zone that ships no wasm blanks every scene on the page
 * and every benchmark route with it.
 *
 * `blob:` in `worker-src` and `img-src` covers wasm-bindgen's worker and the
 * canvas readbacks the benchmarks use.
 *
 * Proxied `/docs` gets the same policy. Upstream blode.md ships no CSP, and
 * the proxy rewrites platform assets onto same-origin `/docs/_chunks/...`
 * paths, so `'self'` covers scripts, styles, and fonts. Stratasync applies its
 * zone CSP the same way via a catch-all — carving docs out left them with
 * every other security header and no Content-Security-Policy at all.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""} ${posthogOrigin}`,
  `connect-src 'self' ${posthogOrigin}`,
  "img-src 'self' data: blob:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  // The site is served from blode.co/react-vello, not its own domain.
  basePath: "/react-vello",
  ...(commitDate ? { env: { BUILD_COMMIT_DATE: commitDate } } : {}),
  headers() {
    /*
     * Catch-all first (and only, today). The pattern is `/:path*` and not
     * `/(.*)`: with `basePath` set Next prefixes the source, and
     * `/react-vello/(.*)` does not match the bare `/react-vello` — the zone
     * root, and the most-visited URL here. That miss is live on
     * blode.co/allmd and blode.co/stratasync today, where inner pages carry
     * the full policy and the landing page carries none.
     */
    return Promise.resolve([{ headers: securityHeaders, source: "/:path*" }]);
  },
  reactCompiler: true,
  // The Vite app wrapped its tree in <StrictMode>; Next leaves this off by
  // default, so set it explicitly to keep the double-invoke checks.
  reactStrictMode: true,
  // react-vello ships untranspiled ESM plus a wasm asset loaded through
  // `new URL(..., import.meta.url)`, which needs to go through the bundler.
  transpilePackages: ["react-vello"],
  experimental: {
    // 16.3: run the React Compiler through Turbopack's native Rust pass
    // instead of the Babel plugin, so no Babel step is needed in the build.
    turbopackRustReactCompiler: true,
  },
};

export default nextConfig;
