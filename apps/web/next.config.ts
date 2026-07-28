import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Keep the non-canonical hostnames out of the index.
   *
   * This app canonicalises to blode.co/react-vello, but it also answers on the
   * origin blode.co proxies to and on its *.vercel.app aliases. Those sit
   * inside the sc-domain:blode.co Search Console property, so left alone they
   * are a crawlable duplicate of the whole site.
   *
   * The discriminator is x-forwarded-host, NOT host: the multi-zone rewrite
   * proxies to the origin, so `host` is the origin for real blode.co traffic
   * too. x-forwarded-host keeps the hostname the client actually asked for,
   * which is blode.co when proxied. Matching on `host` would noindex the
   * live site.
   */
  headers() {
    return Promise.resolve([
      {
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
        has: [
          {
            key: "x-forwarded-host",
            type: "header" as const,
            value: String.raw`.*\.zone\.blode\.co|.*\.vercel\.app`,
          },
        ],
        source: "/:path*",
      },
    ]);
  },
  // The site is served from blode.co/react-vello, not its own domain.
  basePath: "/react-vello",
  reactCompiler: true,
  // The Vite app wrapped its tree in <StrictMode>; Next leaves this off by
  // default, so set it explicitly to keep the double-invoke checks.
  reactStrictMode: true,
  // react-vello ships untranspiled ESM plus a wasm asset loaded through
  // `new URL(..., import.meta.url)`, which needs to go through the bundler.
  transpilePackages: ["react-vello"],
  experimental: {
    // The repo pins TypeScript 7, which drops the legacy compiler API Next
    // reaches for by default.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
