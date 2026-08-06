"use client";

import { GithubIcon } from "blode-icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DEMO_PATH,
  STRESS_TEST_REACT_DOM_PATH,
  STRESS_TEST_REACT_KONVA_PATH,
  STRESS_TEST_REACT_VELLO_PATH,
} from "@/lib/routes";

/**
 * The demo has no entry here; the wordmark is the way back to it. Labels drop
 * the "React " prefix so the Vello benchmark does not read identically to the
 * wordmark beside it, which is two links with the same text going to different
 * places. Each page's own heading still carries the full name.
 */
const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: STRESS_TEST_REACT_VELLO_PATH, label: "Vello" },
  { href: STRESS_TEST_REACT_KONVA_PATH, label: "Konva" },
  { href: STRESS_TEST_REACT_DOM_PATH, label: "DOM" },
];

function NavLink({
  href,
  isActive,
  children,
}: {
  href: string;
  isActive: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      asChild
      className="rounded-full"
      size="sm"
      variant={isActive ? "secondary" : "ghost"}
    >
      <Link aria-current={isActive ? "page" : undefined} href={href}>
        {children}
      </Link>
    </Button>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="absolute inset-x-0 top-0 z-20 flex h-[var(--header-height)] items-center justify-between gap-4 border-border/60 border-b bg-background/70 px-4 backdrop-blur-md">
      {/* Branding, not the page heading: each route's `h1` is its InfoPanel
          label, so the four pages keep distinct headings. */}
      <Link
        aria-current={pathname === DEMO_PATH ? "page" : undefined}
        className="shrink-0 truncate font-medium text-sm no-underline"
        href={DEMO_PATH}
      >
        React Vello
      </Link>
      <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&>*]:shrink-0 [&::-webkit-scrollbar]:size-0">
        {NAV_ITEMS.map((item) => (
          <NavLink
            href={item.href}
            isActive={pathname === item.href}
            key={item.href}
          >
            {item.label}
          </NavLink>
        ))}
        <Button asChild className="rounded-full" size="sm">
          <a
            href="https://github.com/mblode/react-vello"
            rel="noreferrer noopener"
            target="_blank"
          >
            <GithubIcon data-icon="inline-start" />
            GitHub
          </a>
        </Button>
      </nav>
    </header>
  );
}
