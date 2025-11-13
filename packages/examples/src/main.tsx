import './style.css'
import { StrictMode, useEffect, useMemo, useState } from 'react'
import type { Mat3, Vec2 } from '@react-vello/types'
import { createVelloRoot, type VelloRoot } from '@react-vello/core'

type SupportStatus =
  | { ok: true; adapter: string; description: string; features: string[] }
  | { ok: false; reason: string; hint?: string }

let currentRoot: VelloRoot | null = null

async function detectWebGPU(): Promise<SupportStatus> {
  if (!('gpu' in navigator)) {
    return {
      ok: false,
      reason: 'This browser does not expose navigator.gpu.',
      hint: 'Use Chrome 125+ or Edge 125+ with WebGPU enabled in chrome://flags.',
    }
  }

  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) {
    return {
      ok: false,
      reason: 'No compatible GPU adapter found.',
      hint: 'Ensure that chrome://flags/#enable-unsafe-webgpu is enabled.',
    }
  }

  return {
    ok: true,
    adapter: adapter.name || 'Unknown GPU',
    description: adapter.isFallbackAdapter ? 'Fallback adapter' : 'High-performance adapter',
    features: Array.from(adapter.features.values()).sort(),
  }
}

function renderStatus(status: SupportStatus): string {
  if (!status.ok) {
    return `
      <section class="status error">
        <h2>WebGPU unavailable</h2>
        <p>${status.reason}</p>
        ${status.hint ? `<p class="hint">${status.hint}</p>` : ''}
      </section>
    `
  }

  const featureList = status.features.length
    ? `<ul class="feature-list">${status.features.map((f) => `<li>${f}</li>`).join('')}</ul>`
    : '<p>No optional features reported.</p>'

  return `
    <section class="status success">
      <h2>WebGPU ready</h2>
      <p class="adapter-name">${status.adapter}</p>
      <p>${status.description}</p>
      <p class="hint">DPR: ${(window.devicePixelRatio ?? 1).toFixed(2)}</p>
      <h3>Adapter features</h3>
      ${featureList}
    </section>
  `
}

function mountShell(): HTMLDivElement {
  const host = document.querySelector<HTMLDivElement>('#app')
  if (!host) {
    throw new Error('Missing #app container')
  }

  host.innerHTML = `
    <div class="shell">
      <header>
        <p class="eyebrow">Phase 1 &mdash; React renderer preview</p>
        <h1>React Vello workspace</h1>
        <p>
          WebGPU detection runs first. When successful, the custom React renderer draws a simple scene on the canvas below.
        </p>
      </header>
      <div class="status-slot" id="status-slot">
        <p>Detecting WebGPU capabilities...</p>
      </div>
      <div class="canvas-wrapper">
        <canvas id="rvello-canvas" aria-label="React Vello demo canvas"></canvas>
      </div>
      <footer>
        <p>
          Need help enabling WebGPU? See
          <a href="https://developer.chrome.com/docs/web-platform/webgpu" target="_blank" rel="noreferrer">
            the Chrome WebGPU guide
          </a>.
        </p>
      </footer>
    </div>
  `

  return host
}

function startScene() {
  const canvas = document.querySelector<HTMLCanvasElement>('#rvello-canvas')
  if (!canvas) throw new Error('Missing #rvello-canvas element')

  currentRoot?.unmount()
  currentRoot = createVelloRoot(canvas)
  currentRoot.render(
    <StrictMode>
      <DemoScene />
    </StrictMode>,
  )
}

function DemoScene() {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let raf: number
    const loop = () => {
      setTick((t) => (t + 1) % 3600)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])

  const rotation = tick * 0.01
  const cos = Math.cos(rotation)
  const sin = Math.sin(rotation)
  const orbit = useMemo<Mat3>(
    () => [cos, sin, -sin, cos, 360, 200],
    [cos, sin],
  )

  const chips: ReadonlyArray<{ label: string; origin: Vec2; color: string }> = [
    { label: 'Canvas renderer', origin: [100, 80], color: '#38bdf8' },
    { label: 'React host config', origin: [280, 80], color: '#f472b6' },
    { label: 'WASM bridge', origin: [460, 80], color: '#facc15' },
  ]

  return (
    <Canvas
      width={720}
      height={420}
      devicePixelRatio={window.devicePixelRatio ?? 1}
      backgroundColor="#020617"
    >
      <Group transform={[1, 0, 0, 1, 40, 40]}>
        <Rect origin={[0, 0]} size={[640, 320]} radius={32} fill={{ kind: 'solid', color: '#0f172a' }} />
      </Group>
      <Group transform={orbit} opacity={0.85}>
        <Rect origin={[-140, -90]} size={[280, 180]} radius={28} fill={{ kind: 'solid', color: '#38bdf8' }} />
      </Group>
      <Group transform={[1, 0, 0, 1, 80, 300]}>
        <Rect origin={[0, 0]} size={[560, 80]} radius={24} fill={{ kind: 'solid', color: '#1d4ed8' }} />
      </Group>
      {chips.map((chip) => (
        <Group key={chip.label} transform={[1, 0, 0, 1, chip.origin[0], chip.origin[1]]}>
          <Rect origin={[0, 0]} size={[140, 40]} radius={12} fill={{ kind: 'solid', color: chip.color }} />
        </Group>
      ))}
    </Canvas>
  )
}

async function main() {
  const host = mountShell()
  const statusSlot = host.querySelector<HTMLDivElement>('#status-slot')
  if (!statusSlot) return

  const status = await detectWebGPU()
  statusSlot.innerHTML = renderStatus(status)
  if (status.ok) {
    startScene()
  }
}

void main()

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    currentRoot?.unmount()
    currentRoot = null
  })
}
