"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { DateInput } from "@/components/date-input";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/toast";
import { ACADEMICS } from "@/lib/endpoints";
import { hasErrors, validateAll } from "@/lib/validation";
import type {
  AcademicTermRequest,
  AcademicYearRequest,
  AcademicYearResponse,
  ApiError,
  PageResponse,
  Term,
} from "@/lib/types";

const TERM_OPTIONS: { value: Term; label: string }[] = [
  { value: "FIRST_TERM", label: "First term" },
  { value: "SECOND_TERM", label: "Second term" },
  { value: "THIRD_TERM", label: "Third term" },
];

function termLabel(term: Term): string {
  return TERM_OPTIONS.find((t) => t.value === term)?.label ?? term;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

const requiredDate = (label: string) => (v: string) =>
  v ? undefined : `${label} is required.`;

function dateRangeError(startDate: string, endDate: string): string | undefined {
  return startDate && endDate && endDate <= startDate
    ? "End date must be after the start date."
    : undefined;
}

export default function AcademicsPage() {
  const [years, setYears] = useState<AcademicYearResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    apiRequest<PageResponse<AcademicYearResponse> | AcademicYearResponse[]>(
      ACADEMICS.years,
      { query: { page: "0", size: "50" } },
    )
      .then((data) => {
        if (cancelled) return;
        setYears(Array.isArray(data) ? data : (data?.content ?? []));
        setLoadError(null);
        setLoading(false);
      })
      .catch((err: ApiError) => {
        if (cancelled) return;
        setLoadError(err.message ?? "Could not load academic years.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academics"
        description="Set up academic years and their terms. Terms drive enrollment, billing cycles, and teacher assignments."
      />

      {loadError ? (
        <Alert variant="error" title="Could not load academic years">
          {loadError}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewYearCard onCreated={refresh} />
        <NewTermCard years={years} onCreated={refresh} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Academic years
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : years.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No academic years yet. Create the first one above.
            </p>
          </Card>
        ) : (
          years.map((year) => <YearCard key={year.publicId} year={year} />)
        )}
      </section>
    </div>
  );
}

function NewYearCard({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "" });
  const [errors, setErrors] = useState<{
    name?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs = validateAll(form, {
      name: (v) => (v.trim() ? undefined : "Name is required."),
      startDate: requiredDate("Start date"),
      endDate: (v) =>
        requiredDate("End date")(v) ?? dateRangeError(form.startDate, v),
    });
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSubmitting(true);
    try {
      const payload: AcademicYearRequest = {
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      };
      await apiRequest(ACADEMICS.years, { method: "POST", body: payload });
      toast({
        title: "Academic year created",
        description: `${payload.name} has been added.`,
        variant: "success",
      });
      setForm({ name: "", startDate: "", endDate: "" });
      onCreated();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not create academic year.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          New academic year
        </h2>
      </header>
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Name" htmlFor="y-name" required error={errors.name}>
          <Input
            id="y-name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. 2026/2027 Academic Year"
            required
            invalid={!!errors.name}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Start date"
            htmlFor="y-start"
            required
            error={errors.startDate}
          >
            <DateInput
              id="y-start"
              value={form.startDate}
              onChange={(value) => setForm({ ...form, startDate: value })}
              required
              invalid={!!errors.startDate}
            />
          </Field>
          <Field
            label="End date"
            htmlFor="y-end"
            required
            error={errors.endDate}
          >
            <DateInput
              id="y-end"
              value={form.endDate}
              onChange={(value) => setForm({ ...form, endDate: value })}
              required
              invalid={!!errors.endDate}
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Create year"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NewTermCard({
  years,
  onCreated,
}: {
  years: AcademicYearResponse[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  // Only years whose numeric id is known can receive terms; the create-term
  // endpoint takes academicYearId, not the year's publicId.
  const selectableYears = years.filter(
    (y) => typeof y.academicYearId === "number",
  );
  const [form, setForm] = useState({
    yearId: "",
    termNumber: "FIRST_TERM" as Term,
    startDate: "",
    endDate: "",
  });
  const [errors, setErrors] = useState<{
    yearId?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs = validateAll(
      { yearId: form.yearId, startDate: form.startDate, endDate: form.endDate },
      {
        yearId: (v) => (v ? undefined : "Select an academic year."),
        startDate: requiredDate("Start date"),
        endDate: (v) =>
          requiredDate("End date")(v) ?? dateRangeError(form.startDate, v),
      },
    );
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSubmitting(true);
    try {
      const payload: AcademicTermRequest = {
        academicYearId: Number(form.yearId),
        termNumber: form.termNumber,
        startDate: form.startDate,
        endDate: form.endDate,
      };
      await apiRequest(ACADEMICS.terms, { method: "POST", body: payload });
      toast({
        title: "Term created",
        description: `${termLabel(form.termNumber)} has been added.`,
        variant: "success",
      });
      setForm({
        yearId: form.yearId,
        termNumber: "FIRST_TERM",
        startDate: "",
        endDate: "",
      });
      onCreated();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not create term.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          New term
        </h2>
      </header>
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}
      {selectableYears.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Create an academic year first — terms belong to a year.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Academic year"
              htmlFor="t-year"
              required
              error={errors.yearId}
            >
              <Select
                id="t-year"
                value={form.yearId}
                onChange={(e) => setForm({ ...form, yearId: e.target.value })}
                required
              >
                <option value="">Select a year…</option>
                {selectableYears.map((y) => (
                  <option key={y.publicId} value={String(y.academicYearId)}>
                    {y.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Term" htmlFor="t-number" required>
              <Select
                id="t-number"
                value={form.termNumber}
                onChange={(e) =>
                  setForm({ ...form, termNumber: e.target.value as Term })
                }
              >
                {TERM_OPTIONS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Start date"
              htmlFor="t-start"
              required
              error={errors.startDate}
            >
              <DateInput
                id="t-start"
                value={form.startDate}
                onChange={(value) =>
                  setForm({ ...form, startDate: value })
                }
                required
                invalid={!!errors.startDate}
              />
            </Field>
            <Field
              label="End date"
              htmlFor="t-end"
              required
              error={errors.endDate}
            >
              <DateInput
                id="t-end"
                value={form.endDate}
                onChange={(value) => setForm({ ...form, endDate: value })}
                required
                invalid={!!errors.endDate}
              />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" loading={submitting}>
              {submitting ? "Saving…" : "Create term"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function YearCard({ year }: { year: AcademicYearResponse }) {
  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {year.name}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(year.startDate)} – {formatDate(year.endDate)}
            {year.createdByName ? ` · Created by ${year.createdByName}` : null}
          </p>
        </div>
        <Badge>
          {year.academicTerms.length}{" "}
          {year.academicTerms.length === 1 ? "term" : "terms"}
        </Badge>
      </header>
      {year.academicTerms.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No terms yet for this year.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Term</th>
                <th className="py-2 pr-4 font-medium">Starts</th>
                <th className="py-2 font-medium">Ends</th>
              </tr>
            </thead>
            <tbody>
              {year.academicTerms.map((term) => (
                <tr
                  key={term.academicTermId}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {termLabel(term.termNumber)}
                  </td>
                  <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
                    {formatDate(term.startDate)}
                  </td>
                  <td className="py-2 text-zinc-600 dark:text-zinc-300">
                    {formatDate(term.endDate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
