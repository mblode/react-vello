let wasmModulePromise: Promise<WasmModule | null> | null = null;

type WasmModule = typeof import("./wasm/rvello.js");

export interface WasmRenderer {
  /**
   * Grows the renderer's frame buffer to at least `required` bytes and returns
   * a view onto it. The encoder writes the frame here, inside WASM linear
   * memory, so nothing has to be copied across the boundary afterwards.
   *
   * Contents already written survive a grow, so this is safe to call part-way
   * through encoding.
   */
  reserve(required: number): Uint8Array;
  /** Decodes the first `length` bytes of the frame buffer and presents. */
  submit(length: number): void;
}

export async function createWasmRenderer(
  canvas: HTMLCanvasElement
): Promise<WasmRenderer | null> {
  if (!(await hasUsableWebGPU(canvas))) {
    return null;
  }

  const module = await loadModule();
  if (!module) {
    return null;
  }

  try {
    const handle = await module.create_renderer(canvas);
    const memory = module.wasm_memory() as WebAssembly.Memory;
    return {
      reserve(required) {
        // Re-derived every time rather than cached: `ops_reserve` can move the
        // buffer, and any WASM allocation can grow linear memory, which
        // detaches every existing view onto it.
        const ptr = handle.ops_reserve(required);
        return new Uint8Array(memory.buffer, ptr, required);
      },
      submit(length) {
        handle.apply_and_render(length);
      },
    };
  } catch (error) {
    console.warn("[rvello] wasm renderer initialization failed", error);
    return null;
  }
}

function loadModule(): Promise<WasmModule | null> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      try {
        const module = await import("./wasm/rvello.js");
        if (typeof module.default === "function") {
          const wasmUrl = new URL("./wasm/rvello_bg.wasm", import.meta.url);
          await module.default({ module_or_path: wasmUrl });
        }
        return module;
      } catch (error) {
        console.warn("[rvello] failed to load wasm module", error);
        return null;
      }
    })();
  }

  return wasmModulePromise;
}

async function hasUsableWebGPU(canvas?: HTMLCanvasElement): Promise<boolean> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return false;
  }

  const adapter = await navigator.gpu.requestAdapter().catch((error) => {
    console.warn(
      "[rvello] WebGPU adapter request failed; falling back to Canvas renderer.",
      error
    );
    return null;
  });
  if (!adapter) {
    console.warn(
      "[rvello] WebGPU adapter unavailable; falling back to Canvas renderer."
    );
    return false;
  }

  if (!ensureCanvasContext(canvas)) {
    console.warn(
      "[rvello] WebGPU canvas context unavailable; falling back to Canvas renderer."
    );
    return false;
  }

  // Note: isFallbackAdapter is not in the WebGPU spec types but may exist on some adapters
  const enrichedAdapter = adapter as GPUAdapter & {
    isFallbackAdapter?: boolean;
  };
  if (enrichedAdapter.isFallbackAdapter) {
    console.warn(
      "[rvello] WebGPU fallback adapter detected; falling back to Canvas renderer."
    );
    return false;
  }

  return true;
}

function ensureCanvasContext(canvas?: HTMLCanvasElement): boolean {
  const target =
    canvas ??
    (typeof document !== "undefined"
      ? (document.createElement("canvas") as HTMLCanvasElement)
      : null);
  if (!target || typeof target.getContext !== "function") {
    return false;
  }

  try {
    const context = (
      target.getContext as unknown as (
        contextId: "webgpu"
      ) => GPUCanvasContext | null
    ).call(target, "webgpu");
    return Boolean(context);
  } catch {
    return false;
  }
}
