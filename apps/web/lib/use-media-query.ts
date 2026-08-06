"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Server renders as "no match", matching the client's pre-hydration DOM. Every
 * caller therefore has to pick a query whose false branch is the safe default.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
