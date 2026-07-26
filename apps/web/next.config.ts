import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The site is served from blode.co/react-vello, not its own domain.
  basePath: "/react-vello",
  reactCompiler: true,
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
