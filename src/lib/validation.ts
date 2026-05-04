// Lightweight client-side validators. They return an error string when invalid,
// or `undefined` when the value passes. Server-side validation is still the
// source of truth — these only protect the user from obvious mistakes.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Accept E.164-style international numbers: optional + then 8–15 digits.
const PHONE_RE = /^\+?\d{8,15}$/;
// School codes from the API look like "ELI_cac4d" — letters/digits/underscore.
const SCHOOL_CODE_RE = /^[A-Za-z0-9_-]{3,32}$/;

export type Validator<T = string> = (value: T) => string | undefined;

export function required(label = "This field"): Validator<string> {
  return (v) => (v && v.trim().length > 0 ? undefined : `${label} is required.`);
}

export function email(value: string): string | undefined {
  if (!value) return undefined;
  return EMAIL_RE.test(value.trim())
    ? undefined
    : "Enter a valid email address.";
}

export function phone(value: string): string | undefined {
  if (!value) return undefined;
  const stripped = value.replace(/[\s-()]/g, "");
  return PHONE_RE.test(stripped)
    ? undefined
    : "Enter a valid phone number, including country code.";
}

export function minLength(min: number, label = "This field"): Validator<string> {
  return (v) =>
    v && v.length >= min ? undefined : `${label} must be at least ${min} characters.`;
}

export function maxLength(max: number, label = "This field"): Validator<string> {
  return (v) =>
    !v || v.length <= max
      ? undefined
      : `${label} must be at most ${max} characters.`;
}

export function schoolCode(value: string): string | undefined {
  if (!value) return undefined;
  return SCHOOL_CODE_RE.test(value.trim())
    ? undefined
    : "School code must be 3–32 letters, digits, or underscores.";
}

export function password(value: string): string | undefined {
  if (!value) return undefined;
  if (value.length < 8) return "Password must be at least 8 characters.";
  if (value.length > 128) return "Password is too long.";
  return undefined;
}

export function dateNotInFuture(label = "Date"): Validator<string> {
  return (v) => {
    if (!v) return undefined;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return `${label} is not a valid date.`;
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return d.getTime() <= today.getTime()
      ? undefined
      : `${label} cannot be in the future.`;
  };
}

export function combine(
  ...validators: Array<Validator<string> | ((v: string) => string | undefined)>
): Validator<string> {
  return (v) => {
    for (const fn of validators) {
      const err = fn(v);
      if (err) return err;
    }
    return undefined;
  };
}

// Hook-free helper: collect errors from a record of validators.
export function validateAll<K extends string>(
  values: Record<K, string>,
  rules: Partial<Record<K, Validator<string>>>,
): Partial<Record<K, string>> {
  const errors: Partial<Record<K, string>> = {};
  (Object.keys(rules) as K[]).forEach((key) => {
    const rule = rules[key];
    if (!rule) return;
    const err = rule(values[key] ?? "");
    if (err) errors[key] = err;
  });
  return errors;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean);
}
