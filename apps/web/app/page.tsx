import Link from "next/link";

import { CodeBlock } from "@/components/code-block";
import { DemoScene } from "@/components/demo-scene";
import { InstallCommand } from "@/components/install-command";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/ui/reveal";
import { STRESS_TEST_REACT_VELLO_PATH } from "@/lib/routes";

const HEADING =
  "mt-8 mb-2 text-balance font-semibold text-[1.3125rem]/[1.3] tracking-[-0.011em]";
const LINK = "underline underline-offset-[3px]";
const CODE = "font-mono text-[0.9em]";

/** Quoted from the README so the two cannot say different things. */
const QUICKSTART = `import { Canvas, Rect, Text, createVelloRoot } from "react-vello";

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
`;

export default function DemoPage() {
  return (
    <>
      {/* Off-screen because the curve is the title treatment. It is real
          content either way, and without it the page has no h1. */}
      <h1 className="sr-only">
        React Vello: a React renderer that draws on the GPU through Vello and
        WebGPU
      </h1>

      <DemoScene />

      <main className="full-bleed-bg relative z-3 mx-auto max-w-[62ch] px-4 py-8 text-[1.0625rem]/[1.65]">
        <Reveal>
          <p className="mb-6 text-pretty text-[1.4375rem]/[1.35] tracking-[-0.011em]">
            A React tree, rasterised on the GPU. The curve above is four
            components with props — no canvas API, no draw calls, no hit-testing
            by hand.
          </p>
        </Reveal>

        <Reveal as="section" delay={0.08}>
          <h2 className={HEADING}>What you are looking at</h2>
          <p className="mb-4 text-pretty">
            A cubic Bézier curve with four draggable handles. Drag any of them.
            The thin lines show each control point&rsquo;s pull on the end it
            belongs to, and the dot is the curve re-evaluated every frame.
          </p>
          <p className="mb-4 text-pretty">
            That dot is de Casteljau&rsquo;s algorithm run at a moving{" "}
            <em>t</em>, which is why it slows through the tight part of a bend
            and speeds up through the straight.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>The whole API</h2>
          <p className="mb-4 text-pretty">
            Four components and a root. This is a complete program that draws a
            blue box and some text:
          </p>
          <CodeBlock code={QUICKSTART} filename="app.tsx" />
          <p className="mb-4 text-pretty">
            <code className={CODE}>createVelloRoot</code> is{" "}
            <code className={CODE}>createRoot</code> for a canvas. Everything
            after it is ordinary React: state, effects, keys, refs, the same
            reconciler contract you already know.
          </p>
          <InstallCommand />
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>Why Vello is the breakthrough</h2>
          <p className="mb-4 text-pretty">
            Every 2D canvas library before this one worked shape by shape. You
            handed the GPU a rectangle, then another one, and the cost of the
            picture was the number of things in it.
          </p>
          <p className="mb-4 text-pretty">
            Vello does not work that way. It encodes the whole scene — every
            path, every fill, every clip — into buffers, then rasterises it with
            compute shaders that never see your shapes as separate draws. The
            fixed-function graphics pipeline is barely involved. Shape count
            stops being the thing that costs, which is why the{" "}
            <Link className={LINK} href={STRESS_TEST_REACT_VELLO_PATH}>
              comparison
            </Link>{" "}
            can put thirty thousand of them on screen at once.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>React is the scene graph</h2>
          <p className="mb-4 text-pretty">
            None of that shows up on the React side. The scene is Canvas, Group,
            Path and Rect components with props; a custom reconciler turns that
            tree into a scene graph, Rust encodes it into a binary frame, and
            Vello rasterises it.
          </p>
          <p className="mb-4 text-pretty">
            Pointer events come back the same way. Dragging a handle above is an{" "}
            <code className={CODE}>onPointerDown</code> on a shape, not a
            coordinate you hit-tested yourself.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>What it costs</h2>
          <p className="mb-4 text-pretty">
            WebGPU, and a browser that has it. Where it is missing the renderer
            falls back to Canvas 2D and says so on screen, so the page still
            draws — just not on the GPU.
          </p>
          <p className="mb-4 text-pretty">
            The WASM binary ships inside the package. No build step, no separate
            asset to host, no wasm-pack in your toolchain.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>How fast</h2>
          <p className="mb-4 text-pretty">
            Thirty thousand animated shapes, the same simulation, three
            renderers:{" "}
            <Link className={LINK} href={STRESS_TEST_REACT_VELLO_PATH}>
              compare react-vello, react-konva and react-dom
            </Link>{" "}
            on your own machine.
          </p>
        </Reveal>
      </main>

      <SiteFooter />
    </>
  );
}
