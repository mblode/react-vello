# prd.md — React + Vello (WebGPU) renderer

## Overview

Build a React renderer that lets developers write type‑safe JSX/TSX to describe a 2D scene graph which renders via WebGPU. The runtime targets Vello directly (Rust/WASM). Vello is a compute‑centric 2D renderer on `wgpu` and runs on the web via WebGPU. React integration is done through `react-reconciler`. ([Docs.rs][1])

React’s default DOM renderer is excellent for traditional UI, but it struggles when teams need deterministic frame budgets, access to raw GPU surfaces, or platforms that don’t expose the DOM at all. Custom renderers fill that gap by letting us keep React’s declarative ergonomics while targeting new hosts—WebGPU canvases, native view hierarchies, XR shells, even IoT hardware. This project embraces that pattern for high-throughput 2D scenes.

### Problem statement

- React teams producing data‑dense UIs cannot use WebGPU directly today without dropping to imperative Canvas/WebGL code or Rust glue, creating a steep learning curve and duplicate scene graphs.
- Advanced WebGPU features (custom shading, instancing, zero-copy buffers) are only exposed through low-level APIs today; React developers have to rebuild scene graphs in imperative code to benefit.
- The current ecosystem (e.g., CanvasKit, Rive runtimes) optimises for either static content or full widget systems; none expose a type‑safe, declarative bridge that stays close to React mental models while still hitting Vello/WebGPU performance.

### Goals

- Idiomatic React API for 2D vector graphics and text, rendered by WebGPU.
- Strong TypeScript types for JSX primitives, transforms, paints, and events.
- High performance on modern Chromium (and other browsers as WebGPU matures).
- Ergonomics similar to react‑three‑fibre and Ink: declarative components, hooks, imperative escape hatches. ([Poimandres Documentation][2])

### Non‑goals

- 3D rendering.
- Server‑side rendering of the canvas output.
- Full browser‑DOM interop beyond event bridging and optional ARIA overlays.

### Assumptions & constraints

- Tooling baseline is Vite + TypeScript; WASM artifacts are produced via `wasm-bindgen` and must stay under ~400 KB compressed per chunk to avoid slow cold starts on StackBlitz/CodeSandbox.
- React 18.3+ and the matching `react-reconciler` version are required; version drift is treated as a release blocker.
- MVP targets Chromium browsers with WebGPU enabled; Safari/Firefox support is aspirational and needs detection plus graceful degradation.
- SharedArrayBuffer ring buffers or worker renderer paths require cross-origin isolation (COOP/COEP) and explicit documentation for integrators.
- Native wgpu/winit hosts are out of scope; the renderer only targets browser WebGPU surfaces.

### Why a custom renderer?

- Default React DOM diffing cannot keep up with thousands of per-frame updates plus GPU-side layout, especially in streaming dashboards (e.g., live stock market heatmaps) or interactive canvases. A custom renderer lets us bypass DOM overhead entirely.
- Specialized hosts—including VR HUDs, native shells, or secure in-browser sandboxes—often forbid DOM access. The reconciler-only approach means the same JSX can target OffscreenCanvas/WebGPU workers with zero DOM dependencies.
- Declarative GPU scenes improve maintainability versus imperative WebGL code. Teams can share hooks/state between DOM panels and GPU primitives, rather than maintaining parallel scene graphs.
- Enhanced perf (higher frame rates, lower GC churn) and memory determinism unlock experiences that would otherwise require bespoke engines, keeping React viable in data viz, design tools, and simulation dashboards.

## Competitive landscape

| Solution | Strengths | Gaps for this product |
| --- | --- | --- |
| CanvasKit/Skia WASM | Production-ready text and path fidelity that mirrors Chrome; proven rendering quality; optional React wrappers exist internally. ([CanvasKit][17]) | Heavy (~2 MB+) WASM payload, imperative scene management, and Skia APIs that do not align with React’s declarative updates or TypeScript typing expectations. |
| Rive runtimes | Polished animation tooling with a designer-first workflow and battle-tested runtimes for Flutter/Web. ([Rive][18]) | Focused on timeline-driven assets, closed-source editor, and limited ability to express arbitrary data-visualization primitives or custom shaders from React. |
| PixiJS + React bridges | Massive ecosystem, sprite batching, filters, and accessibility plug-ins; React-Pixi offers JSX sugar. ([PixiJS][19]) ([react-pixi][20]) | Primarily WebGL2 today (WebGPU is experimental), lacks a retained diff-friendly scene representation, and JSX types are minimal compared to the strongly typed surface we need. |
| React Three Fiber | Sets the DX bar for declarative GPU scenes with hooks, suspense, and event parity. ([Poimandres Documentation][2]) | Targets 3D (Three.js); 2D primitives, text layout, and Vello/WebGPU integrations would require from-scratch authoring. |

- Differentiator: first-class 2D focus with Vello’s quality bar, React ergonomics, and WebGPU-native perf without forcing teams to author raw Rust/WebGL glue.
- Interop: we can still embed CanvasKit/Pixi layers via `<Image>` nodes for niche use cases, but keeping the primary API declarative avoids scene duplication.
- Positioning: pitch as “R3F for 2D data viz” so React teams instantly understand the mental model while unlocking WebGPU-class throughput.

---

## Real-world precedents & benefits

- **React Three Fiber** shows how a reconciler can wrap a GPU engine (Three.js) with idiomatic JSX, enabling declarative 3D scenes. We adopt the same playbook for 2D WebGPU.
- **React Native** demonstrates that React components can hydrate entirely different host elements (UIKit, Android Views) as long as the reconciler/host config speaks the right language.
- **React ART, React PDF, and React Hardware** highlight how renderers can target Canvas/SVG, PDF streams, or even microcontrollers—evidence that React’s model thrives beyond the DOM.
- **IoT/VR/AR shells**: custom renderers let teams reuse state + business logic while projecting UI into headsets, kiosks, or sensor dashboards that lack DOM APIs.

**Benefits relevant to this project**
- Declarative syntax + familiar hooks keep GPU pipelines maintainable.
- Code reuse: share components and state machines between DOM panels, shader-driven canvases, and documentation (e.g., PDF export paths).
- Ecosystem leverage: we still use Suspense, concurrent rendering, devtools, and the broader React tooling stack.
- Abstraction: teams focus on scene semantics while the renderer handles low-level WebGPU buffer management, diffing, and scheduling.

---

## Product scope

### Primary personas

- Front‑end engineers who prefer React and TSX but need GPU‑backed 2D.

### Use cases

- Data‑dense dashboards and charting surfaces that need thousands of animated primitives without DOM/SVG bottlenecks.
- Creative tooling (diagram editors, whiteboards, presentation apps) where designers already build React panels and expect hooks/state sharing with the canvas.
- Accessibility-sensitive design systems that need high-fidelity canvas graphics but still must expose semantics through AccessKit-driven overlays for screen readers.

### Platforms

- Web (WASM + WebGPU). wgpu provides a WebGPU backend on wasm; winit on the web uses a `<canvas>` surface. ([Docs.rs][3])

### Core capabilities

- Scene graph primitives: `<Canvas>`, `<Group>`, `<Rect>`, `<Path>`, `<Text>`, `<Image>`, `<LinearGradient>`, `<RadialGradient>`, `<Mask>`, `<ClipPath>`.

- Eventing: pointer down/up/move, wheel, click, hover, with hit‑testing and propagation.

