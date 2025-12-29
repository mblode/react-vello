let wasmModulePromise: Promise<WasmModule | null> | null = null

type WasmModule = typeof import('./wasm/rvello.js')

export interface WasmRenderer {
  apply(data: Uint8Array): void
  render(): void
}

export async function createWasmRenderer(canvas: HTMLCanvasElement): Promise<WasmRenderer | null> {
  if (!(await hasUsableWebGPU(canvas))) {
    return null
  }

  const module = await loadModule()
  if (!module) {
    return null
  }

  try {
    const handle = await module.create_renderer(canvas)
    return {
      apply(data) {
        handle.apply(data)
      },
      render() {
        handle.render()
      },
    }
  } catch (error) {
    console.warn('[rvello] wasm renderer initialization failed', error)
    return null
  }
}

async function loadModule(): Promise<WasmModule | null> {
  if (!wasmModulePromise) {
    wasmModulePromise = (async () => {
      try {
        const module = await import('./wasm/rvello.js')
        if (typeof module.default === 'function') {
          const wasmUrl = new URL('./wasm/rvello_bg.wasm', import.meta.url)
          await module.default({ module_or_path: wasmUrl })
        }
        return module
      } catch (error) {
        console.warn('[rvello] failed to load wasm module', error)
        return null
      }
    })()
  }

  return wasmModulePromise
}

async function hasUsableWebGPU(canvas?: HTMLCanvasElement): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false
  }

  const adapter = await navigator.gpu.requestAdapter().catch((error) => {
    console.warn('[rvello] WebGPU adapter request failed; falling back to Canvas renderer.', error)
    return null
  })
  if (!adapter) {
    console.warn('[rvello] WebGPU adapter unavailable; falling back to Canvas renderer.')
    return false
  }

  if (!ensureCanvasContext(canvas)) {
    console.warn('[rvello] WebGPU canvas context unavailable; falling back to Canvas renderer.')
    return false
  }

  // Note: isFallbackAdapter is not in the WebGPU spec types but may exist on some adapters
  const enrichedAdapter = adapter as GPUAdapter & { isFallbackAdapter?: boolean }
  if (enrichedAdapter.isFallbackAdapter) {
    console.warn('[rvello] WebGPU fallback adapter detected; falling back to Canvas renderer.')
    return false
  }

  return true
}

function ensureCanvasContext(canvas?: HTMLCanvasElement): boolean {
  const target =
    canvas ?? (typeof document !== 'undefined' ? (document.createElement('canvas') as HTMLCanvasElement) : null)
  if (!target || typeof target.getContext !== 'function') {
    return false
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context = (target.getContext as any)?.('webgpu')
    return Boolean(context)
  } catch {
    return false
  }
}
