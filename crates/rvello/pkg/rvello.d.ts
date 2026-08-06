/* tslint:disable */
/* eslint-disable */
export function create_renderer(
  canvas: HTMLCanvasElement
): Promise<RendererHandle>;
/**
 * The module's linear memory, so JS can build views over the frame buffer that
 * `ops_reserve` hands out pointers into.
 */
export function wasm_memory(): any;
export function wasm_start(): void;
export class RendererHandle {
  private constructor();
  free(): void;
  [Symbol.dispose](): void;
  /**
   * Grows the frame buffer to at least `len` bytes and hands back a pointer
   * into linear memory.
   *
   * Existing contents survive — `Vec::resize` copies them to the new
   * allocation and `memory.grow` preserves the old pages — so JS can call
   * this part-way through encoding a frame, re-derive its view, and carry on
   * writing where it left off.
   */
  ops_reserve(len: number): number;
  /**
   * Decodes the first `len` bytes already sitting in the frame buffer, then
   * presents. One boundary crossing per frame, and nothing copied to get
   * here.
   */
  apply_and_render(len: number): void;
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
  readonly rendererhandle_apply_and_render: (
    a: number,
    b: number
  ) => [number, number];
  readonly rendererhandle_ops_reserve: (a: number, b: number) => number;
  readonly rendererhandle_render: (a: number) => [number, number];
  readonly rendererhandle_resize: (a: number, b: number, c: number) => void;
  readonly wasm_start: () => void;
  readonly wasm_memory: () => any;
  readonly wasm_bindgen__convert__closures_____invoke__h00bea32f875544c4: (
    a: number,
    b: number,
    c: any
  ) => void;
  readonly wasm_bindgen__closure__destroy__h672b61b92ad0ee27: (
    a: number,
    b: number
  ) => void;
  readonly wasm_bindgen__convert__closures_____invoke__h4ad653f24082db39: (
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