- Text: paragraph layout, shaping, bidi, wrapping; custom fonts.

- Effects: opacity, blend, layers, gradients, clipping; (blur/filters when Vello exposes them fully). ([Docs.rs][1])

- Performance features: batched updates, incremental diffing, dirty regions, off‑main‑thread rendering via `OffscreenCanvas` (where available), optional `SharedArrayBuffer` command ring (requires cross‑origin isolation). ([MDN Web Docs][4])

---

## User journeys

### Dashboard engineer bootstraps a GPU canvas

1. Run `pnpm create react-vello` to scaffold the Vite template with WebGPU feature detection and example `<Canvas>` usage.
2. Drop in existing React state/hooks; render KPI tiles with `<Group>`, `<Rect>`, and `<Text>` primitives; wire pointer events into existing Zustand/Redux stores.
3. Enable the perf HUD to validate commit time budgets (<4 ms) before rolling into staging; document manual validation results in the QA checklist.

### Collaboration tool adds rich vector authoring

1. Embed `<Canvas>` alongside existing React panels so selection state, undo stacks, and multiplayer cursors reuse the app’s hooks.
2. Use `<Path>` and `<Mask>` to represent arbitrary whiteboard strokes, then persist the op buffer snapshot for history/timelines.
3. Toggle the worker renderer once COOP/COEP headers are enabled to keep brushes smooth even when sidebar components re-render.

### Accessibility lead validates screen-reader parity

1. Declare semantics on React nodes (e.g., `ariaRole`, `ariaLabel` props) that feed the AccessKit mirror.
2. Render DOM overlays via `@react-vello/accesskit` to expose focus rings and tab order without compromising canvas perf.
3. Capture narrated flows (Chrome + NVDA/VoiceOver) and attach recordings to the release QA template so regressions are traceable.

These journeys ensure adoption conversations stay grounded in day-to-day workflows rather than abstract benchmark wins.

## Architecture

### High‑level

- React layer: custom renderer implemented with `react-reconciler`. It builds a retained scene tree and emits a compact, batched op stream per commit. Note: `react-reconciler` is experimental and version‑coupled to React; pin versions. ([GitHub][5])
- WASM core (Rust): parse each op stream, build a `vello::Scene`, and render via `vello::Renderer` to a WebGPU surface/texture. ([Docs.rs][1])

### WebGPU path

- Use `wgpu` WebGPU backend under wasm; initialise a surface from a canvas (or `OffscreenCanvas` in a worker) and present frames. ([Docs.rs][3])

### Event model

- Phase 1: CPU hit‑testing (AABBs + path point‑in‑fill where feasible).
- Phase 2: GPU picking (ID buffer render pass). Similar ergonomics to R3F events. ([Poimandres Documentation][6])

### Text

- Text pipeline: use Vello’s glyph APIs and integrate Parley for shaping/line‑breaking. ([Docs.rs][7])

### Accessibility

- Canvas rendering needs explicit a11y overlays; provide an optional DOM layer mapping focusable nodes to DOM elements with ARIA.
- Ship a slim, web-only AccessKit mirror (`@react-vello/accesskit`) that exposes the same semantics tree API but serialises directly to DOM overlays, ensuring parity with native hosts without pulling the full toolkit stack. ([AccessKit][8])

### React-reconciler + Fiber background

- `react-reconciler` is the low-level package we use to build custom renderers. It exposes the host config surface (createInstance, appendChild, commitUpdate, etc.) and hands us control over how JSX elements map to host objects (WebGPU ops, DOM nodes, PDFs, hardware pins, …). We rely on it to translate React state updates into Vello op streams.
- The reconciler rides on React’s Fiber architecture, so our renderer automatically benefits from concurrent rendering, Suspense, transitions, and priority scheduling.
- **Fiber node anatomy:** each fiber stores the component type, key, pending props/state, and pointers (`child`, `sibling`, `return`) that form a tree mirroring our scene graph. We translate terminal nodes into GPU ops rather than DOM nodes.
- **Dual trees:** React keeps a work-in-progress fiber tree while reconciling updates and a committed tree representing what’s currently visible. When the commit phase completes, the WIP tree becomes the new committed tree—our renderer uses the committed snapshot to emit deterministic op buffers per frame.
- **Lifecycle summary:** initialize fiber (type/props), reconcile pending updates, render (build GPU ops), commit (apply updates + schedule WebGPU submission), cleanup (release resources, reuse fibers). We align Vello container lifecycles with these phases so batching and suspense work as expected.

### Custom renderer implementation playbook

1. **Bootstrap environment:** scaffold the monorepo (Vite examples + pnpm workspaces), install `react-reconciler`, and ensure the WASM toolchain targets `wasm32-unknown-unknown`.
2. **Host config:** implement the mandatory host config methods (`createInstance`, `appendChild`, `commitUpdate`, etc.). For now they build an in-memory scene tree; later we encode ops / call into WASM.
3. **Bridge entry point:** expose `createVelloRoot(canvas)` that calls `Reconciler.createContainer` and returns `{ render, unmount }`, mirroring `ReactDOM.createRoot`.
4. **Runtime + encoder:** sanitize props, maintain a retained tree, and serialize primitives into a compact binary format (`BeginFrame`, `Rect`, …). The Canvas2D preview renderer uses the same tree to draw a fallback visualization.
5. **WASM/WebGPU layer:** in Rust, decode the op buffer, rebuild a `vello::Scene`, and submit it to a WebGPU surface. We currently support Canvas + OffscreenCanvas targets, resizing, and basic error recovery.
6. **App integration:** swap `ReactDOM.createRoot` for the custom renderer in the example app, then progressively light up host config functionality until the default React SPA renders via the new pipeline.

### Distribution & packaging

- `@react-vello/runtime`: React renderer + host config; ships as pure ESM with typed JSX namespace.
- `@react-vello/wasm`: wasm-bindgen output packaged as an importable module, versioned in lockstep with `runtime`.
- `@react-vello/devtools`: optional overlay + telemetry panel (tree inspector, perf HUD) that is tree-shaken out of production builds.
- `@react-vello/accesskit`: lightweight AccessKit mirror for the web that converts semantics trees into DOM overlays.
- Rust crates mirror the npm packages (`rvello`) and are published simultaneously to avoid mismatched ABI expectations.
- Template: `create-react-vello` bootstraps Vite, installs the runtime + wasm packages, and scaffolds WebGPU feature detection helpers.
- Fonts: MVP expects user-provided font files loaded via `FontFace`; we provide a CLI helper that prepackages fonts into asset bundles but no hosted CDN (keeps licensing clear and avoids privacy concerns).
- Bundlers: ship a lightweight Vite/Rollup plugin that rewrites `import "@react-vello/wasm"` into an async instantiation helper so consumers avoid manual WASM loader plumbing.

### Monorepo architecture with Turborepo

- **Workspace structure:** pnpm workspaces define the package topology; Turborepo orchestrates builds and caches outputs.
- **Task pipelines:** `turbo.json` declares dependencies (e.g., `react-vello#build` depends on `rvello#build`).
- **Caching strategy:**
  - WASM builds (slow, infrequent changes): aggressive caching with Rust source + Cargo.lock as inputs
  - TypeScript builds: standard caching with source + tsconfig as inputs
  - Tests: cache based on source + test files
  - Remote cache: Vercel or self-hosted for CI and team sharing
