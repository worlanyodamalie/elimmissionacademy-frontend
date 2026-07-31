"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import {
  BillStatusBadge,
  EmptyState,
  Money,
  NumericIdField,
  Pagination,
  StatTile,
  useAcademicTermRecords,
  useAcademicTerms,
} from "@/components/billing-ui";
import { BillingIcon, CashIcon, ChevronRightIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  carryForwardArrears,
  createStudentBill,
  listStudentBills,
} from "@/lib/billing";
import { ROUTES } from "@/lib/endpoints";
import { formatDate, formatMoney } from "@/lib/utils";
import type { ApiError, StudentBillResponse } from "@/lib/types";

const PAGE_SIZE = 10;

export default function BillingPage() {
  const [bills, setBills] = useState<StudentBillResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Deriving "loading" from which fetch has landed keeps the effect free of
  // synchronous setState, which React flags as a cascading render.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const fetchKey = `${page}|${reloadKey}`;
  const loading = loadedKey !== fetchKey;

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    listStudentBills(
      { page, size: PAGE_SIZE, sort: "createdAt,desc" },
      controller.signal,
    )
      .then((data) => {
        setBills(data.content);
        setTotalPages(data.totalPages ?? 1);
        setTotalElements(data.totalElements ?? data.content.length);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setLoadError(err.message ?? "Could not load student bills.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(fetchKey);
      });
    return () => controller.abort();
  }, [page, fetchKey]);

  // Totals for the bills on this page — a page-level snapshot, not a
  // school-wide figure, so the label says so.
  const outstanding = bills.reduce((sum, b) => sum + (b.totalBalanceDue ?? 0), 0);
  const collected = bills.reduce((sum, b) => sum + (b.totalPaid ?? 0), 0);
  const currency = bills[0]?.currency ?? "GHS";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing"
        description="Open a bill for each student per term, then add the charges that make it up. Bills drive what the cash office can collect."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Bills on this page"
          value={String(totalElements)}
          hint={`Showing ${bills.length}`}
        />
        <StatTile
          label="Outstanding (this page)"
          value={formatMoney(outstanding, currency)}
          tone={outstanding > 0 ? "negative" : "default"}
        />
        <StatTile
          label="Paid (this page)"
          value={formatMoney(collected, currency)}
          tone={collected > 0 ? "positive" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SectionLink
          href={ROUTES.serviceCosts}
          title="Price list"
          description="Service costs charged per class level"
        />
        <SectionLink
          href={ROUTES.overdue}
          title="Overdue"
          description="Charges past their due date, oldest first"
        />
        <SectionLink
          href={ROUTES.charges}
          title="Charges"
          description="Every line item, filterable"
        />
        <SectionLink
          href={ROUTES.discounts}
          title="Discounts"
          description="Discounts and who qualifies automatically"
        />
        <SectionLink
          href={ROUTES.collections}
          title="Collections"
          description="Cash sessions and recorded payments"
          icon="cash"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewBillCard onCreated={refresh} />
        <CarryForwardCard />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Student bills
        </h2>

        {loadError ? (
          <Alert variant="error" title="Could not load student bills">
            {loadError}
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : bills.length === 0 ? (
          <EmptyState title="No bills yet">
            Create the first bill above. The backend applies mandatory service
            costs and any discounts the student qualifies for.
          </EmptyState>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2 pr-4 font-medium">Bill</th>
                    <th className="py-2 pr-4 font-medium">Student</th>
                    <th className="py-2 pr-4 font-medium">Term</th>
                    <th className="py-2 pr-4 font-medium">Issued</th>
                    <th className="py-2 pr-4 text-right font-medium">Total</th>
                    <th className="py-2 pr-4 text-right font-medium">Paid</th>
                    <th className="py-2 pr-4 text-right font-medium">Balance</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => (
                    <tr
                      key={bill.publicId}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="py-2.5 pr-4">
                        <Link
                          href={ROUTES.bill(bill.publicId)}
                          className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                        >
                          {bill.billNumber}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-900 dark:text-zinc-100">
                        {bill.studentName}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {bill.academicTermName}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {formatDate(bill.issueDate)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-zinc-900 dark:text-zinc-100">
                        <Money amount={bill.totalAmount} currency={bill.currency} />
                      </td>
                      <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                        <Money amount={bill.totalPaid} currency={bill.currency} />
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        <Money
                          amount={bill.totalBalanceDue}
                          currency={bill.currency}
                        />
                      </td>
                      <td className="py-2.5">
                        <BillStatusBadge status={bill.paymentStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              onPageChange={setPage}
              loading={loading}
            />
          </Card>
        )}
      </section>
    </div>
  );
}

function SectionLink({
  href,
  title,
  description,
  icon = "billing",
}: {
  href: string;
  title: string;
  description: string;
  icon?: "billing" | "cash";
}) {
  const Icon = icon === "cash" ? CashIcon : BillingIcon;
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-indigo-800"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-400" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
      <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-indigo-500" />
    </Link>
  );
}

function NewBillCard({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const { terms, loading: termsLoading, error: termsError } = useAcademicTerms();
  const [studentId, setStudentId] = useState("");
  const [termId, setTermId] = useState("");
  const [errors, setErrors] = useState<{
    studentId?: string;
    termId?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs = {
      studentId: /^\d+$/.test(studentId.trim())
        ? undefined
        : "Enter the student's numeric id.",
      termId: termId ? undefined : "Select the term this bill covers.",
    };
    setErrors(errs);
    if (errs.studentId || errs.termId) return;

    setSubmitting(true);
    try {
      const bill = await createStudentBill({
        studentId: Number(studentId),
        academicTermId: Number(termId),
      });
      toast({
        title: "Bill created",
        description: `${bill.billNumber} for ${bill.studentName}.`,
        variant: "success",
      });
      setStudentId("");
      onCreated();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not create the bill.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Open a bill"
        description="One bill per student per term. Charges are added to it afterwards."
      />
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}
      {termsError ? (
        <div className="mb-4">
          <Alert variant="warning" title="Terms unavailable">
            {termsError}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <NumericIdField
          label="Student id"
          id="bill-student"
          value={studentId}
          onChange={setStudentId}
          required
          error={errors.studentId}
        />
        <Field
          label="Academic term"
          htmlFor="bill-term"
          required
          error={errors.termId}
          hint={
            termsLoading
              ? "Loading terms…"
              : terms.length === 0
                ? "No terms found — create one under Academics first."
                : undefined
          }
        >
          <Select
            id="bill-term"
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            disabled={termsLoading || terms.length === 0}
            invalid={!!errors.termId}
          >
            <option value="">Select a term…</option>
            {terms.map((t) => (
              <option key={t.academicTermId} value={String(t.academicTermId)}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Creating…" : "Create bill"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function CarryForwardCard() {
  const { toast } = useToast();
  const { terms, loading, error: termsError } = useAcademicTermRecords();
  const [form, setForm] = useState({
    studentId: "",
    previousTermId: "",
    newTermId: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string | undefined> = {
      studentId: form.studentId.trim()
        ? undefined
        : "Enter the student's public id.",
      previousTermId: form.previousTermId
        ? undefined
        : "Select the term the arrears come from.",
      newTermId: !form.newTermId
        ? "Select the term to move the balance to."
        : form.newTermId === form.previousTermId
          ? "Pick a different term from the previous one."
          : undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      await carryForwardArrears({
        studentId: form.studentId.trim(),
        previousTermId: form.previousTermId,
        newTermId: form.newTermId,
      });
      toast({
        title: "Arrears carried forward",
        description: "The unpaid balance now sits on the new term's bill.",
        variant: "success",
      });
      setForm({ studentId: "", previousTermId: "", newTermId: "" });
    } catch (err) {
      setError((err as ApiError).message ?? "Could not carry forward arrears.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Carry forward arrears"
        description="Move a student's unpaid balance from a finished term onto the new one."
      />
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not carry forward">
            {error}
          </Alert>
        </div>
      ) : null}
      {termsError ? (
        <div className="mb-4">
          <Alert variant="warning" title="Terms unavailable">
            {termsError}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Student public id"
          htmlFor="cf-student"
          required
          error={errors.studentId}
          hint="The student's UUID — this endpoint takes UUIDs, not numeric ids."
        >
          <Input
            id="cf-student"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            placeholder="e.g. 3f1a…-…"
            invalid={!!errors.studentId}
            aria-invalid={!!errors.studentId}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="From term"
            htmlFor="cf-prev"
            required
            error={errors.previousTermId}
          >
            <Select
              id="cf-prev"
              value={form.previousTermId}
              onChange={(e) =>
                setForm({ ...form, previousTermId: e.target.value })
              }
              disabled={loading}
              invalid={!!errors.previousTermId}
            >
              <option value="">Select a term…</option>
              {terms.map((t) => (
                <option key={t.publicId} value={t.publicId}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="To term"
            htmlFor="cf-new"
            required
            error={errors.newTermId}
          >
            <Select
              id="cf-new"
              value={form.newTermId}
              onChange={(e) => setForm({ ...form, newTermId: e.target.value })}
              disabled={loading}
              invalid={!!errors.newTermId}
            >
              <option value="">Select a term…</option>
              {terms.map((t) => (
                <option key={t.publicId} value={t.publicId}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={submitting}>
            {submitting ? "Working…" : "Carry forward"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
