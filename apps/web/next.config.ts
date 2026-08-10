import type { NextConfig } from "next";

import { ROUTES } from "./lib/routes";

const isDev = process.env.NODE_ENV === "development";

// Analytics is proxied through r.blode.co so tracker blockers do not drop it.
// Defaulted rather than left empty: an unset var would compile down to
// `connect-src 'self'`, which silently blocks PostHog outright — the exact
// state blode.co/dnd-grid shipped before this sweep.
const posthogOrigin =
  process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://r.blode.co";

// Headers that cannot change what renders. These go everywhere, including on
// the proxied docs.
const baseSecurityHeaders = [
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

const nextConfig: NextConfig = {
  // The site is served from blode.co/react-vello, not its own domain.
  basePath: "/react-vello",
  headers() {
    /*
     * Every matching rule applies in array order and a later one wins per
     * header key, so the catch-all comes FIRST and the CSP is layered on after
     * it. Listed last, a catch-all silently overwrites every rule above it.
     *
     * The catch-all is `/:path*` and not `/(.*)`: with `basePath` set Next
     * prefixes the source, and `/react-vello/(.*)` does not match the bare
     * `/react-vello` — the zone root, and the most-visited URL here. That miss
     * is live on blode.co/allmd and blode.co/stratasync today, where inner
     * pages carry the full policy and the landing page carries none.
     *
     * The CSP is then attached per route rather than in the catch-all, because
     * `/docs` is a reverse proxy onto blode.md and its markup is the
     * platform's, not this app's. Browsers intersect multiple CSP headers, so
     * a catch-all policy would keep blocking the upstream's own asset and
     * analytics hosts no matter what the proxy rewrites. Same carve-out
     * dnd-grid makes, for the same upstream.
     */
    return Promise.resolve([
      { headers: baseSecurityHeaders, source: "/:path*" },
      ...ROUTES.map((route) => ({
        // `ROUTES` paths are basePath-relative and "/" is the zone root.
        source: route,
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
        ],
      })),
    ]);
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
