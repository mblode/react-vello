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

const NAV_ITEMS: Array<{ href: string; label: string }> = [
  { href: DEMO_PATH, label: "Demo" },
  { href: STRESS_TEST_REACT_VELLO_PATH, label: "React Vello" },
  { href: STRESS_TEST_REACT_KONVA_PATH, label: "React Konva" },
  { href: STRESS_TEST_REACT_DOM_PATH, label: "React DOM" },
];

/** The header title doubles as each route's `h1`, so it names the page. */
const PAGE_HEADINGS: Record<string, string> = {
  [DEMO_PATH]: "React Vello Demo",
  [STRESS_TEST_REACT_VELLO_PATH]: "React Vello Stress Test",
  [STRESS_TEST_REACT_KONVA_PATH]: "React Konva Stress Test",
  [STRESS_TEST_REACT_DOM_PATH]: "React DOM Stress Test",
};

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
    <Button asChild size="sm" variant={isActive ? "secondary" : "ghost"}>
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
      {/* Kept in the accessibility tree at every width; it just yields its
          pixels to the nav on a phone, where the active tab says where you are. */}
      <h1 className="sr-only font-medium text-sm sm:not-sr-only sm:truncate">
        {PAGE_HEADINGS[pathname] ?? "React Vello"}
      </h1>
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
        <Button asChild size="sm" variant="outline">
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
