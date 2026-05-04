// Returns `raw` only when it is a same-origin path. Anything else (absolute
// URL, protocol-relative `//evil.com`, backslash trick, missing leading slash)
// falls back to `fallback`. Stops `?from=` open-redirect attacks.
export function safeReturnTo(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  if (typeof raw !== "string") return fallback;
  if (raw.length > 512) return fallback;
  // Must start with exactly one slash: rules out absolute URLs and `//host/x`.
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  // Some browsers treat backslashes as path separators; `/\\evil.com` can be
  // re-parsed as a host change.
  if (raw.includes("\\")) return fallback;
  return raw;
}
