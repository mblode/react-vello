import type { Paint, RgbaColor } from "./types";

export interface NormalizedRgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function paintToRgba(paint?: Paint): NormalizedRgba | null {
  if (!paint) {
    return null;
  }
  if (paint.kind === "solid") {
    return normalizeColor(paint.color);
  }
  return null;
}

export function normalizeColor(
  color: string | RgbaColor | undefined
): NormalizedRgba | null {
  if (!color) {
    return null;
  }
  if (typeof color === "string") {
    return parseHex(color);
  }
  return normalizeRgbaColor(color);
}

export function colorToCss(
  color: string | RgbaColor | undefined
): string | undefined {
  if (!color) {
    return undefined;
  }
  if (typeof color === "string") {
    return color;
  }
  return rgbaToCss(normalizeRgbaColor(color));
}

export function rgbaToCss(rgba: NormalizedRgba): string {
  const r = Math.round(rgba.r * 255);
  const g = Math.round(rgba.g * 255);
  const b = Math.round(rgba.b * 255);
  const a = clamp01(rgba.a);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function normalizeRgbaColor(color: RgbaColor): NormalizedRgba {
  const toChannel = (value: number) => {
    if (!Number.isFinite(value)) {
      return 0;
    }
    if (value <= 1) {
      return clamp01(value);
    }
    return clamp01(value / 255);
  };
  return {
    r: toChannel(color.r),
    g: toChannel(color.g),
    b: toChannel(color.b),
    a: clamp01(color.a ?? 1),
  };
}

/**
 * Hex strings come from a palette, not from arithmetic: a scene of 30,000 rects
 * is usually five distinct colours repeated. Parsing is three `slice` calls and
 * three `parseInt`s plus an object, so re-parsing per node per frame was around
 * 120,000 allocations a frame for five distinct answers.
 *
 * Results are frozen because they are shared by every caller now.
 */
const hexCache = new Map<string, NormalizedRgba | null>();
/** A pathological scene could otherwise grow this without bound. */
const HEX_CACHE_LIMIT = 1024;

function parseHex(input: string): NormalizedRgba | null {
  const cached = hexCache.get(input);
  if (cached !== undefined) {
    return cached;
  }
  const parsed = parseHexUncached(input);
  if (hexCache.size >= HEX_CACHE_LIMIT) {
    hexCache.clear();
  }
  hexCache.set(input, parsed && Object.freeze(parsed));
  return parsed;
}

function parseHexUncached(input: string): NormalizedRgba | null {
  if (!input.startsWith("#")) {
    return null;
  }
  const hex = input.slice(1);
  if (hex.length === 3 || hex.length === 4) {
    const [rChar, gChar, bChar, aChar] = hex.split("");
    const r = Number.parseInt(`${rChar}${rChar}`, 16);
    const g = Number.parseInt(`${gChar}${gChar}`, 16);
    const b = Number.parseInt(`${bChar}${bChar}`, 16);
    const a =
      hex.length === 4 && aChar ? Number.parseInt(`${aChar}${aChar}`, 16) : 255;
    return {
      r: r / 255,
      g: g / 255,
      b: b / 255,
      a: a / 255,
    };
  }
  if (hex.length === 6 || hex.length === 8) {
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255;
    return {
      r: r / 255,
      g: g / 255,
      b: b / 255,
      a: a / 255,
    };
  }
  return null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}
