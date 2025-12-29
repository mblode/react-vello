<div align="center">

# react-vello

**React renderer for Vello (2D graphics with wgpu)**

</div>

Inspired by [react-three-fiber](https://github.com/pmndrs/react-three-fiber) and [Konva](https://github.com/konvajs/konva).

## Install

```shell
npm install react-vello react react-dom
```

## Quickstart

```html
<canvas id="vello"></canvas>
```

```tsx
import { Canvas, Rect, Text, createVelloRoot } from 'react-vello'

const canvas = document.querySelector('#vello') as HTMLCanvasElement
const root = createVelloRoot(canvas)

root.render(
  <Canvas width={640} height={360}>
    <Rect origin={[40, 40]} size={[200, 120]} fill={{ kind: 'solid', color: '#3b82f6' }} radius={16} />
    <Text
      origin={[60, 110]}
      font={{ family: 'Space Grotesk', size: 32, weight: 600 }}
      fill={{ kind: 'solid', color: '#0f172a' }}
    >
      Hello Vello
    </Text>
  </Canvas>,
)
```

## Notes

- WebGPU is required; use a Chromium-based browser with WebGPU enabled.
- The WASM renderer ships with the package; no extra setup required.

## License

[MIT](LICENSE.md).
