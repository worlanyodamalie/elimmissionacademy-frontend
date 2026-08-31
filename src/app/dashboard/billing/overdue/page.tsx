"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Card,
  Field,
  PageHeader,
  Select,
} from "@/components/ui";
import { DateInput } from "@/components/date-input";
import {
  BillStatusBadge,
  EmptyState,
  Money,
  Pagination,
} from "@/components/billing-ui";
import { StudentLookup } from "@/components/student-lookup";
import { ChevronRightIcon } from "@/components/icons";
import { listBillLineItems } from "@/lib/billing";
import { SERVICE_CATEGORIES } from "@/lib/billing-options";
import { ROUTES } from "@/lib/endpoints";
import {
  daysBetweenIso,
  formatDate,
  formatEnumLabel,
  shiftIsoDate,
  todayIso,
} from "@/lib/utils";
import type {
  ApiError,
  BillLineItemFilter,
  BillLineItemResponse,
  BillPaymentStatus,
  ServiceCategory,
  StudentSearchResult,
} from "@/lib/types";

const PAGE_SIZE = 25;

// The backend filters one payment status at a time, so the view is a toggle
// rather than "everything outstanding" in a single list.
const STATUS_TABS: { value: BillPaymentStatus; label: string }[] = [
  { value: "UNPAID", label: "Nothing paid" },
  { value: "PARTIALLY_PAID", label: "Part paid" },
];

type AgingBucket = {
  key: string;
  label: string;
  // Window on dueDate, relative to the as-of date.
  fromOffset?: number;
  toOffset: number;
};

const AGING: AgingBucket[] = [
  { key: "0-30", label: "Up to 30 days", fromOffset: -30, toOffset: 0 },
  { key: "31-60", label: "31–60 days", fromOffset: -60, toOffset: -31 },
  { key: "60+", label: "Over 60 days", toOffset: -61 },
];

