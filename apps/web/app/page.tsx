import Link from "next/link";

import { CodeBlock } from "@/components/code-block";
import { DemoScene } from "@/components/demo-scene";
import { InstallCommand } from "@/components/install-command";
import { SiteFooter } from "@/components/site-footer";
import { Reveal } from "@/components/ui/reveal";
import { ZoneBreadcrumb } from "@/components/zone-breadcrumb";
import { STRESS_TEST_REACT_VELLO_PATH } from "@/lib/routes";
import { zoneRootJsonLd } from "@/lib/schema";

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
      {/* Static object literal, no user input. One @graph rather than a script
          per node: see lib/schema.ts. Emitted here and not in the layout so the
          benchmark routes do not each claim to be the zone root. */}
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(zoneRootJsonLd) }}
        type="application/ld+json"
      />

      {/* Off-screen because the curve is the title treatment. It is real
          content either way, and without it the page has no h1. */}
      <h1 className="sr-only">
        React Vello: a React renderer that draws on the GPU through Vello and
        WebGPU
      </h1>

      <DemoScene />

      <main className="full-bleed-bg relative z-3 mx-auto max-w-[62ch] px-4 py-8 text-[1.0625rem]/[1.65]">
        {/* The edge back to the hub. It matches the BreadcrumbList in
            lib/schema.ts exactly; Google reads a mismatch as a markup error. */}
        <div className="mb-6">
          <ZoneBreadcrumb product="React Vello" />
        </div>

        <Reveal>
          <p className="mb-6 text-pretty text-[1.4375rem]/[1.35] tracking-[-0.011em]">
            A React tree, rasterised on the GPU. The curve above is four
            components with props: no canvas API, no draw calls, no hit-testing.
          </p>
        </Reveal>

        <Reveal as="section" delay={0.08}>
          <h2 className={HEADING}>The curve above</h2>
          <p className="mb-4 text-pretty">
            A cubic Bézier with four draggable handles. Drag one. The thin lines
            show each control point&rsquo;s pull. The dot is de
            Casteljau&rsquo;s algorithm at a moving <em>t</em>, so it slows
            through tight bends.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>Install</h2>
          <InstallCommand />
          <p className="mb-4 text-pretty">
            The WASM renderer ships inside the package. No build step, no asset
            to host.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>Quickstart</h2>
          <p className="mb-4 text-pretty">
            Four components and a root. A complete program that draws a blue box
            and some text:
          </p>
          <CodeBlock code={QUICKSTART} filename="app.tsx" />
          <p className="mb-4 text-pretty">
            <code className={CODE}>createVelloRoot</code> is{" "}
            <code className={CODE}>createRoot</code> for a canvas. Everything
            after it is ordinary React: state, effects, keys, refs.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>How it works</h2>
          <p className="mb-4 text-pretty">
            Every 2D canvas library before this one worked shape by shape: one
            rectangle, then another, and the picture cost what it held. Vello
            encodes the whole scene into buffers and rasterises it with compute
            shaders that never see separate draws. Shape count stops being the
            thing that costs, which is why the{" "}
            <Link className={LINK} href={STRESS_TEST_REACT_VELLO_PATH}>
              comparison
            </Link>{" "}
            runs thirty thousand of them at once.
          </p>
          <p className="mb-4 text-pretty">
            Your side stays Canvas, Group, Path and Rect with props. A
            reconciler turns the tree into a scene graph, Rust encodes a binary
            frame, Vello rasterises it. Dragging a handle above is an{" "}
            <code className={CODE}>onPointerDown</code> on a shape, not a
            coordinate you hit-tested.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>Requirements</h2>
          <p className="mb-4 text-pretty">
            WebGPU. Without it the renderer falls back to Canvas 2D and says so
            on screen, so the page still draws.
          </p>
        </Reveal>

        <Reveal as="section">
          <h2 className={HEADING}>Benchmarks</h2>
          <p className="mb-4 text-pretty">
            Thirty thousand animated shapes, three renderers, your machine:{" "}
            <Link className={LINK} href={STRESS_TEST_REACT_VELLO_PATH}>
              compare react-vello, react-konva and react-dom
            </Link>
            .
          </p>
        </Reveal>
      </main>

      <SiteFooter />
    </>
  );
}
