import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
    // 16.3: run the React Compiler through Turbopack's native Rust pass
    // instead of the Babel plugin, so no Babel step is needed in the build.
    turbopackRustReactCompiler: true,
  },
  // Vanity /docs → Blode.md. Sources are relative to basePath (/react-vello).
  // statusCode 301 (not permanent:true/308) — GSC change-of-address prefers 301.
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "https://react-vello.blode.md/docs",
        statusCode: 301,
      },
      {
        source: "/docs/:path*",
        destination: "https://react-vello.blode.md/docs/:path*",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
