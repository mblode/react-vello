/**
 * Colours the GPU renderer needs as literal hex strings. Vello takes a colour,
 * not a CSS variable, so these cannot come from `globals.css` at runtime.
 *
 * `CANVAS_BG` must stay equal to the dark `--background` token in
 * `app/globals.css`; if they drift, the canvas shows a visible seam against the
 * page chrome around it.
 */
export const CANVAS_BG = "#0a0a0a";

/** Neutral ramp for scene furniture, matched to the dark theme's border/muted. */
export const SCENE_INK = {
  guide: "#3f3f46",
  curveShadow: "#1c1c1f",
  tracer: "#fafafa",
} as const;

/** Anchor and control-point handles. Hue here is data, not brand chrome. */
export const HANDLE_COLOR = {
  anchor: "#38bdf8",
  control: "#a78bfa",
} as const;

const PARTICLE_PALETTE = [
  "#38bdf8",
  "#f472b6",
  "#facc15",
  "#a7f3d0",
  "#c4b5fd",
];

/**
 * The single source of a particle's colour. Every renderer derives it from the
 * index so the colour is known at mount, before the simulation has run a frame.
 */
export function getParticleColor(index: number): string {
  return PARTICLE_PALETTE[index % PARTICLE_PALETTE.length] ?? "#38bdf8";
}
