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
    // The repo pins TypeScript 7, which drops the legacy compiler API Next
    // reaches for by default.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
