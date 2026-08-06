import { ChevronRightIcon } from "blode-icons-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The overlay every route hangs its prose and controls off. Each page is a
 * full-screen canvas, so without this the served HTML is a nav, an `h1` and a
 * `<canvas>` — nothing to read without WebGPU, and nothing to index.
 *
 * The long-form copy sits in a closed `<details>`: it still ships in the server
 * HTML and stays crawlable, it just isn't shouting over the thing it describes.
 */
export function InfoPanel({
  label,
  summary,
  detail,
  children,
  className,
}: {
  label: string;
  summary: string;
  detail: readonly string[];
  children?: ReactNode;
  className?: string;
}): ReactNode {
  return (
    <section
      className={cn(
        // Sits above the credit badge on a phone, beside it from `sm` up.
        "absolute bottom-16 left-4 z-10 w-[min(22rem,calc(100vw-2rem))] sm:bottom-4",
        "rounded-xl border border-border bg-card/85 p-4 shadow-soft backdrop-blur-md",
        className
      )}
    >
      {/* This is the route's `h1`: the header carries the wordmark, not the
          page name, so the heading that names the page lives here. */}
      <h1 className="font-medium text-muted-foreground text-xs">{label}</h1>
      <p className="mt-1 text-pretty text-sm leading-relaxed">{summary}</p>

      {children}

      <details className="group mt-3 border-border border-t pt-3">
        <summary className="-m-1 flex list-none items-center gap-1 rounded-md p-1 font-medium text-muted-foreground text-xs transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
          <ChevronRightIcon
            aria-hidden="true"
            className="size-3.5 transition-transform duration-150 group-open:rotate-90"
          />
          How it works
        </summary>
        <div className="mt-2 max-h-[min(40vh,18rem)] space-y-2 overflow-y-auto text-muted-foreground text-xs leading-relaxed">
          {detail.map((paragraph) => (
            <p key={paragraph.slice(0, 40)}>{paragraph}</p>
          ))}
        </div>
      </details>
    </section>
  );
}
