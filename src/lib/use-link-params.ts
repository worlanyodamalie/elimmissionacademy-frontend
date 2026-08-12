"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Reads one-time link credentials (setup/reset tokens and the school code) out
 * of the query string, then scrubs them from the visible URL so they don't sit
 * in browser history, sync, screenshots, or leak via Referer to third-party
 * assets.
 *
 * The values are latched on the first complete read because Next.js wires
 * `history.replaceState` into the router: scrubbing the URL makes
 * `useSearchParams` re-render with an empty set, which would otherwise wipe the
 * credentials we just read and make a valid link look invalid.
 *
 * `keys` maps a result name to the query-string aliases to try, in order.
 */
export function useLinkParams<K extends string>(
  keys: Record<K, readonly string[]>,
): Record<K, string> {
  const params = useSearchParams();
  const [latched, setLatched] = useState<Record<K, string> | null>(null);

  const read = {} as Record<K, string>;
  let complete = true;
  for (const key of Object.keys(keys) as K[]) {
    const value =
      keys[key].map((name) => (params.get(name) ?? "").trim()).find(Boolean) ??
      "";
    read[key] = value;
    if (!value) complete = false;
  }

  // Only latch once every value is present: on a static prerender the params
  // are empty, and freezing that empty read would break the real link. This is
  // React's "adjusting state during render" — it re-runs this component
  // immediately, before children render or the browser paints.
  if (complete && !latched) setLatched(read);

  const values = latched ?? read;
  const scrub = complete || latched !== null;

  useEffect(() => {
    if (!scrub) return;
    if (typeof window === "undefined") return;
    if (!window.location.search) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [scrub]);

  return values;
}
