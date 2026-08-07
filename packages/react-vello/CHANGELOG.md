# react-vello

## 0.0.5

### Patch Changes

- 73cc1cb: Fall back to the built-in Canvas renderer when WebGPU is unavailable or fails
  to initialize.
- 571a4eb: Stop React's development build logging "Expected host context to exist" on
  every commit. `getRootHostContext` returned `null`, which React reads as "no
  host context was pushed"; it now returns a shared sentinel object.
- 7a505f2: Cut the per-frame allocation out of the render path.

  The encoder used to build a fresh `ArrayBuffer` every frame, doubling it up from
  1KB to whatever the scene needed, and Rust then copied the whole thing again on
  the way in. At 30,000 rects that was several megabytes allocated and copied per
  frame to describe a scene that had changed by a few floats.

  Now the frame buffer lives inside the WASM module and the encoder writes the
  frame straight into it, so a frame crosses the boundary as a length rather than
  as bytes, in a single call instead of two. Alongside that: hex colours and SVG
  paths are parsed once and cached rather than per node per frame, an identity
  transform no longer allocates a copy of its parent, hit regions are rebuilt when
  a pointer event needs them rather than on every frame, canvas attributes are
  only written when they change, and the Canvas 2D fallback no longer encodes a
  frame it is about to throw away.

  On the Rust side the release profile now uses fat LTO, a single codegen unit and
  `wasm-opt -O4`; the device is requested with the adapter's own limits instead of
  the WebGL2 downlevel floor; only the antialiasing mode actually used is
  compiled; and plain rectangles and full-radius dots skip `RoundedRect`'s arc
  tessellation.

  New: `createVelloRoot(canvas, { debug: true })` collects per-stage frame timings,
  readable through `context.getStats()`.

## 0.0.4

### Patch Changes

- d842581: update to support react 19

## 0.0.3

### Patch Changes

- 8f437df: Setup changeset
