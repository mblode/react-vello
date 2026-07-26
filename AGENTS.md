# Repository Guidelines

## Project Structure & Module Organization
- `packages/react-vello/` is the React renderer library; source lives in `packages/react-vello/src/`, with the public entry at `packages/react-vello/src/index.ts` and WASM bindings under `packages/react-vello/src/wasm/`.
- `apps/web/` is the Next.js demo site served at `blode.co/react-vello`; routes live in `apps/web/app/`, shared scene and benchmark components in `apps/web/components/`, and static assets in `apps/web/public/`. `next.config.ts` sets `basePath: "/react-vello"`, so route paths in code carry no prefix — use `absoluteUrl()` from `apps/web/lib/routes.ts` for full URLs.
- `crates/rvello/` contains the Rust/WASM renderer; build artifacts are copied into the library via `packages/react-vello/scripts/copy-wasm.cjs`.
- `scripts/` holds shared workspace utilities such as `scripts/ensure-wasm.cjs`.
- `dist/` folders are generated outputs; do not edit them by hand.

## Build, Test, and Development Commands
- `pnpm dev` runs workspace dev tasks via Turborepo.
- `pnpm -C apps/web dev` starts the Next.js WebGPU demo at `http://localhost:3000/react-vello`.
- `pnpm -C apps/web build && pnpm -C apps/web start` serves the production build locally.
- `pnpm -C packages/react-vello build` builds the library and copies WASM assets into `dist/`.
- `pnpm build` runs all package builds (check-types + bundling).
- `pnpm check-types` or `pnpm lint` runs TypeScript `--noEmit` checks across packages.
- `pnpm test` is a placeholder; no automated suite yet.
- `pnpm wasm:build` / `pnpm wasm:watch` builds the Rust/WASM renderer with `wasm-pack`.

## Coding Style & Naming Conventions
- Use 2-space indentation, strict TypeScript, and native ESM imports.
- Keep utilities tree-shakeable and avoid global mutations.
- `camelCase` for values/functions, `PascalCase` for types/components.
- File names are lowercase-hyphen or lowerCamel (for example, `wasmBridge.ts`).
- Co-locate short shader/helper strings near usage and comment non-obvious GPU constants.

## Testing Guidelines
- There is no automated test framework; rely on `pnpm build` for type coverage.
- Manually verify in a Chromium-based browser with WebGPU enabled.
- For new math/buffer utilities, add lightweight checks under `packages/react-vello/src/__checks__/` and run them during `pnpm dev`.

## Commit & Pull Request Guidelines
- Git history is sparse; use `<scope>: <imperative summary>` going forward (for example, `render: add camera uniforms`).
- PRs should describe motivation, list affected areas, and note manual test environment (browser, adapter, GPU).
- Include screenshots or short screencasts when visuals change.
- For library changes that affect consumers, add a changeset in `.changeset/`.
