<div align="center">

# react-vello

**Blazing fast React renderer powered by [Vello](https://github.com/linebender/vello)**

<p align="center">
  <a href="https://www.npmjs.com/package/react-vello">
    <img src="https://img.shields.io/npm/v/react-vello?style=flat&colorA=000000&colorB=000000" />
  </a>
  <a href="https://github.com/mblode/react-vello/blob/main/LICENSE.md">
    <img src="https://img.shields.io/github/license/mblode/react-vello?style=flat&colorA=000000&colorB=000000" />
  </a>
</p>

</div>

## Demo

Try the live demo.

<p>
<a href="https://react-vello.blode.co">
<img alt="View demo" src=".github/assets/demo.svg" width="200" />
</a>
</p>

## Install

```shell
npm install react-vello react react-dom
```

## Quickstart

```html
<canvas id="vello"></canvas>
```

```tsx
import { Canvas, Rect, Text, createVelloRoot } from "react-vello";

const canvas = document.querySelector("#vello") as HTMLCanvasElement;
const root = createVelloRoot(canvas);

root.render(
  <Canvas width={640} height={360}>
    <Rect
      origin={[40, 40]}
      size={[200, 120]}
      fill={{ kind: "solid", color: "#3b82f6" }}
      radius={16}
    />
    <Text
      origin={[60, 110]}
      font={{ family: "Space Grotesk", size: 32, weight: 600 }}
      fill={{ kind: "solid", color: "#0f172a" }}
    >
      Hello Vello
    </Text>
  </Canvas>
);
```

## Notes

- WebGPU is required; use a browser with WebGPU enabled.
- The WASM renderer ships with the package; no extra setup required.

## License

[MIT](LICENSE.md)

---

<sub>Inspired by [react-three-fiber](https://github.com/pmndrs/react-three-fiber), [react-konva](https://github.com/konvajs/react-konva), and [react-pdf](https://github.com/diegomura/react-pdf).</sub>
