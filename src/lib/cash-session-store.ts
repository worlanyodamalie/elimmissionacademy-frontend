// The API can fetch a cash session by id but has no endpoint to list them, so
// the browser remembers which sessions this device has opened or looked up.
// Purely a convenience index — the backend stays the source of truth.
//
// Exposed as an external store (like the auth session) so components read it
// through `useSyncExternalStore` instead of syncing it in an effect.

const KEY = "ema.cash.sessions";
const CHANGE_EVENT = "ema-cash-sessions-change";
const MAX_TRACKED = 12;

const EMPTY: string[] = [];

const listeners = new Set<() => void>();

// Snapshots must be referentially stable between reads, or
// useSyncExternalStore re-renders forever. Cache against the raw JSON.
let cached: string[] = EMPTY;
let cachedRaw: string | null = null;

function parse(raw: string | null): string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function readTrackedSessions(): string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = window.localStorage.getItem(KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = parse(raw);
  }
  return cached;
}

export function readTrackedSessionsServer(): string[] {
  return EMPTY;
}

export function subscribeTrackedSessions(callback: () => void): () => void {
  listeners.add(callback);
  // `storage` covers other tabs; the custom event covers this one.
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function write(next: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Most recent first, de-duplicated, capped so the list stays glanceable.
export function trackSession(publicId: string): void {
  if (typeof window === "undefined" || !publicId) return;
  write(
    [publicId, ...readTrackedSessions().filter((id) => id !== publicId)].slice(
      0,
      MAX_TRACKED,
    ),
  );
}

export function untrackSession(publicId: string): void {
  if (typeof window === "undefined") return;
  write(readTrackedSessions().filter((id) => id !== publicId));
}
