"use client";

// Small building blocks shared by the billing and collections pages.

import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input } from "./ui";
import { apiRequest } from "@/lib/api";
import { ACADEMICS } from "@/lib/endpoints";
import { cn, formatEnumLabel, formatMoney } from "@/lib/utils";
import type {
  AcademicTermResponse,
  AcademicYearResponse,
  BillPaymentStatus,
  CashSessionStatus,
  PageResponse,
  PaymentStatus,
} from "@/lib/types";

export function BillStatusBadge({ status }: { status?: BillPaymentStatus }) {
  const variant =
    status === "PAID"
      ? "success"
      : status === "PARTIALLY_PAID"
        ? "warning"
        : status === "VOID"
          ? "neutral"
          : "danger";
  return <Badge variant={variant}>{formatEnumLabel(status)}</Badge>;
}

export function PaymentStatusBadge({ status }: { status?: PaymentStatus }) {
  const variant =
    status === "SUCCESSFUL" || status === "CONFIRMED"
      ? "success"
      : status === "PENDING"
        ? "warning"
        : status === "FAILED" || status === "REVERSED"
          ? "danger"
          : "neutral";
  return <Badge variant={variant}>{formatEnumLabel(status)}</Badge>;
}

export function SessionStatusBadge({ status }: { status?: CashSessionStatus }) {
  const variant =
    status === "OPEN"
      ? "info"
      : status === "APPROVED"
        ? "success"
        : status === "PENDING_APPROVAL"
          ? "warning"
          : "neutral";
  return <Badge variant={variant}>{formatEnumLabel(status)}</Badge>;
}

// A headline figure. `tone` colours the number for balances and variances.
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-lg font-semibold tabular-nums",
          tone === "positive" && "text-emerald-600 dark:text-emerald-400",
          tone === "negative" && "text-rose-600 dark:text-rose-400",
          tone === "default" && "text-zinc-900 dark:text-zinc-100",
        )}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function Money({
  amount,
  currency,
}: {
  amount?: number | null;
  currency?: string | null;
}) {
  return <span className="tabular-nums">{formatMoney(amount, currency)}</span>;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      {children ? (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {children}
        </p>
      ) : null}
    </Card>
  );
}

export function Pagination({
  page,
  totalPages,
  totalElements,
  onPageChange,
  loading,
}: {
  page: number;
  totalPages: number;
  totalElements: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
}) {
  if (totalElements === 0) return null;
  const pages = Math.max(totalPages, 1);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Page {page + 1} of {pages} · {totalElements}{" "}
        {totalElements === 1 ? "record" : "records"}
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page === 0 || loading}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={page + 1 >= pages || loading}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// The API takes numeric ids in request bodies but only ever returns public
// UUIDs, so a handful of fields can't be turned into a picker yet. This keeps
// the explanation identical everywhere one of them appears.
export const NUMERIC_ID_HINT =
  "Numeric id from the backend — list responses only expose UUIDs, so this can't be picked yet.";

export function NumericIdField({
  label,
  id,
  value,
  onChange,
  required,
  error,
  hint = NUMERIC_ID_HINT,
  placeholder = "e.g. 12",
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} htmlFor={id} required={required} error={error} hint={hint}>
      <Input
        id={id}
        type="number"
        min={1}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        invalid={!!error}
        aria-invalid={!!error}
      />
    </Field>
  );
}

export type TermOption = {
  academicTermId: number;
  label: string;
};

// Academic terms, flattened out of the years list, for the "which term is this
// bill for?" selects. Terms carry a numeric id, so these can be real pickers.
export function useAcademicTerms(): {
  terms: TermOption[];
  loading: boolean;
  error: string | null;
} {
  const [terms, setTerms] = useState<TermOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<PageResponse<AcademicYearResponse> | AcademicYearResponse[]>(
      ACADEMICS.years,
      { query: { page: "0", size: "100" }, signal: controller.signal },
    )
      .then((data) => {
        const years = Array.isArray(data) ? data : (data?.content ?? []);
        setTerms(
          years.flatMap((year) =>
            (year.academicTerms ?? []).map((term) => ({
              academicTermId: term.academicTermId,
              label: `${year.name} · ${formatEnumLabel(term.termNumber)}`,
            })),
          ),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          (err as { message?: string }).message ??
            "Could not load academic terms.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { terms, loading, error };
}

export type TermRecord = {
  publicId: string;
  label: string;
};

// Terms keyed by their public UUID — what the arrears endpoint expects. The
// years list only carries numeric term ids, hence the separate fetch.
export function useAcademicTermRecords(): {
  terms: TermRecord[];
  loading: boolean;
  error: string | null;
} {
  const [terms, setTerms] = useState<TermRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<
      PageResponse<AcademicTermResponse> | AcademicTermResponse[]
    >(ACADEMICS.terms, {
      query: { page: "0", size: "100" },
      signal: controller.signal,
    })
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.content ?? []);
        setTerms(
          list.map((term) => ({
            publicId: term.publicId,
            label: `${term.academicYearName} · ${formatEnumLabel(term.termNumber)}`,
          })),
        );
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          (err as { message?: string }).message ?? "Could not load terms.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return { terms, loading, error };
}
