"use client";

// Error reporting for forms long enough that the top of the page is off-screen
// by the time someone presses submit.
//
// Two different failures, two different answers:
//
//   Validation — some field is wrong, so `focusFirstError` scrolls to it and
//   puts the cursor in it. The field's own inline message is the explanation;
//   there is no banner, because a banner would just be one more thing to scroll
//   back to.
//
//   Server — nothing in the form is identifiably at fault, so there is nothing
//   to jump to. `<FormError>` renders beside the submit button instead, which
//   is where the user is already looking, having just clicked it.
//
// Both keep the message on screen until it's resolved; neither auto-dismisses,
// because the user has to act on it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "./ui";

// Scrolling a message the user can already see only jolts the page.
function ensureVisible(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const fullyVisible =
    rect.top >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight);
  if (!fullyVisible) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

export type UseFormError = {
  error: string | null;
  // Changes on every `setError` call, so re-submitting and getting the *same*
  // message back still re-announces it instead of looking like nothing
  // happened.
  errorNonce: number;
  setError: (message: string | null) => void;
};

export function useFormError(): UseFormError {
  const [state, setState] = useState<{
    message: string;
    nonce: number;
  } | null>(null);

  const setError = useCallback((message: string | null) => {
    setState((prev) =>
      message ? { message, nonce: (prev?.nonce ?? 0) + 1 } : null,
    );
  }, []);

  return {
    error: state?.message ?? null,
    errorNonce: state?.nonce ?? 0,
    setError,
  };
}

// Render this next to the submit button, not at the top of the form.
export function FormError({
  error,
  nonce = 0,
  title = "Could not save",
}: {
  error: string | null;
  nonce?: number;
  title?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!error) return;
    const el = ref.current;
    if (!el) return;
    ensureVisible(el);
    // `Alert` already carries role="alert" for the error variant, so this is
    // belt and braces for screen readers — and it moves keyboard focus out of
    // the submit button to the thing explaining why it didn't work.
    el.focus({ preventScroll: true });
  }, [error, nonce]);

  if (!error) return null;

  return (
    <div ref={ref} tabIndex={-1} className="scroll-mt-6 outline-none">
      <Alert variant="error" title={title}>
        {error}
      </Alert>
    </div>
  );
}

// Scrolls to the first field that failed validation and focuses it.
//
// `errors` is the object `validateAll` returns. A key is assumed to be the id
// of its own input — true for most forms here — and `idsByKey` overrides the
// ones where it isn't, such as the shared address fields, whose ids carry a
// prefix (`school-region`) that their error keys don't (`addressRegion`).
//
// "First" is decided by document order rather than key order, so re-ordering
// the validation rules can't silently send someone to the wrong end of the
// form. Returns whether it found anything to focus.
export function focusFirstError(
  errors: Record<string, string | undefined>,
  idsByKey: Record<string, string> = {},
): boolean {
  if (typeof document === "undefined") return false;

  const elements = Object.entries(errors)
    .filter(([, message]) => !!message)
    .map(([key]) => document.getElementById(idsByKey[key] ?? key))
    .filter((el): el is HTMLElement => el !== null);

  if (elements.length === 0) return false;

  const first = elements.reduce((earliest, el) =>
    earliest.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING
      ? el
      : earliest,
  );

  ensureVisible(first);
  first.focus({ preventScroll: true });
  return true;
}