- **Incremental adoption:** Start with basic `build`/`dev` tasks; add `test`, `lint`, `typecheck` in Phase 10
- **Filtered builds:** Use `--filter` to build only affected packages on PRs; reduces CI time significantly
- **Dev mode:** `turbo dev` runs all package dev servers concurrently with proper dependency ordering

---

## Detailed technical requirements

- React API surface: typed JSX elements matching the scene graph; controlled updates via props; refs to imperative handles (e.g. screenshot, readPixels).
- Hooks: `useFrame` (per‑tick work), `useResource` (images/fonts), `useMeasure` (canvas-relative bounds for overlays/devtools).
- Resource lifecycle: image/font caching, async loading with Suspense integration.
- WASM bridge: single call per commit with a binary op buffer (e.g. CBOR/FlatBuffers). If COOP/COEP is enabled, support `SharedArrayBuffer` ring to avoid GC churn. ([web.dev][9])
- Rendering loop: requestAnimationFrame on main thread; worker loop when using `OffscreenCanvas`. ([MDN Web Docs][4])
- Build tooling: Vite dev server with hot reload, wasm-bindgen output checked into `public`/`src/wasm`; CI enforces deterministic builds and produces ES module + `<script type="module">` friendly bundles.
- Telemetry hooks: lightweight instrumentation for commit time, GPU frame time, and WASM memory usage surfaced via optional devtools overlay/logging API so DX issues can be reported with measurements.
- Browser support: feature detect WebGPU; provide a helpful error on unsupported engines; test on Chrome/Edge first, then other engines as their implementations stabilise. ([Docs.rs][3])

---

## Observability & telemetry

- Perf counters: capture commit duration, WASM render time, GPU queue submit/present time; expose via `usePerfStats()` hook and devtools HUD.
- Logging: structured logs emitted through `console.debug` (dev) and optional user-provided sink (prod) with log levels to avoid spamming consoles.
- Crash reporting: wrap WASM entrypoints to surface Rust panics with symbolicated stack traces (via `console_error_panic_hook`) and actionable guidance.
- GPU traces: add an opt-in `captureFrame()` helper that tags wgpu command buffers so Chrome’s WebGPU inspector/PIX captures map ops to React elements.
- Feature flags: environment variables (`REACT_VELLO_ENABLE_TELEMETRY`) guard dev overlays so bundles stay tree-shakeable.
- Devtools surface: Chrome extension-style panel deferred to Phase 9; MVP relies on in-canvas overlay toggled with `Ctrl+Shift+L`.

---

## Phased delivery plan

### Phase 0 — Research & RFCs

- [x] Survey Vello APIs (Scene, Renderer, RenderParams; peniko/kurbo types). Document capabilities and gaps (filters/blur status). ([Docs.rs][1])
- [x] Survey `wgpu` on web, winit’s web target, and differences from native backends. ([Docs.rs][3])
- [x] Survey `react-reconciler` host config surface and version coupling. Create upgrade policy. ([GitHub][5])
- [x] Decide initial backend parameters (Vello-only) and lock compatibility targets.
- [x] Draft public API (JSX/TS types) and event model RFC with examples akin to R3F. ([Poimandres Documentation][2])
      **Exit criteria:** Approved RFCs; risks logged; versions pinned.

#### Phase 0 findings

##### Vello API survey

- `vello::Scene`/`SceneBuilder` hold a retained display list that can be built on any thread, then rendered on the WebGPU queue. `SceneBuilder` exposes `push_layer`, `pop_layer`, `append_path`, `append_text_run`, and `append_gradient` for compositing; each mutates an internal stack so it maps neatly to React tree diffs. ([Docs.rs][1])
- `Renderer::new(device, queue, RendererOptions)` plus `Renderer::render_to_surface(surface, &mut Scene, &RenderParams)` is the hot path we will call from WASM. The renderer stays resident; we reuse the same `Scene` and feed partial updates via op-stream diffing.
- `RenderParams` (width, height, base_color, antialiasing_method, time) allow us to express DPR, clear colour, and animation ticks without reconfiguring the surface.
- Geometry + paints flow through `peniko` (`Color`, `Brush`, `GradientStops`) and `kurbo` (`Rect`, `Affine`, `BezPath`). Vello 0.6.0 already supports layered opacity stacks, complex paths, instanced gradients, stroke/fill rules, and glyph runs sourced from the `vello_glyph` crate. ([Docs.rs][1])
- Text: glyph buffering + shaping hooks exist via `vello_text`; we plan to feed it with Parley layout data so kerning, bidi, and wrapping stay deterministic. ([Docs.rs][7])

**Gaps / risks**

- Filters/blur and advanced blend modes remain experimental in 0.6.0; we should expose API hooks behind feature flags but default to no-op until stable. ([Docs.rs][1])
- Image color spaces beyond sRGB and advanced sampling (mip bias, anisotropy) are not yet surfaced.
- Scene building is single-threaded and requires linear command recording; decoding minimal op streams is critical to avoid GC churn.
- CPU hit-testing must be implemented on the JS side for Phase 0/1; Vello does not expose a picking buffer.

##### `wgpu` + winit (wasm) survey

- `wgpu` 27.0.1 is WebGPU-spec compliant on `wasm32-unknown-unknown` and uses `web-sys` bindings. We create the surface via `Instance::create_surface(&winit::window::Window)` and configure it with `SurfaceConfiguration` targeting `TextureFormat::Bgra8Unorm`. ([Docs.rs][3])
- WebGL backends are disabled; only the WebGPU backend ships on wasm. That means no automatic fallback—our feature probe must gate the React renderer and show an instructional overlay when unavailable.
- Timestamp queries, pipeline statistics, and memory barriers differ: WebGPU disallows timer queries today, so our perf HUD must rely on JS `performance.now()` instrumentation.
- Limits default to the browser’s `supported_limits`; we should only request `maxStorageTexturesPerShaderStage = 8` and `maxBindGroups = 4` to stay within Chrome’s default. BC/ETC texture compression is opt-in; we can feature-detect for sprite sheets later.
- winit 0.30’s web target wraps a `<canvas>` and re-routes DOM events. Instead of the blocking `run`, we call `EventLoopExtWebSys::spawn_app` so the event loop is pumped via `requestAnimationFrame`. Pointer events, keyboard, and wheel map to winit events but still require us to keep DOM listeners alive for gesture semantics. ([Docs.rs][14])
- Differences vs native:
  - No `pollster::block_on`—all futures must be driven via `wasm_bindgen_futures::spawn_local`.
  - `Window::request_redraw` only sets a flag; actual presenting must happen inside the RAF callback to avoid throttling on background tabs.
  - `OffscreenCanvas` + worker surfaces need cross-origin isolation upfront; Safari TP still lacks it, so we will keep worker mode experimental.

##### `react-reconciler` host config + upgrade policy

- Host config choices:
  - `supportsMutation = true`, `supportsPersistence = false`, `supportsHydration = false`.
  - Provide `detachDeletedInstance`, `appendInitialChild`, `removeChild`, and `commitUpdate` handlers that simply enqueue op-buffer mutations; actual GPU work happens after `commitRoot`.
  - Use `scheduleTimeout`/`cancelTimeout` backed by `setTimeout` for passive effects; React 18.3’s concurrent rendering already batches microtasks, so no custom `scheduleMicrotask` is required.
  - Text nodes become lightweight scene items; we translate them to Parley layout nodes instead of DOM text instances.
