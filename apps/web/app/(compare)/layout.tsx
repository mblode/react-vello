"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CompareProvider } from "@/components/compare/compare-context";
import { ComparePanel } from "@/components/compare/compare-panel";
import { SiteFooter } from "@/components/site-footer";
import { getRendererByPath, RENDERERS } from "@/lib/renderers";

/**
 * The three renderer routes are one surface, so the shared state lives here.
 * Moving between them is a sibling navigation under this layout, which is what
 * keeps a result measured on one renderer on screen while you measure the next.
 */
export default function CompareLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const active = getRendererByPath(pathname) ?? RENDERERS[0];

  return (
    <CompareProvider>
      {/* Pinned rather than scrolling: a benchmark you can scroll away from
          measures the scroll as much as the renderer. */}
      <div className="fixed inset-0 overflow-hidden bg-background">
        {children}
        <ComparePanel active={active} />
        <SiteFooter floating />
      </div>
    </CompareProvider>
  );
}
