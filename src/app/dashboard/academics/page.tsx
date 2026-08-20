"use client";

import { useCallback, useState } from "react";
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
import { useToast } from "@/components/toast";
import {
  TERM_OPTIONS,
  createAcademicTerm,
  createAcademicYear,
  resolveAcademicYearId,
  termLabel,
  yearIdsByName,
  type AcademicTermRecord,
} from "@/lib/academics";
import { useAcademicTerms } from "@/lib/use-academic-terms";
import { formatDate, formatFullName } from "@/lib/utils";
import { hasErrors, validateAll } from "@/lib/validation";
import type {
  AcademicYearRequest,
  AcademicYearResponse,
  ApiError,
  Term,
} from "@/lib/types";

const requiredDate = (label: string) => (v: string) =>
  v ? undefined : `${label} is required.`;

function dateRangeError(startDate: string, endDate: string): string | undefined {
  return startDate && endDate && endDate <= startDate
    ? "End date must be after the start date."
    : undefined;
}

export default function AcademicsPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const { years, terms, currentTerm, loading, error } =
    useAcademicTerms(reloadKey);

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Academics"
        description="Set up academic years and their terms. Terms drive enrollment, billing cycles, and teacher assignments."
      />

      {error ? (
        <Alert variant="error" title="Could not load academics">
          {error}
        </Alert>
      ) : null}

      {currentTerm ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Current term
              </p>
              <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {currentTerm.label}
              </p>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatDate(currentTerm.startDate)} –{" "}
              {formatDate(currentTerm.endDate)}
            </p>
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewYearCard onCreated={refresh} />
        <NewTermCard years={years} terms={terms} onCreated={refresh} />
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
          years.map((year) => (
            <YearCard key={year.publicId} year={year} terms={terms} />
          ))
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
      await createAcademicYear(payload);
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
  terms,
  onCreated,
}: {
  years: AcademicYearResponse[];
  terms: AcademicTermRecord[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  // The create-term endpoint takes the year's numeric `academicYearId`, which
  // the year response doesn't carry — it only appears on terms that already
  // exist (docs/API-GAPS.md §1). So a year is picked by its UUID here and the
  // numeric id resolved from a sibling term; a year with no terms yet can't be
  // resolved that way, and falls back to asking for the id.
  const idsByName = yearIdsByName(terms);
  const [form, setForm] = useState({
    yearPublicId: "",
    manualYearId: "",
    termNumber: "FIRST_TERM" as Term,
    startDate: "",
    endDate: "",
  });
  const [errors, setErrors] = useState<{
    yearPublicId?: string;
    manualYearId?: string;
    startDate?: string;
    endDate?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedYear = years.find((y) => y.publicId === form.yearPublicId);
  const resolvedYearId = selectedYear
    ? resolveAcademicYearId(selectedYear, idsByName)
    : undefined;
  // Only asked for when the year has no term to borrow the id from.
  const needsManualYearId = !!selectedYear && resolvedYearId === undefined;
  const academicYearId = resolvedYearId ?? Number(form.manualYearId);

  // A year holds one of each term, so the ones already created are off-limits.
  const takenTerms = new Set(
    (selectedYear?.academicTerms ?? []).map((t) => t.termNumber),
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs = validateAll(
      {
        yearPublicId: form.yearPublicId,
        manualYearId: form.manualYearId,
        startDate: form.startDate,
        endDate: form.endDate,
      },
      {
        yearPublicId: (v) => (v ? undefined : "Select an academic year."),
        manualYearId: (v) =>
          !needsManualYearId
            ? undefined
            : /^\d+$/.test(v.trim())
              ? undefined
              : "Enter the year's numeric id.",
        startDate: requiredDate("Start date"),
        endDate: (v) =>
          requiredDate("End date")(v) ?? dateRangeError(form.startDate, v),
      },
    );
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSubmitting(true);
    try {
      const term = await createAcademicTerm({
        academicYearId,
        termNumber: form.termNumber,
        startDate: form.startDate,
        endDate: form.endDate,
      });
      toast({
        title: "Term created",
        description: `${termLabel(term.termNumber ?? form.termNumber)} has been added to ${
          term.academicYearName ?? selectedYear?.name
        }.`,
        variant: "success",
      });
      setForm({
        ...form,
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
      {years.length === 0 ? (
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
              error={errors.yearPublicId}
            >
              <Select
                id="t-year"
                value={form.yearPublicId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    yearPublicId: e.target.value,
                    manualYearId: "",
                  })
                }
                required
                invalid={!!errors.yearPublicId}
              >
                <option value="">Select a year…</option>
                {years.map((y) => (
                  <option key={y.publicId} value={y.publicId}>
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
                  <option
                    key={t.value}
                    value={t.value}
                    disabled={takenTerms.has(t.value)}
                  >
                    {t.label}
                    {takenTerms.has(t.value) ? " (already created)" : ""}
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
                onChange={(value) => setForm({ ...form, startDate: value })}
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
          {needsManualYearId ? (
            <Field
              label="Academic year numeric id"
              htmlFor="t-year-id"
              required
              error={errors.manualYearId}
              hint="This year has no terms yet, and the API doesn't return a year's numeric id — enter it once, and later terms will pick it up automatically."
            >
              <Input
                id="t-year-id"
                inputMode="numeric"
                value={form.manualYearId}
                onChange={(e) =>
                  setForm({ ...form, manualYearId: e.target.value })
                }
                placeholder="e.g. 1"
                invalid={!!errors.manualYearId}
                aria-invalid={!!errors.manualYearId}
              />
            </Field>
          ) : null}
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

function YearCard({
  year,
  terms,
}: {
  year: AcademicYearResponse;
  terms: AcademicTermRecord[];
}) {
  // The merged records, not `year.academicTerms`, so the rows can show the
  // current-term badge and survive either academic call failing.
  const createdBy = formatFullName(year.createdByName);
  const yearTerms = terms.filter(
    (t) =>
      t.academicYearName.trim().toLowerCase() === year.name.trim().toLowerCase(),
  );

  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {year.name}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {formatDate(year.startDate)} – {formatDate(year.endDate)}
            {createdBy ? ` · Created by ${createdBy}` : null}
          </p>
        </div>
        <Badge>
          {yearTerms.length} {yearTerms.length === 1 ? "term" : "terms"}
        </Badge>
      </header>
      {yearTerms.length === 0 ? (
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
              {yearTerms.map((term) => (
                <tr
                  key={term.publicId ?? term.academicTermId ?? term.termNumber}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                    <span className="inline-flex items-center gap-2">
                      {termLabel(term.termNumber)}
                      {term.isCurrent ? (
                        <Badge variant="success">Current</Badge>
                      ) : null}
                    </span>
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