- Version coupling & policy:
  - Pin to `react@18.3.1`, `react-dom@18.3.1`, and `react-reconciler@0.29.x` (latest stable tied to React 18). ([GitHub][5]) ([npm][12])
  - Add a Renovate/Changesets rule that only bumps React + reconciler together, behind a “renderer contract” test suite (host config type-check + integration harness).
  - Track React 19 betas on a `next` branch; only adopt when `react-reconciler@0.33+` publishes stable release notes and our tests confirm no breaking changes to mutation lifecycles.
  - Document that consumers must bring matching React versions; mismatched ranges throw during package init.

##### Backend parameters + compatibility targets

| Layer | Decision (Phase 0 lock) | Notes |
| --- | --- | --- |
| Rust toolchain | MSRV 1.78 (May 2024) | Needed for `wasm-bindgen` 0.2.92 and `wgpu` 27. |
| Target triple | `wasm32-unknown-unknown` | `wasm-bindgen` + `wasm-pack` pipeline, ESM output only. |
| Vello | `=0.6.0` | Latest release with stable gradients + text APIs; no Vulkan/GL backends needed on web. ([Docs.rs][1]) ([GitHub][13]) |
| wgpu | `=0.27.0` | Matches Vello requirements; uses WebGPU backend only. ([Docs.rs][3]) |
| winit | `=0.30.x` | Brings ergonomic web window + RAF integration. ([Docs.rs][14]) |
| wasm-bindgen | `=0.2.92` | First version with `wasm-bindgen-futures` fixes for `requestAnimationFrame`. |
| Browsers | Chromium 124+, Edge 124+, ChromeOS 124+, Safari TP fallback only | Aligns with manual validation matrix; Safari/Firefox must detect and warn. |
| GPU features | Baseline: `depth24plus`, `textureCompressionBC` (optional), `timestampQuery` (off) | Keep features minimal to maximise adapter coverage. |

##### Public API + event model RFC (draft)

**Component surface**

| Component | Purpose | Key props |
| --- | --- | --- |
| `<Canvas>` | Root provider that owns device, queue, and surface | `width`, `height`, `devicePixelRatio`, `colorSpace`, `onError`, `antialiasing` |
| `<Group>` | Transform/opacity stack node | `transform`, `opacity`, `blendMode`, `clipPath` |
| `<Rect>` / `<RoundedRect>` | Axis-aligned rectangles | `origin`, `size`, `radius`, `fill`, `stroke` |
| `<Path>` | Arbitrary geometry | `d`, `fillRule`, `fill`, `stroke`, `dash` |
| `<Text>` | Text spans and frames | `text`, `font`, `fontSize`, `lineHeight`, `align`, `maxWidth` |
| `<Image>` | Raster nodes | `src`, `width`, `height`, `fit`, `colorSpace`, `mipmaps` |
| `<LinearGradient>` / `<RadialGradient>` | Paint definitions | `stops`, `start`, `end`, `transform` |
| `<Mask>` / `<ClipPath>` | Reusable mask nodes | `children`, `id`, `bounds` |

All intrinsic elements share `NodeProps`:

```ts
type Vec2 = [number, number];
type Mat3 = [number, number, number, number, number, number];

interface NodeProps {
  id?: string;
  opacity?: number;
  transform?: Mat3;
  visible?: boolean;
  onPointerDown?: CanvasPointerHandler;
  onPointerMove?: CanvasPointerHandler;
  onPointerUp?: CanvasPointerHandler;
  onWheel?: CanvasWheelHandler;
  onClick?: CanvasPointerHandler;
}

type Paint = { kind: 'solid'; color: string } | { kind: 'gradient'; ref: string } | { kind: 'image'; nodeId: string };
```

**Event model**

```ts
interface CanvasPointerEvent {
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'click' | 'pointerenter' | 'pointerleave';
  pointerId: number;
  devicePixelRatio: number;
  position: Vec2;      // canvas-space (DPR adjusted)
  localPosition: Vec2; // node-space after inverse transforms
  buttons: number;
  modifiers: { alt: boolean; ctrl: boolean; shift: boolean; meta: boolean };
  target: SceneNodeHandle;
  stopPropagation(): void;
  preventDefault(): void;
  capturePointer(pointerId: number): void;
  releasePointerCapture(pointerId: number): void;
}
```

- Events bubble from leaf -> ancestors mirroring R3F; the reconciler keeps a lightweight parent chain to support `stopPropagation`.
- Hit-testing order: (1) rect/rounded-rect AABB, (2) path winding test via CPU, (3) text glyph bounds. A GPU ID buffer pass can replace step 2+ later.
- Wheel events coalesce using the RAF timestamp to avoid saturating the main thread.

**Hooks + imperative API**

- `useCanvas()` exposes device metrics, DPR, frame stats, and `requestFrame()` for imperative animations.
- `useResource(<Image src=...>)` returns an `ImageHandle` that resolves when the WASM upload is complete; components can suspend while resources load.
- `<Canvas ref={canvasRef}>` exposes `{ readPixels, screenshot, toJSON }` for debugging/serialization.

**Example usage**

```tsx
<Canvas width={1280} height={720} devicePixelRatio={window.devicePixelRatio}>
  <Group transform={[1, 0, 0, 1, 200, 120]} opacity={0.95}>
    <Rect
      id="card"
      origin={[0, 0]}
      size={[640, 360]}
      radius={24}
      fill={{ kind: 'gradient', ref: 'warmGradient' }}
      onPointerMove={(e) => setHover(e.localPosition)}
    />
    <Text
      id="title"
      text="Hello Vello"
      font={{ family: 'Inter', weight: 600 }}
      fontSize={48}
      fill={{ kind: 'solid', color: '#fff' }}
      onClick={() => console.log('clicked')}
    />
  </Group>
  <LinearGradient id="warmGradient" start={[0, 0]} end={[1, 1]} stops={[
    { offset: 0, color: '#ff8a00' },
    { offset: 1, color: '#e52e71' },
  ]} />
</Canvas>
```

This API mirrors familiar React scene graphs (similar to R3F) while remaining close to Vello primitives, keeping the runtime tree-shakeable and type-safe.

### Phase 1 — Repo scaffolding & toolchain

- [x] **Monorepo setup with Turborepo:**
  - [x] Initialize Turborepo with workspace configuration (`pnpm-workspace.yaml`, `turbo.json`, shared scripts in package.json).
  - [x] Define package structure:
    - `packages/react-vello` — React renderer (TS)
    - `packages/react-vello-types` — Shared TypeScript types
    - `packages/examples` — Demo applications
    - `crates/rvello` — Core WASM bindings
  - [x] Configure turbo.json with task pipelines: `build`, `dev`, `test`, `lint`, `typecheck`.
  - [x] Set up task dependencies: `^build` ensures dependent packages run first; WASM builds remain a manual `pnpm wasm:build` until the JS shim lands in the workspace.
  - [x] Configure remote caching (Vercel token-based) — `turbo` reads `TURBO_TEAM` and `TURBO_TOKEN`; falls back to local cache when unset.
