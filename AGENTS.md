# Repository Guidelines

This project is a Vite + TypeScript sandbox for experimenting with WebGPU pipelines via the `typegpu` library. Contributors should keep changes focused, reproducible, and easy to review so new GPU demos remain approachable.

## Project Structure & Module Organization

- `src/` holds all TypeScript modules; `main.ts` bootstraps the app and re-exports helpers from focused files such as `counter.ts`.
- `public/` contains static assets served verbatim, while `index.html` under project root references the Vite entry point (`src/main.ts`).
- `tsconfig.json` enforces strict ESM semantics; keep new utilities tree-shakeable by exporting pure functions and avoiding global mutations.

## Build, Test, and Development Commands

- `npm run dev` launches the Vite dev server with hot reload—use it for rapid WebGPU iteration.
- `npm run build` runs `tsc` type-checking followed by `vite build`; ensure it passes before requesting review.
- `npm run preview` serves the production bundle locally to validate GPU initialization on a realistic build.

## Coding Style & Naming Conventions

- Stick to 2-space indentation, TypeScript strict mode, and native ES modules (`import … from` paths relative to `src/`).
- Use `camelCase` for variables/functions, `PascalCase` for exported types/classes, and keep file names lowercase-hyphen or lowercaseCamel (e.g., `gpuPipeline.ts`).
- Co-locate small shader helper strings near their usage and document non-obvious GPU constants with inline comments.

## Testing Guidelines

- No automated test harness is configured yet; rely on `npm run build` for type coverage and manual verification in Chromium-based browsers with WebGPU enabled.
- When adding core math or buffer utilities, create lightweight assertion helpers under `src/__checks__/` and run them during `npm run dev` to avoid regressions.
- Record any manual test steps (browser, adapter, GPU) in PR descriptions so reviewers can replicate hardware-specific issues.

## Commit & Pull Request Guidelines

- Follow `<scope>: <imperative summary>` commits (e.g., `render: add camera uniforms`); keep body paragraphs for rationale and follow-up tasks.
- Each PR should describe the motivation, highlight affected files, note manual test environments, and include screenshots or short screencasts when UI output changes.
- Link related issues or TODOs so GPU experiments remain discoverable and cross-referenced.
