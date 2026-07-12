/* tslint:disable */
/* eslint-disable */
export function create_renderer(
  canvas: HTMLCanvasElement
): Promise<RendererHandle>;
export function wasm_start(): void;
export class RendererHandle {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  apply(ops: Uint8Array): void;
  render(): void;
  resize(width: number, height: number): void;
}

export type InitInput =
  | RequestInfo
  | URL
  | Response
  | BufferSource
  | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_rendererhandle_free: (a: number, b: number) => void;
  readonly create_renderer: (a: any) => any;
  readonly rendererhandle_apply: (a: number, b: any) => [number, number];
  readonly rendererhandle_render: (a: number) => [number, number];
  readonly rendererhandle_resize: (a: number, b: number, c: number) => void;
  readonly wasm_start: () => void;
  readonly wasm_bindgen__convert__closures_____invoke__h1e3f4f5e5b6e003f: (
    a: number,
    b: number,
    c: any
  ) => void;
  readonly wasm_bindgen__closure__destroy__hb8467f3e511a960c: (
    a: number,
    b: number
  ) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h2a0f84921f614cc0: (
    a: number,
    b: number,
    c: any,
    d: any
  ) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (
    a: number,
    b: number,
    c: number,
    d: number
  ) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(
  module: { module: SyncInitInput } | SyncInitInput
): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init(
  module_or_path?:
    | { module_or_path: InitInput | Promise<InitInput> }
    | InitInput
    | Promise<InitInput>
): Promise<InitOutput>;