- [x] **Build system:**
  - [x] WASM: `wasm-bindgen` + `wasm-pack` with ESM output ([Wasm Bindgen][10]) — `pnpm wasm:build` drives `crates/rvello` via wasm-pack; `pkg/` artifacts tracked by Turbo outputs.
  - [x] React packages: Vite for bundling/dev, TypeScript build targets share `tsconfig.base.json`.
  - [ ] Configure Turborepo caching for expensive WASM builds (need a custom `wasm` pipeline once the JS shim package exists).
  - [ ] Set up watch mode with turbo dev for hot reload (today we run `pnpm dev --filter @react-vello/examples` while renderer APIs bake).
- [x] **Package management:**
  - [x] pnpm workspaces (optimal with Turborepo).
  - [x] Shared tsconfig in root (ESLint/Prettier configs to follow).
  - [x] Version workspace protocol for inter-package dependencies (all internal deps use `workspace:*` to keep types and runtimes in lockstep).
- [x] **Developer experience:**
  - [x] Root package.json scripts: `turbo dev`, `turbo build`, `turbo test`.
  - [x] Feature detection + demo shell (WebGPU support check) — `packages/examples` renders adapter info and guidance.
  - [x] Example app scaffold that imports from workspace packages (type-only imports from `@react-vello/types` keep the TS compiler aware of shared props).
  - [x] VS Code workspace settings for debugging WASM (`.vscode/settings.json` preconfigures `wasm32` targets + wgsl highlighting).
      **Exit criteria:** `pnpm dev` runs examples with hot reload; WASM module loads; changes to any package trigger appropriate rebuilds; build cache hits on repeated builds.

#### Phase 1 execution plan

1. **Workspace + tooling bootstrap**
   - Run `pnpm init` + `pnpm dlx create-turbo@latest` to generate the turborepo skeleton, then prune unused apps so only the `packages/*` and `crates/*` structure remains.
   - Configure `tsconfig.base.json` with strict ESM, `"moduleResolution": "bundler"`, JSX `react-jsx`, and path aliases for `@react-vello/*`; share via `extends` in each package.
   - Add `.vscode/settings.json` that pins the TypeScript SDK (`"typescript.tsdk": "node_modules/typescript/lib"`) and enables Rust WASM target support (`"rust-analyzer.cargo.target": "wasm32-unknown-unknown"`).
2. **Caching + pipelines**
   - Extend `turbo.json` with a dedicated `wasm` pipeline: `"wasm": { "outputs": ["crates/rvello/pkg/**", "crates/rvello/target/wasm32-unknown-unknown/**"], "inputs": ["crates/rvello/src/**/*.rs", "crates/rvello/Cargo.toml", "Cargo.lock"] }`. Gate `build` on `^wasm`.
   - Teach the JS packages to depend on the WASM artifacts by adding `"dependsOn": ["wasm", "^build"]` to `packages/react-vello/turbo.json`.
   - Configure remote caching by setting `TURBO_TEAM`, `TURBO_TOKEN`, and documenting the `.env.local` format in `AGENTS.md`.
3. **Watch mode + scripts**
   - Create `turbo dev` tasks: `react-vello` runs `pnpm --filter @react-vello/react-vello dev` (tsup/watch), `examples` runs `vite`, and `rvello` runs `cargo watch -x "build --target wasm32-unknown-unknown"`.
   - Ensure file watching propagates through pnpm filters by enabling `TURBO_FORCE=true` for local dev sessions where the WASM crate needs rebuilds.
   - Document the dev workflow in `README`: `pnpm wasm:dev` (cargo watch) + `pnpm dev --filter @react-vello/examples`.
4. **DX validation**
   - Verify that editing `packages/react-vello/src/index.ts` triggers an incremental rebuild and hot reload in the example app within <2 seconds.
   - Confirm `pnpm build` caches Rust + TypeScript outputs; rerun to ensure Turbo hits cache (logs `cache hit, replaying output`).
   - Run `pnpm lint` (ESLint) and `pnpm typecheck` (tsc --noEmit) to guarantee baseline quality gates exist ahead of Phase 2.

Manual validation checklist:

1. `pnpm install` (fresh clone) finishes without peer warnings; `pnpm wasm:build` emits `crates/rvello/pkg`.
2. `pnpm dev` launches Turbo dev orchestrator; visiting http://localhost:5173 shows the WebGPU adapter info panel from `packages/examples`.
3. Modify a shared type (e.g., `packages/react-vello-types/src/canvas.ts`); confirm both React pkg and examples rebuild automatically.
4. Run `pnpm build` twice; second run must complete with ≥90 % cache hits and no WASM rebuild unless source files changed.
5. Record findings plus any perf anomalies in `docs/releases/<version>/phase-1-validation.md`.

#### Phase 1 implementation notes

