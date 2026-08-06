import { PARTICLE_COUNT_MAX, PARTICLE_COUNT_MAX_DOM } from "@/lib/particles";
import {
  STRESS_TEST_REACT_DOM_PATH,
  STRESS_TEST_REACT_KONVA_PATH,
  STRESS_TEST_REACT_VELLO_PATH,
} from "@/lib/routes";

export type RendererId = "react-vello" | "react-konva" | "react-dom";

export interface RendererMeta {
  id: RendererId;
  /** Short form, for the segmented control and the results table. */
  label: string;
  /** Full name, used as the page heading. */
  name: string;
  path: string;
  /** Where this renderer stops being able to recover. */
  maxParticles: number;
  /** Rows for a renderer the browser can't run are reported, not blanked. */
  requiresWebGPU: boolean;
  summary: string;
  detail: readonly string[];
}

/**
 * The renderer is a parameter of one comparison, not three destinations, so it
 * lives here as data. Adding a fourth renderer is an entry in this list plus a
 * field component; nothing else in the compare surface needs to know.
 */
const VELLO: RendererMeta = {
  id: "react-vello",
  label: "Vello",
  name: "React Vello",
  path: STRESS_TEST_REACT_VELLO_PATH,
  maxParticles: PARTICLE_COUNT_MAX,
  requiresWebGPU: true,
  summary: "The whole scene batched, then rasterised on the GPU.",
  detail: [
    "The scene graph is encoded in Rust compiled to WebAssembly, then rasterised by Vello through WebGPU.",
    "React is kept out of the frame loop. Reconciling 30,000 components at 60fps would cost more than the drawing does, so the particles mount once and each frame writes to their props through refs before asking for a redraw. Konva does the same.",
  ],
};

const KONVA: RendererMeta = {
  id: "react-konva",
  label: "Konva",
  name: "React Konva",
  path: STRESS_TEST_REACT_KONVA_PATH,
  maxParticles: PARTICLE_COUNT_MAX,
  requiresWebGPU: false,
  summary: "One fill per particle against a 2D canvas, issued from the CPU.",
  detail: [
    "Canvas 2D runs everywhere and needs no feature detection. Below a few thousand shapes you will not be able to tell these renderers apart.",
    "What it cannot do is batch, so cost tracks the number of shapes rather than the pixels they cover.",
  ],
};

const DOM: RendererMeta = {
  id: "react-dom",
  label: "DOM",
  name: "React DOM",
  path: STRESS_TEST_REACT_DOM_PATH,
  maxParticles: PARTICLE_COUNT_MAX_DOM,
  requiresWebGPU: false,
  summary: "One absolutely positioned div per particle.",
  detail: [
    "This is the control, and it is not a strawman. Elements are created once, colour, size and border radius are set once, and the per-frame work is a transform and an opacity, never top and left or a width.",
    "Two things that look like optimisations are deliberately left out. Writing width and height each frame invalidates layout for every particle, so the pulse rides on the transform instead. And will-change is off: it buys a compositor layer per element, which helps for a handful and exhausts GPU memory at thirty thousand.",
    "It still falls over long before the other two, which is why it stops at 12,000. Past that the main thread is busy for whole seconds at a time, the slider stops responding, and the tab is liable to be killed.",
  ],
};

export const RENDERERS: readonly RendererMeta[] = [VELLO, KONVA, DOM];

/** Where an unrecognised compare path lands. */
export const DEFAULT_RENDERER = VELLO;

export function getRendererByPath(pathname: string): RendererMeta {
  return RENDERERS.find((renderer) => renderer.path === pathname) ?? VELLO;
}
