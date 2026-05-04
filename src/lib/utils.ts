export function cn(
  ...classes: Array<string | false | null | undefined>
): string {
  return classes.filter(Boolean).join(" ");
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

export function formatRoleLabel(role: string | undefined | null): string {
  if (!role) return "User";
  return role
    .replace(/^ROLE_/, "")
    .toLowerCase()
    .replace(/(^|\s|_)([a-z])/g, (_m, p, c) => `${p === "_" ? " " : p}${c.toUpperCase()}`)
    .replace(/_/g, " ");
}