- Workspace root now owns `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, and `tsconfig.base.json`, so every package inherits strict ESM + WebGPU typings. Shared path aliases expose `@react-vello/core` and `@react-vello/types` for both TypeScript tooling and bundlers.
- `packages/react-vello-types` contains the JSX surface defined in Phase 0 (Vec2/Mat3 aliases, paints, pointer events, intrinsic element map). Type generation currently emits declaration files via `tsc --emitDeclarationOnly`; publishing is disabled while the API settles.
- `packages/react-vello` exposes a placeholder `createVelloRoot` that wires up Canvas bookkeeping, DPR tracking, and future `react-reconciler` host config entry point. The stub logs renders but already aligns with the canvas/context contracts from the types package.
- `packages/examples` absorbed the previous Vite sandbox. The new landing page gates on `navigator.gpu`, surfaces adapter features, and documents Chrome/WebGPU enablement steps. It also compiles against workspace types to guarantee the example stays honest with the renderer props.
- `crates/rvello` ships a skeletal Rust/WASM crate with `RendererHandle` stubs plus panic-hook initialization to verify the wasm-bindgen toolchain. Root npm scripts invoke `wasm-pack` with `--target web`, so JS packages can later consume the generated `pkg/` artifacts.
- Developer quality-of-life: `.vscode/settings.json` preloads `rust-analyzer` for `wasm32-unknown-unknown`, wires Node debugging flags for WebGPU, and highlights `.wgsl` shader files. Turbo’s cache keys include `pnpm-lock.yaml` and the shared tsconfig to ensure reproducible builds across contributors.

### Phase 2 — Minimal viable renderer (Vello backend)

- [ ] Implement reconciler host config (mutation mode) and container lifecycle. ([GitHub][5])
- [ ] Define binary op buffer and encoder; single `apply(ops)` WASM entrypoint.
- [ ] Map primitives: Group, Rect, Path, Text (solid fill), Image (basic).
- [ ] Simple CPU hit‑testing for Rect; event dispatch with stopPropagation.
- [ ] Frame loop: rebuild full Vello Scene each commit; present to canvas.
- [ ] TypeScript typings for intrinsic elements; prop validation.
- [ ] Example: “Hello Vello” with interactive rect + text.
      **Exit criteria:** 60 FPS on a modest scene (<1k nodes) on Chrome; events work.

#### Phase 2 execution plan

1. **Host config + container bootstrap**
   - Implement `packages/react-vello/src/reconciler.ts` that wires `react-reconciler` with mutation helpers (`createInstance`, `appendInitialChild`, `prepareUpdate`, `commitUpdate`, `finalizeInitialChildren`, `removeChild`, `detachDeletedInstance`).
   - Container lifecycle lives in `createVelloRoot(canvas: HTMLCanvasElement, opts)`, returning `{ render, unmount }`.
   - Schedule passive effects via `setTimeout`; ensure no custom scheduler is required for MVP.
2. **Op buffer encoder (JS)**
   - Define a compact binary schema (u8 op codes + f32 payloads) under `packages/react-vello/src/ops`.
   - Provide ergonomic helpers (e.g., `pushRect`, `pushText`) that accept JSX props, normalize defaults, and write to a shared `ArrayBuffer`.
   - Serialize props deterministically to avoid diff churn; string props map to string tables hashed during a commit.
3. **WASM decoder + renderer (Rust)**
   - Add `apply_ops(ptr: *const u8, len: usize)` exported via wasm-bindgen that mutates a retained `SceneBuilder`.
   - Mirror the op schema in Rust enums; decode with minimal allocations (slice iterators + `bytemuck`).
   - Rebuild a full `vello::Scene` each frame, then call `Renderer::render_to_surface` inside `requestAnimationFrame`.
4. **Event bridge + hit-testing (JS)**
   - Maintain a lightweight scene graph mirror for hit-testing (bounds, transforms, z-order) so pointer events can walk ancestors.
   - Implement `dispatchPointerEvent` that reuses pooled event objects to minimize GC; integrate with React synthetic events contract when possible.
5. **Working example implementation**
   - Extend `packages/examples/src/App.tsx` with the `Hello Vello` demo (rect + text + interactive hover state).
   - Showcase prop updates (color/opacity) and pointer move events updating React state.
   - Document manual steps in `docs/examples/hello-vello.md` (Chrome 125+, expected FPS, fallback messaging when `navigator.gpu` is missing).

#### Working example spec

| Requirement | Details |
| --- | --- |
| Visuals | One rounded rect (“card”) with gradient fill and drop shadow approximation (layer opacity), plus a text label and optional icon image. |
| Interactions | Pointer move updates a local state hook to display coordinates; pointer down toggles selection, showcasing event propagation + `stopPropagation`. |
| Performance | Scene ≤25 nodes; renders at ≥60 FPS on Chrome 125 (M2 Pro / RTX 3070). Use Chrome DevTools performance tab to capture a 5‑second trace and record FPS in QA doc. |
| Error UX | If WebGPU unsupported, example surfaces an overlay with guidance (chrome://flags, GPU info) and links to docs. |
| Build/test | `pnpm dev --filter @react-vello/examples` starts Vite; `pnpm test --filter @react-vello/react-vello` runs unit tests for the encoder/host config. |

Manual validation script:

1. `pnpm install && pnpm wasm:build && pnpm dev --filter @react-vello/examples`.
2. Open http://localhost:5173, confirm adapter info + FPS counter render.
3. Interact with the rect/text; confirm hover state updates immediately and pointer capture works when dragging outside bounds.
4. Inspect DevTools console for warnings; none allowed other than intentional `navigator.gpu` guidance.
5. Capture a screenshot + short video for the release artifact folder (`docs/releases/<version>/hello-vello-demo.{png,mp4}`).

### Phase 3 — Text & font pipeline

- [ ] Integrate Parley shaping: paragraphs, wrapping, bidi, alignment. ([Docs.rs][7])
- [ ] Font loading: `FontFace` API on web; pass ArrayBuffer to WASM; font atlas cache.
- [ ] Text measurement and baseline utilities for layout.
- [ ] Rich text spans (weight/style/feature/variation). ([Docs.rs][11])
      **Exit criteria:** Correct shaping for complex scripts; deterministic metrics.

### Phase 4 — Eventing & picking

- [ ] Path hit‑testing (point‑in‑fill using winding; stroke width).
- [ ] Optional GPU ID buffer pass; resolve top‑most hit; throttle readbacks.
- [ ] Pointer capture, enter/leave, double‑click, wheel; event propagation.
- [ ] API parity with common R3F events where it makes sense. ([Poimandres Documentation][6])
      **Exit criteria:** Robust interactions on dense scenes; no jank on move/drag.

### Phase 5 — Performance & threading

- [ ] Incremental diffing of scene; dirty flags per node; subtree rebuild.
- [ ] Dirty region tracking; minimal repaint rectangles.
- [ ] Optional worker renderer via `OffscreenCanvas`; main‑thread event bridge. ([MDN Web Docs][4])
- [ ] Optional `SharedArrayBuffer` ring buffer path; docs for COOP/COEP. ([web.dev][9])
- [ ] Benchmarks (render time, commit time, memory) across browsers.
      **Exit criteria:** 60 FPS on 10k nodes (Chrome/desktop), smooth pointer move.

### Phase 6 — Effects & paints

- [ ] Gradients (linear/radial), opacity stacks, layers and masking.
- [ ] Clipping with arbitrary paths.
- [ ] Image sampling modes; nine‑slice; colour management basics.
- [ ] Track Vello features (filters/blur) and expose when stable. ([Docs.rs][1])
      **Exit criteria:** Visual parity with SVG basics; predictable blending/compositing.

### Phase 7 — Accessibility & DOM overlay (web)

- [ ] Optional DOM overlay for focusable nodes; ARIA roles/labels.
- [ ] Keyboard navigation; focus ring mirroring; tab order.
- [ ] Screen reader smoke tests on Chromium.
- [ ] Implement the `@react-vello/accesskit` mirror package that consumes AccessKit semantics, emits DOM nodes, and documents where the web overlay diverges from native implementations. ([AccessKit][8])
      **Exit criteria:** Basic screen‑reader narration for overlayed widgets.

### Phase 8 — DX, documentation, and examples

- [ ] API reference; “How it works”; recipes; migration guides.
- [ ] Examples: charts, editor, animations, data viz, hit‑testing demos.
- [ ] Error messages with guidance (WebGPU unsupported, COOP/COEP, fonts).
- [ ] Playground (StackBlitz/Vite) with live WASM import.

### Phase 9 — QA, release, and support

- [ ] **CI/CD with Turborepo:**
  - [ ] GitHub Actions workflow with Turborepo remote cache
  - [ ] Parallel job execution: lint, typecheck, test across all packages
  - [ ] WASM build caching to avoid rebuilds on unchanged Rust code
  - [ ] Matrix testing: Chrome/Edge stable; tech preview elsewhere
  - [ ] Visual regression tests with Percy/Chromatic integration
  - [ ] Publish workflow: affected packages only via `turbo run build --filter=[HEAD^1]`
- [ ] **Versioning & releases:**
  - [ ] Changesets for coordinated multi-package versioning
  - [ ] Pair `react-reconciler` with React majors; document policy ([npm][12])
  - [ ] Automated npm publish for TypeScript packages
  - [ ] Tag Rust crates on crates.io; changelog generation
  - [ ] Pre-release testing: canary builds on every PR

### Phase 10 — Tooling hardening & automation

- [ ] Expand `turbo.json` to gate `lint`, `test`, and `typecheck` stages; wire Vitest, ESLint, and `tsc --noEmit` into the workspace so every package is covered.
- [ ] Add Playwright/Chromium smoke tests that launch the examples app, load the WASM bundle, and validate frame counters + pointer events.
- [ ] Introduce `cargo clippy`/`cargo fmt` steps plus Wasm-bindgen ABI assertions in CI to prevent subtle Rust-side regressions.
- [ ] Enable code coverage reporting (Vitest + `grcov` for WASM) and fail PRs that regress more than 2 pp on critical paths (encoder, reconciler host config, event bridge).
- [ ] Configure required status checks (GitHub Actions + Turborepo remote cache) so `main` cannot advance without green JS/Rust pipelines and reproducible artifacts.
      **Exit criteria:** every push runs the full lint/test/typecheck/clippy matrix in <15 minutes with ≥90 % coverage on core packages; red builds block merges automatically.

### Phase 11 — Ecosystem enablement & templates

- [ ] Stabilise `create-react-vello` scaffolder with pluggable stacks (Vite, Next.js, Remix) and publish guides for hosting COOP/COEP headers.
- [ ] Ship Storybook + MDX example workspaces so design systems can document Vello scenes alongside React DOM components.
- [ ] Provide adapters for popular charting/data libs (e.g., Visx, Vega-Lite) that emit React-Vello primitives without forcing teams to re-author math.
- [ ] Publish official bindings for shared state libraries (Zustand, Jotai) showcasing idiomatic hooks and suspense-driven resource loading.
- [ ] Stand up a “playground gallery” in `packages/examples` with dozens of copy-pasteable recipes (text layout, gradients, worker mode, a11y overlay).
      **Exit criteria:** time-to-first-pixel from the CLI template <2 minutes; at least three partner teams (internal or external) ship pilots using the templates with documented feedback.

### Phase 12 — Advanced GPU features & research

- [ ] Prototype compute-driven instancing, signed-distance fields, and Vello filter hooks behind feature flags; document perf trade-offs.
- [ ] Explore multi-canvas compositing and render-to-texture flows so complex editors can layer effects without rebuilding full scenes.
- [ ] Implement GPU picking via ID buffers plus async readbacks, then benchmark against the CPU path to decide default heuristics.
- [ ] Investigate progressive loading + streaming for large images/fonts (Blob slicing + background decode) to reduce first-render stalls.
- [ ] Publish a public roadmap + RFC cadence so the community can propose new primitives, shaders, or runtime hooks with clear acceptance criteria.
      **Exit criteria:** at least two advanced features graduate from the research branch to stable (instancing or GPU picking), accompanied by benchmarks and migration notes.

## Release strategy

### Rollout stages

- **Pre-alpha (Phases 2–3):** Internal dogfooding inside the examples package; Vello op buffer locked, text pipeline validated with synthetic data sets, and perf HUD enabled by default. Ship nightly canaries for early adopters willing to pin to commit hashes.
- **Beta (Phases 4–6):** Open npm dist-tags (`beta`) with semver tracking, full pointer/picking coverage, gradient/effects pipeline, and docs that explain COOP/COEP + worker trade-offs. Bugs that break the QA matrix block promotion to release candidates.
- **General availability (Phases 7–9):** AccessKit overlay, full documentation site, CI-backed release pipeline, and deterministic `wasm-bindgen` artifacts published to npm + crates.io. GA requires at least two consecutive releases with zero P1 regressions and clean manual validation reports.

### Release readiness checklist

- QA matrix executed on Chromium/Edge + Safari TP fallback with screenshots or performance captures stored alongside release notes.
- Telemetry defaults double-checked (`REACT_VELLO_ENABLE_TELEMETRY=0` for prod bundles) and opt-in devtools tree-shaken for consumers.
- Docs versioned with the npm tag (new `/docs/vX.Y/` folder) so breaking changes include migration guides and Suspense/stability notes.
- Support rotation assigned for the release week (Discord/GitHub Discussions) with documented escalation paths to the WASM and reconciler owners.

### Operational considerations

- Use Changesets preview releases to gather ecosystem feedback before finalizing the ABI; clearly communicate planned breaking changes two releases ahead.
- Maintain an “adapter support” table (vendor, backend, min driver) in the docs so enterprise users can self-assess readiness without opening issues.
- Automate release notes by stitching Changesets summaries with perf telemetry deltas, ensuring each release calls out DX, rendering, and a11y impacts separately.

---

## API sketch (excerpt)

```tsx
<Canvas
  width={800}
  height={600}
  onCreated={(ctx) => {
    /* imperative hooks */
  }}
