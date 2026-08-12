"use client";

import { useId, useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

// The date field used everywhere in the dashboard, replacing `<input
// type="date">`. The native control renders differently in every browser, hides
// its picker behind a small glyph, and on desktop Safari offers no picker at
// all — which matters when the person entering a date of birth is using
// whatever machine the school office has.
//
// Values are plain `YYYY-MM-DD` in and out, matching the API's date fields.
// Conversion goes through local date parts on purpose: `new Date("2015-04-02")`
// parses as UTC, which lands on the previous day for anyone west of Greenwich.

function isoToDate(iso: string | undefined | null): Date | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function dateToIso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatLong(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export type DateInputProps = {
  id?: string;
  /** `YYYY-MM-DD`, or "" when empty. */
  value: string;
  /** Receives `YYYY-MM-DD`, or "" when cleared. */
  onChange: (value: string) => void;
  /** Earliest selectable date, `YYYY-MM-DD`. */
  min?: string;
  /** Latest selectable date, `YYYY-MM-DD`. */
  max?: string;
  required?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Emitted as a hidden input so native form reads still see the value. */
  name?: string;
  placeholder?: string;
  className?: string;
  "aria-describedby"?: string;
};

export function DateInput({
  id,
  value,
  onChange,
  min,
  max,
  required,
  disabled,
  invalid,
  name,
  placeholder = "Select a date",
  className,
  "aria-describedby": describedBy,
}: DateInputProps) {
  const [open, setOpen] = useState(false);
  // Radix wires aria-expanded/aria-controls at runtime, but naming the popover
  // ourselves keeps the relationship visible in the source too.
  const contentId = `${useId()}-calendar`;

  const selected = useMemo(() => isoToDate(value), [value]);
  const minDate = useMemo(() => isoToDate(min), [min]);
  const maxDate = useMemo(() => isoToDate(max), [max]);

  // The year dropdown spans this range, so a date of birth is two clicks rather
  // than 300 taps on the previous-month arrow.
  const startMonth = useMemo(
    () => minDate ?? new Date(new Date().getFullYear() - 100, 0, 1),
    [minDate],
  );
  const endMonth = useMemo(
    () => maxDate ?? new Date(new Date().getFullYear() + 10, 11, 31),
    [maxDate],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={value} />
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          // A plain button role supports neither aria-required nor
          // aria-invalid. This control picks a value from a popup, which is
          // what combobox describes — and it accepts both.
          role="combobox"
          aria-expanded={open}
          aria-controls={contentId}
          aria-required={required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm shadow-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:focus:border-indigo-400 dark:disabled:bg-zinc-900",
            selected
              ? "text-zinc-900 dark:text-zinc-100"
              : "text-zinc-400 dark:text-zinc-500",
            invalid &&
              "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 dark:border-rose-500/60",
            className,
          )}
        >
          <span className="truncate">
            {selected ? formatLong(selected) : placeholder}
          </span>
          <CalendarIcon />
        </button>
      </PopoverTrigger>
      <PopoverContent id={contentId} className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            if (!date) return;
            onChange(dateToIso(date));
            setOpen(false);
          }}
          defaultMonth={selected ?? (maxDate && maxDate < new Date() ? maxDate : undefined)}
          startMonth={startMonth}
          endMonth={endMonth}
          captionLayout="dropdown"
          disabled={[
            ...(minDate ? [{ before: minDate }] : []),
            ...(maxDate ? [{ after: maxDate }] : []),
          ]}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}

function CalendarIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500"
      aria-hidden
    >
      <rect x="3" y="4.5" width="18" height="16" rx="2" />
      <path d="M3 9.5h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}
