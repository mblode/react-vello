<div align="center">

# react-vello

**A React renderer for GPU-accelerated 2D graphics using Vello**

[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE.md)

</div>

react-vello is a Vite + TypeScript workspace for experimenting with WebGPU pipelines in React.
It builds on Vello with `typegpu` and a small Rust/WASM bridge.

## Resources

- Vello: https://github.com/linebender/vello
- typegpu: https://github.com/un-ts/typegpu

## Quickstart

```shell
pnpm install
pnpm dev
```

## Development

- `pnpm dev` - run the Vite app with TS watching.
- `pnpm build` - typecheck and build the workspace.
- `pnpm --filter @react-vello/examples preview` - preview the production bundle.

## Project layout

- `packages/react-vello` - core React renderer.
- `packages/react-vello-types` - shared types.
- `packages/examples` - Vite demo app.
- `crates/rvello` - Rust/WASM renderer bridge.

## WebGPU support

WebGPU works best in Chromium-based browsers with WebGPU enabled.

## License

MIT. See [LICENSE.md](LICENSE.md).
