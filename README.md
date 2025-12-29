<!--
Simple repo-level readme for react-wgpu.
-->

<div align="center">

# react-wgpu

**A React renderer sandbox for WebGPU experiments**

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

</div>

react-wgpu is a Vite + TypeScript workspace for experimenting with WebGPU pipelines in React.
It uses `typegpu` alongside a small Rust/WASM bridge to explore GPU-first rendering paths.

## Quickstart

```shell
pnpm install
pnpm dev
```

## Development

- `pnpm dev` - run all dev tasks (Vite app + TS watchers).
- `pnpm build` - typecheck and build the workspace.
- `pnpm --filter @react-wgpu/examples preview` - preview the production bundle.

## Project layout

- `packages/react-wgpu` - core React renderer.
- `packages/react-wgpu-types` - shared types.
- `packages/examples` - Vite demo app.
- `crates/rvello` - Rust/WASM renderer bridge.

## WebGPU support

WebGPU currently works best in Chromium-based browsers with WebGPU enabled.

## License

MIT. See [LICENSE.md](LICENSE.md).
