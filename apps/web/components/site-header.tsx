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
    <Button
      asChild
      className="pointer-events-auto"
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
    <header className="pointer-events-none absolute top-4 right-4 left-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h1 className="font-semibold text-foreground/90 text-sm tracking-wide">
        {PAGE_HEADINGS[pathname] ?? "React Vello"}
      </h1>
      <nav className="flex flex-wrap items-center gap-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            href={item.href}
            isActive={pathname === item.href}
            key={item.href}
          >
            {item.label}
          </NavLink>
        ))}
        <Button
          asChild
          className="pointer-events-auto"
          size="sm"
          variant="outline"
        >
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
