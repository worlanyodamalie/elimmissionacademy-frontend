"use client";

import { useState } from "react";
import { Button } from "./ui";

type Props = {
  code: string;
  title?: string;
  description?: string;
};

export function SchoolCodeCard({
  code,
  title = "Save your school code",
  description = "You'll need this code every time you sign in. Keep it somewhere safe.",
}: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!code) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers / non-secure contexts.
        const ta = document.createElement("textarea");
        ta.value = code;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Best-effort; user can still read it.
    }
  }

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/40">
      <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
        {title}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <code
          className="select-all rounded-md bg-white px-3 py-2 font-mono text-base font-semibold tracking-wide text-indigo-900 ring-1 ring-inset ring-indigo-200 dark:bg-zinc-950 dark:text-indigo-100 dark:ring-indigo-900/60"
          aria-label="School code"
        >
          {code}
        </code>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={copy}
          aria-live="polite"
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p className="mt-2 text-xs text-indigo-800/80 dark:text-indigo-200/80">
        {description}
      </p>
    </div>
  );
}