export default function OverduePage() {
  const [status, setStatus] = useState<BillPaymentStatus>("UNPAID");
  const [asOf, setAsOf] = useState(todayIso);
  const [category, setCategory] = useState<ServiceCategory | "">("");
  // Picked from the lookup, which hands over the UUID the filter needs.
  const [student, setStudent] = useState<StudentSearchResult | null>(null);
  const [page, setPage] = useState(0);

  const [items, setItems] = useState<BillLineItemResponse[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const filter: BillLineItemFilter = {
    paymentStatus: status,
    // "Overdue" is anything whose due date has already arrived.
    dueDateTo: asOf,
    ...(category ? { serviceCategory: category } : {}),
    ...(student ? { studentId: student.profilePublicId } : {}),
  };
  const fetchKey = `${page}|${JSON.stringify(filter)}`;
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    const controller = new AbortController();
    listBillLineItems(
      filter,
      { page, size: PAGE_SIZE, sort: "dueDate,asc" },
      controller.signal,
    )
      .then((data) => {
        setItems(data.content);
        setTotalPages(data.totalPages ?? 1);
        setTotalElements(data.totalElements ?? data.content.length);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setLoadError(err.message ?? "Could not load overdue charges.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(fetchKey);
      });
    return () => controller.abort();
    // `filter` is rebuilt each render; fetchKey is its stable identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, fetchKey]);

  function selectStudent(next: StudentSearchResult | null) {
    setPage(0);
    setStudent(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1 text-sm text-zinc-500 dark:text-zinc-400">
        <Link
          href={ROUTES.billing}
          className="hover:text-zinc-900 dark:hover:text-zinc-100"
        >
          Billing
        </Link>
        <ChevronRightIcon className="h-4 w-4" />
        <span className="text-zinc-900 dark:text-zinc-100">Overdue</span>
      </nav>

      <PageHeader
        title="Overdue charges"
        description="Charges whose due date has passed, oldest first — the list to work down when chasing fees."
        action={
          <Link
            href={ROUTES.charges}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900 ring-1 ring-inset ring-zinc-200 transition hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-100 dark:ring-zinc-800"
          >
            All charges
          </Link>
        }
      />

      <AgingCounts status={status} asOf={asOf} category={category} />

      <Card>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div
              className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
              role="tablist"
              aria-label="Payment status"
            >
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={status === tab.value}
                  onClick={() => {
                    setPage(0);
                    setStatus(tab.value);
                  }}
                  className={
                    status === tab.value
                      ? "rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm"
                      : "rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              The API filters one status at a time — switch tabs to see the other.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Overdue as of"
              htmlFor="od-asof"
              hint="Charges due on or before this date."
            >
              <DateInput
                id="od-asof"
                value={asOf}
                onChange={(value) => {
                  setPage(0);
                  setAsOf(value || todayIso());
                }}
              />
            </Field>

            <Field label="Category" htmlFor="od-category">
              <Select
                id="od-category"
                value={category}
                onChange={(e) => {
                  setPage(0);
                  setCategory(e.target.value as ServiceCategory | "");
                }}
              >
                <option value="">Any category</option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <StudentLookup
              inputId="od-student"
              label="Student"
              hint="Search a student to chase just their overdue charges."
              selected={student}
              onSelect={selectStudent}
            />
          </div>
        </div>
      </Card>

      {loadError ? (
        <Alert variant="error" title="Could not load overdue charges">
          {loadError}
        </Alert>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="Nothing overdue">
          No {status === "UNPAID" ? "unpaid" : "part-paid"} charges were due on or
          before {formatDate(asOf)}
          {category ? ` under ${formatEnumLabel(category)}` : ""}.
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Overdue</th>
                  <th className="py-2 pr-4 font-medium">Due date</th>
                  <th className="py-2 pr-4 font-medium">Service</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 font-medium">Bill</th>
                  <th className="py-2 pr-4 text-right font-medium">Billed</th>
                  <th className="py-2 pr-4 text-right font-medium">Paid</th>
                  <th className="py-2 pr-4 text-right font-medium">Balance</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const days = item.dueDate
                    ? daysBetweenIso(item.dueDate, asOf)
                    : null;
                  return (
                    <tr
                      key={item.billLineItemId}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="py-2.5 pr-4">
                        <AgeBadge days={days} />
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {formatDate(item.dueDate)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                        {item.serviceName}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {formatEnumLabel(item.serviceCategory)}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                        #{item.studentBillId}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-zinc-900 dark:text-zinc-100">
                        <Money amount={item.amountDue} currency={item.currency} />
                      </td>
                      <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                        <Money
                          amount={item.amountPaid}
                          currency={item.currency}
                        />
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        <Money
                          amount={item.balanceDue}
                          currency={item.currency}
                        />
                      </td>
                      <td className="py-2.5">
                        <BillStatusBadge status={item.paymentStatus} />
                      </td>
                    </tr>
                  );
                })}
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
          <p className="pt-3 text-xs text-zinc-500 dark:text-zinc-400">
            Charges carry the bill&apos;s numeric id but no student name — the
            line-item response doesn&apos;t include one. Open the bill from{" "}
            <Link
              href={ROUTES.billing}
              className="text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Billing
            </Link>{" "}
            to see who owes it.
          </p>
        </Card>
      )}
    </div>
  );
}

function AgeBadge({ days }: { days: number | null }) {
  if (days === null) return <span className="text-zinc-400">—</span>;
  const variant = days > 60 ? "danger" : days > 30 ? "warning" : "neutral";
  return (
    <Badge variant={variant}>
      {days === 0 ? "Due today" : `${days} ${days === 1 ? "day" : "days"}`}
    </Badge>
  );
}

// Counts per aging bucket. Each is one request with size=1, read off the page's
// `totalElements` — the API returns no sums, so these are counts, not amounts.
function AgingCounts({
  status,
  asOf,
  category,
}: {
  status: BillPaymentStatus;
  asOf: string;
  category: ServiceCategory | "";
}) {
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [failed, setFailed] = useState(false);
  const key = `${status}|${asOf}|${category}`;

  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      AGING.map((bucket) =>
        listBillLineItems(
          {
            paymentStatus: status,
            dueDateTo: shiftIsoDate(asOf, bucket.toOffset),
            ...(bucket.fromOffset !== undefined
              ? { dueDateFrom: shiftIsoDate(asOf, bucket.fromOffset) }
              : {}),
            ...(category ? { serviceCategory: category } : {}),
          },
          { page: 0, size: 1 },
          controller.signal,
        ).then((data) => [bucket.key, data.totalElements ?? 0] as const),
      ),
    )
      .then((entries) => {
        setCounts(Object.fromEntries(entries));
        setFailed(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setFailed(true);
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (failed) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {AGING.map((bucket) => {
        const count = counts[bucket.key];
        return (
          <div
            key={bucket.key}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {bucket.label} overdue
            </p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {count === undefined ? "…" : (count ?? 0)}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              {count === 1 ? "charge" : "charges"} · count only
            </p>
          </div>
        );
      })}
    </div>
  );
}
