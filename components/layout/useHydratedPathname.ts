"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

const subscribe = () => () => {};
const serverSnapshot = () => null;

/** Share a neutral snapshot for SSR/hydration; Next's router drives later updates. */
export function useHydratedPathname(): string | null {
  const pathname = usePathname();
  return useSyncExternalStore(subscribe, () => pathname, serverSnapshot);
}
