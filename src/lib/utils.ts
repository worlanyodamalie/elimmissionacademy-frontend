import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// Merges class names and lets later Tailwind utilities win over earlier ones,
// so a caller's `className` can override a component's defaults.
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getInitials(
  firstName?: string | null,
  lastName?: string | null,
  fallback = "?",
): string {
  const a = firstName?.trim()?.[0] ?? "";
  const b = lastName?.trim()?.[0] ?? "";
  const initials = `${a}${b}`.toUpperCase();
  return initials || fallback;
}

// SCREAMING_SNAKE_CASE enum → "Sentence case" for display.
export function formatEnumLabel(value: string | undefined | null): string {
  if (!value) return "—";
  const words = value.toLowerCase().split("_").join(" ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// The backend spells the euro "EURO"; Intl needs the ISO code.
const ISO_CURRENCY: Record<string, string> = { EURO: "EUR" };

export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined = "GHS",
): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }
  const code = ISO_CURRENCY[currency ?? ""] ?? currency ?? "GHS";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code — show the amount with the raw code instead.
    return `${code} ${amount.toFixed(2)}`;
  }
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

// --- Date-only helpers (the API's date fields are plain YYYY-MM-DD) ---------
// Built from local date parts so a timezone west of UTC doesn't report
// yesterday as today.

export function todayIso(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function shiftIsoDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  // Month is 0-indexed; Date normalizes overflow, so this handles month ends.
  const shifted = new Date(y, (m ?? 1) - 1, (d ?? 1) + days);
  const month = `${shifted.getMonth() + 1}`.padStart(2, "0");
  const day = `${shifted.getDate()}`.padStart(2, "0");
  return `${shifted.getFullYear()}-${month}-${day}`;
}

// Whole days from `from` to `to`, both YYYY-MM-DD. Negative if `to` is earlier.
export function daysBetweenIso(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, (fm ?? 1) - 1, fd ?? 1);
  const b = Date.UTC(ty, (tm ?? 1) - 1, td ?? 1);
  return Math.round((b - a) / 86_400_000);
}

export function formatRoleLabel(role: string | undefined | null): string {
  if (!role) return "User";
  return role
    .replace(/^ROLE_/, "")
    .toLowerCase()
    .replace(/(^|\s|_)([a-z])/g, (_m, p, c) => `${p === "_" ? " " : p}${c.toUpperCase()}`)
    .replace(/_/g, " ");
}
