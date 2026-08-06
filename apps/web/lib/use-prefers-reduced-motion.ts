"use client";

import { useMediaQuery } from "@/lib/use-media-query";

/** Server renders as "motion allowed", matching the client's pre-hydration DOM. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}