>
  <Group transform={[1, 0, 0, 1, 0, 0]} opacity={1}>
    <Rect
      x={40}
      y={40}
      width={200}
      height={120}
      fill={{ type: "solid", colour: { r: 0.1, g: 0.5, b: 0.9, a: 1 } }}
      onPointerDown={(e) => {
        /* … */
      }}
    />
    <Text x={52} y={100} fontSize={24} text="Hello, Vello" />
  </Group>
</Canvas>
```

- Reconciler produces a batched op buffer per commit: `create/set/append/remove/reorder`.
- Vello backend builds `vello::Scene` and renders via `vello::Renderer`. ([Docs.rs][1])

---

## Risks and mitigations

- Vello alpha and feature churn (e.g. filters/blur, glyph caching strategies). Track releases and gate features. ([GitHub][13])
- `react-reconciler` is experimental and pairs with React versions. Pin and test upgrades consciously. ([npm][12])
- WebGPU implementation differences; prioritise Chromium and add capability probes. ([Docs.rs][3])
- WASM bridge overhead; mitigate via binary batching and SAB ring buffers (requires cross‑origin isolation). ([web.dev][9])
- A11y on canvas is non‑trivial; provide DOM overlay and guidance; clarify how AccessKit semantics map onto that overlay and what limitations remain on the web. ([AccessKit][8])
- Turborepo + Rust toolchain integration: WASM builds don't benefit from JS-only caching heuristics. Explicitly define cache inputs (Rust sources, Cargo.lock, wasm-bindgen version) and outputs (pkg/ directory). Monitor cache hit rates and adjust.

---

## Success metrics

- Developer adoption: GitHub stars, npm downloads, issues resolved.
- DX: time‑to‑first‑pixel (<2 minutes with template), API satisfaction (survey).
- Performance: ≥60 FPS typical scenes; ≤4 ms commit time on 5k nodes.
- Stability: green CI across browsers; upgrade cadence with React majors.

---

## Acceptance criteria (MVP)

- [ ] Render Rect/Path/Text/Image with transforms, opacity, gradients.
- [ ] Pointer events with propagation; CPU hit‑testing for rect/path.
- [ ] Fonts loaded from URLs; shaping with Parley; correct bidi. ([Docs.rs][7])
- [ ] Vello backend renders at 60 FPS for 1k nodes; error handling for unsupported WebGPU. ([Docs.rs][1])
- [ ] Type‑safe JSX types; comprehensive docs and a working example.

---

## Manual validation matrix

- Chrome 125 (Windows 11, RTX 3070 / DX12 backend) — default path for perf targets.
- Chrome 125 (macOS 14, M2 Pro / Metal backend) — ensures Apple GPU + tile-based behaviour.
- Edge 125 (Windows 11, Intel Xe integrated) — integrated GPU perf + energy throttling.
- ChromeOS 124 (Chromebook Plus, Intel/AMD) — OffscreenCanvas availability + battery impact.
- Safari Technology Preview (macOS 14, M2) — confirm graceful WebGPU detection + fallback messaging.
- Cross-origin isolated build (Chrome desktop) — SharedArrayBuffer ring buffer path and worker renderer smoke tests.

Document results per release in QA checklist; failures block release until mitigations are captured in docs.

---

## Backlog (post‑MVP)

- GPU picking, instancing, filters/blur when Vello stabilises. ([Docs.rs][1])
- Offscreen rendering to textures; composition; multi‑canvas.
- Image decoding in worker; streaming images; colour spaces.

---

## Task checklist (expanded)

### Engine & bridge

- [ ] Define op buffer schema (create/set/append/remove/reorder; paints; transforms).
- [ ] Implement encoder/decoder (CBOR/FlatBuffers) with fuzz tests.
- [ ] WASM exports: `createRenderer(canvas)`, `apply(ops)`, `render()`, `readPixels()`.
- [ ] WebGPU initialise/surface configure; resize handling; presentation logic. ([Docs.rs][3])
- [ ] Optional worker path: `transferControlToOffscreen`, message channel. ([MDN Web Docs][4])

### Primitives & paints

- [ ] Group transform stack; opacity composition.
- [ ] Rect/rounded‑rect; Path (SVG path parser); Text; Image.
- [ ] Fills: solid, linear/radial gradients; Strokes; caps/joins; dashes.
- [ ] Layers, masks, clipping.
- [ ] Vello scene emission and `Renderer` invocation. ([Docs.rs][1])

### Events

- [ ] Normalised pointer events; capture; preventDefault/stopPropagation.
- [ ] Hit‑testing: CPU first; add GPU ID pass later.
- [ ] Event batching; frame‑aligned delivery; tests for edge cases.

### Text

- [ ] Parley integration: layout contexts, spans, wrapping, bidi. ([Docs.rs][7])
- [ ] Font cache; font metrics; fallback chains; emoji.
- [ ] Text measurement API for layout and alignment.

### Performance

- [ ] Incremental diffing; dirty‑subtree renders.
- [ ] Dirty region compute; scissor optimisation.
- [ ] SAB ring buffer option with COOP/COEP docs. ([web.dev][9])

### Tooling & QA

- [ ] Turborepo configuration: task pipelines, cache inputs, outputs
- [ ] CI setup: GitHub Actions with remote cache; parallel test execution
- [ ] Bench harness (FPS, frame times, memory) in dedicated package
- [ ] Visual regression tests (pixel diff) with Chromatic/Percy
- [ ] Cross‑browser CI matrix; feature probes for WebGPU
- [ ] Changesets for coordinated versioning across packages
- [ ] Version pinning for React/`react-reconciler`; publish policy ([npm][12])
- [ ] Pre-commit hooks: lint-staged with Turborepo filters

### Documentation & examples

- [ ] Getting started; API reference; migration guides.
- [ ] Examples: interactions, text layout, gradients, worker rendering.
- [ ] Troubleshooting: WebGPU disabled, COOP/COEP, font loading pitfalls. ([web.dev][9])

---

## References

- Vello crate docs and README (Renderer, Scene, performance notes). ([Docs.rs][1])
- wgpu docs (WebGPU backend on wasm). ([Docs.rs][3])
- winit web target (canvas‑backed window). ([Docs.rs][14])
- Parley (shaping/line‑breaking/bidi). ([Docs.rs][7])
- AccessKit overview (toolkit a11y infra). ([AccessKit][8])
- React custom renderers (`react-reconciler` README and npm). ([GitHub][5])
- OffscreenCanvas and worker rendering; cross‑origin isolation for SAB. ([MDN Web Docs][4])
- Turborepo documentation (task pipelines, caching, filtering). ([Turborepo][15])
- Changesets for monorepo versioning. ([Changesets][16])

## Open questions

- Safari/Firefox roadmap: do we invest in experimental `wgpu` shims + flags for those engines in 2024, or focus on first-class Chrome/Edge and document the lack of support?
- Devtools footprint: should the planned Chrome DevTools panel ship as a browser extension (zero bundle cost) or remain as an opt-in npm package despite the cost in `node_modules` size?

---

### Decision gates

- Gate A (after Phase 0): confirm Vello feature coverage (text, gradients, perf targets) is sufficient for the roadmap; adjust scope before implementation if blockers remain.
- Gate B (after Phase 5): enable worker mode and SAB ring only if product requires it and infra can support cross‑origin isolation. ([web.dev][9])

---

## Appendix: Turborepo configuration example

### Sample turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "pkg/**", ".next/**", "!.next/cache/**"],
      "env": ["NODE_ENV"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**", "test/**", "vitest.config.ts"]
    },
    "lint": {
      "outputs": []
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    }
  }
}
```

