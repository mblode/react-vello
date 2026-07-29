import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Every route here is a full-screen canvas, so the only prose on the page is
 * whatever an overlay puts there. Without it the served HTML is a nav, an h1
 * and a <canvas>, which is a blank page to anything that can't run WebGPU.
 * Scrollable rather than collapsible on purpose: a <details> would keep the
 * text out of the first render and out of reach on a short viewport.
 */
export function AboutPanel({
  className,
  paragraphs,
}: {
  className?: string;
  paragraphs: readonly string[];
}): ReactNode {
  return (
    <div className={cn("space-y-2 text-muted-foreground text-xs", className)}>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
    </div>
  );
}
