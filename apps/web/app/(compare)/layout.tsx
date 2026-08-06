"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { CompareProvider } from "@/components/compare/compare-context";
import { ComparePanel } from "@/components/compare/compare-panel";
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
      {children}
      <ComparePanel active={active} />
    </CompareProvider>
  );
}