### WASM-specific cache configuration

For Rust crates, add to package-specific `turbo.json`:

```json
{
  "extends": ["//"],
  "pipeline": {
    "build": {
      "inputs": [
        "src/**/*.rs",
        "Cargo.toml",
        "Cargo.lock",
        "../.cargo/config.toml"
      ],
      "outputs": ["pkg/**", "target/wasm32-unknown-unknown/**"]
    }
  }
}
```

### Workspace package.json scripts

```json
{
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "test": "turbo test",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "clean": "turbo clean && rm -rf node_modules"
  }
}
```

---

This plan yields a React‑first developer experience while leveraging Vello for high‑performance 2D on WebGPU, and Turborepo ensures efficient builds and caching across the complex multi-language monorepo.

[1]: https://docs.rs/vello/latest/vello/ "vello - Rust"
[2]: https://r3f.docs.pmnd.rs/?utm_source=chatgpt.com "Introduction - React Three Fiber"
[3]: https://docs.rs/wgpu/latest/wgpu/?utm_source=chatgpt.com "wgpu - Rust - Docs.rs"
[4]: https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas?utm_source=chatgpt.com "OffscreenCanvas - Web APIs | MDN - MDN Web Docs"
[5]: https://github.com/facebook/react/blob/main/packages/react-reconciler/README.md?utm_source=chatgpt.com "react/packages/react-reconciler/README.md at main - GitHub"
[6]: https://r3f.docs.pmnd.rs/api/events?utm_source=chatgpt.com "Events - React Three Fiber - Poimandres"
[7]: https://docs.rs/parley?utm_source=chatgpt.com "parley - Rust - Docs.rs"
[8]: https://accesskit.dev/?utm_source=chatgpt.com "AccessKit: Accessibility infrastructure for UI toolkits"
[9]: https://web.dev/articles/cross-origin-isolation-guide?utm_source=chatgpt.com "A guide to enable cross-origin isolation | Articles | web.dev"
[10]: https://wasm-bindgen.github.io/wasm-bindgen/reference/deployment.html?utm_source=chatgpt.com "Deployment - The `wasm-bindgen` Guide"
[11]: https://docs.rs/parley/latest/parley/style/struct.TextStyle.html?utm_source=chatgpt.com "TextStyle in parley::style - Rust - Docs.rs"
[12]: https://www.npmjs.com/package/react-reconciler?utm_source=chatgpt.com "react-reconciler - npm"
[13]: https://github.com/linebender/vello?utm_source=chatgpt.com "GitHub - linebender/vello: A GPU compute-centric 2D renderer."
[14]: https://docs.rs/winit/latest/wasm32-unknown-unknown/winit/platform/web/index.html?utm_source=chatgpt.com "winit::platform::web - Rust - Docs.rs"
[15]: https://turbo.build/repo/docs "Turborepo Documentation"
[16]: https://github.com/changesets/changesets "Changesets - A tool for managing versioning and changelogs"
[17]: https://skia.org/docs/user/modules/canvaskit/ "CanvasKit - Skia documentation"
[18]: https://rive.app/community/runtime "Rive runtimes"
[19]: https://pixijs.com/ "PixiJS"
[20]: https://github.com/pixijs/react-pixi "react-pixi - GitHub"
