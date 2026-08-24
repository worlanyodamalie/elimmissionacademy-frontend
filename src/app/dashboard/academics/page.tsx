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
} from "@/components/ui";
import { DateInput } from "@/components/date-input";
import { useToast } from "@/components/toast";
import {
  createAcademicYear,
  termLabel,
  updateAcademicTerm,
  type AcademicTermRecord,
} from "@/lib/academics";
import { useAcademicTerms } from "@/lib/use-academic-terms";
import { formatDate, formatFullName } from "@/lib/utils";
import { hasErrors, validateAll } from "@/lib/validation";
import type {
  AcademicYearRequest,
  AcademicYearResponse,
  ApiError,
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
        description="Set up academic years and adjust their term dates. Terms drive enrollment, billing cycles, and teacher assignments."
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

      <NewYearCard onCreated={refresh} />

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
            <YearCard
              key={year.publicId}
              year={year}
              terms={terms}
              onUpdated={refresh}
            />
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

// A year's terms are created by the backend along with the year itself, so the
// only thing to do here is correct their dates. Editing happens inline, one row
// at a time.
function YearCard({
  year,
  terms,
  onUpdated,
}: {
  year: AcademicYearResponse;
  terms: AcademicTermRecord[];
  onUpdated: () => void;
}) {
  // The merged records, not `year.academicTerms`, so the rows can show the
  // current-term badge and carry the `publicId` that the update call needs.
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
          No terms for this year. Terms are created automatically with the
          academic year — if this stays empty, the year was created before that
          behaviour shipped.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Term</th>
                <th className="py-2 pr-4 font-medium">Starts</th>
                <th className="py-2 pr-4 font-medium">Ends</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {yearTerms.map((term) => (
                <TermRow
                  key={term.publicId ?? term.academicTermId ?? term.termNumber}
                  term={term}
                  onUpdated={onUpdated}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function TermRow({
  term,
  onUpdated,
}: {
  term: AcademicTermRecord;
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    startDate: term.startDate,
    endDate: term.endDate,
  });
  const [errors, setErrors] = useState<{
    startDate?: string;
    endDate?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The update call addresses the term by UUID, which only `GET /academics/terms`
  // supplies. If that call failed, the row still renders from the year summary
  // but there's nothing to PUT against.
  const canEdit = !!term.publicId;

  function startEditing() {
    setForm({ startDate: term.startDate, endDate: term.endDate });
    setErrors({});
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setError(null);

    const errs = validateAll(form, {
      startDate: requiredDate("Start date"),
      endDate: (v) =>
        requiredDate("End date")(v) ?? dateRangeError(form.startDate, v),
    });
    setErrors(errs);
    if (hasErrors(errs)) return;

    setSubmitting(true);
    try {
      await updateAcademicTerm(term.publicId!, {
        startDate: form.startDate,
        endDate: form.endDate,
      });
      toast({
        title: "Term dates updated",
        description: `${term.label} now runs ${formatDate(form.startDate)} – ${formatDate(form.endDate)}.`,
        variant: "success",
      });
      setEditing(false);
      onUpdated();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not update the term dates.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
        <td className="py-2 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
          <span className="inline-flex items-center gap-2">
            {termLabel(term.termNumber)}
            {term.isCurrent ? <Badge variant="success">Current</Badge> : null}
          </span>
        </td>
        <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
          {formatDate(term.startDate)}
        </td>
        <td className="py-2 pr-4 text-zinc-600 dark:text-zinc-300">
          {formatDate(term.endDate)}
        </td>
        <td className="py-2 text-right">
          {canEdit ? (
            <Button variant="secondary" size="sm" onClick={startEditing}>
              Edit dates
            </Button>
          ) : null}
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
      <td className="py-2 pr-4 align-top font-medium text-zinc-900 dark:text-zinc-100">
        <span className="inline-flex items-center gap-2">
          {termLabel(term.termNumber)}
          {term.isCurrent ? <Badge variant="success">Current</Badge> : null}
        </span>
        {error ? (
          <div className="mt-2 max-w-xs">
            <Alert variant="error" title="Could not save">
              {error}
            </Alert>
          </div>
        ) : null}
      </td>
      <td className="py-2 pr-4 align-top">
        <Field
          label="Start date"
          htmlFor={`t-start-${term.publicId}`}
          required
          error={errors.startDate}
        >
          <DateInput
            id={`t-start-${term.publicId}`}
            value={form.startDate}
            onChange={(value) => setForm({ ...form, startDate: value })}
            required
            invalid={!!errors.startDate}
          />
        </Field>
      </td>
      <td className="py-2 pr-4 align-top">
        <Field
          label="End date"
          htmlFor={`t-end-${term.publicId}`}
          required
          error={errors.endDate}
        >
          <DateInput
            id={`t-end-${term.publicId}`}
            value={form.endDate}
            onChange={(value) => setForm({ ...form, endDate: value })}
            required
            invalid={!!errors.endDate}
          />
        </Field>
      </td>
      <td className="py-2 align-top">
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} loading={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </td>
    </tr>
  );
}
