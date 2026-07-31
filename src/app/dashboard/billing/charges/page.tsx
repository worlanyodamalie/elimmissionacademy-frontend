"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import {
  BillStatusBadge,
  EmptyState,
  Money,
  Pagination,
  StatTile,
} from "@/components/billing-ui";
import { ChevronRightIcon } from "@/components/icons";
import { listBillLineItems } from "@/lib/billing";
import {
  BILL_PAYMENT_STATUSES,
  LINE_ITEM_SOURCES,
  SERVICE_CATEGORIES,
} from "@/lib/billing-options";
import { ROUTES } from "@/lib/endpoints";
import { formatDate, formatEnumLabel, formatMoney } from "@/lib/utils";
import type {
  ApiError,
  BillLineItemFilter,
  BillLineItemResponse,
} from "@/lib/types";

const PAGE_SIZE = 20;

const EMPTY_FILTER: BillLineItemFilter = {};

export default function ChargesPage() {
  // `draft` is what the form holds; `filter` is what has been applied, so
  // typing doesn't fire a request per keystroke.
  const [draft, setDraft] = useState<BillLineItemFilter>(EMPTY_FILTER);
  const [filter, setFilter] = useState<BillLineItemFilter>(EMPTY_FILTER);
  const [items, setItems] = useState<BillLineItemResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // "loading" is derived from which request has landed, so the effect never
  // calls setState synchronously.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
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
        setLoadError(err.message ?? "Could not load charges.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(fetchKey);
      });
    return () => controller.abort();
  }, [filter, page, fetchKey]);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => ({
        due: acc.due + (item.amountDue ?? 0),
        paid: acc.paid + (item.amountPaid ?? 0),
        balance: acc.balance + (item.balanceDue ?? 0),
      }),
      { due: 0, paid: 0, balance: 0 },
    );
  }, [items]);
  const currency = items[0]?.currency ?? "GHS";

  const activeFilters = Object.values(filter).filter(Boolean).length;

  function applyFilters() {
    setPage(0);
    setFilter(draft);
  }

  function clearFilters() {
    setPage(0);
    setDraft(EMPTY_FILTER);
    setFilter(EMPTY_FILTER);
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
        <span className="text-zinc-900 dark:text-zinc-100">Charges</span>
      </nav>

      <PageHeader
        title="Charges"
        description="Every line item across all bills. Filter to chase a category, a due window, or one student's outstanding items."
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile
          label="Billed (this page)"
          value={formatMoney(totals.due, currency)}
        />
        <StatTile
          label="Paid (this page)"
          value={formatMoney(totals.paid, currency)}
          tone={totals.paid > 0 ? "positive" : "default"}
        />
        <StatTile
          label="Outstanding (this page)"
          value={formatMoney(totals.balance, currency)}
          tone={totals.balance > 0 ? "negative" : "default"}
        />
      </div>

      <Card>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applyFilters();
          }}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Status" htmlFor="f-status">
              <Select
                id="f-status"
                value={draft.paymentStatus ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    paymentStatus: (e.target.value ||
                      undefined) as BillLineItemFilter["paymentStatus"],
                  })
                }
              >
                <option value="">Any status</option>
                {BILL_PAYMENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Category" htmlFor="f-category">
              <Select
                id="f-category"
                value={draft.serviceCategory ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    serviceCategory: (e.target.value ||
                      undefined) as BillLineItemFilter["serviceCategory"],
                  })
                }
              >
                <option value="">Any category</option>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Source" htmlFor="f-source">
              <Select
                id="f-source"
                value={draft.source ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    source: (e.target.value ||
                      undefined) as BillLineItemFilter["source"],
                  })
                }
              >
                <option value="">Any source</option>
                {LINE_ITEM_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Student"
              htmlFor="f-student"
              hint="Student's public UUID."
            >
              <Input
                id="f-student"
                value={draft.studentId ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, studentId: e.target.value || undefined })
                }
                placeholder="Paste a student UUID"
              />
            </Field>

            <Field label="Due from" htmlFor="f-from">
              <Input
                id="f-from"
                type="date"
                value={draft.dueDateFrom ?? ""}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    dueDateFrom: e.target.value || undefined,
                  })
                }
              />
            </Field>

            <Field label="Due to" htmlFor="f-to">
              <Input
                id="f-to"
                type="date"
                value={draft.dueDateTo ?? ""}
                onChange={(e) =>
                  setDraft({ ...draft, dueDateTo: e.target.value || undefined })
                }
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {activeFilters > 0 ? (
              <Button type="button" variant="ghost" onClick={clearFilters}>
                Clear {activeFilters}{" "}
                {activeFilters === 1 ? "filter" : "filters"}
              </Button>
            ) : null}
            <Button type="submit" variant="secondary" loading={loading}>
              Apply filters
            </Button>
          </div>
        </form>
      </Card>

      {loadError ? (
        <Alert variant="error" title="Could not load charges">
          {loadError}
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="No charges match">
          {activeFilters > 0
            ? "Try widening the filters."
            : "Charges appear here once bills have line items."}
        </EmptyState>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th className="py-2 pr-4 font-medium">Service</th>
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 pr-4 text-right font-medium">Qty</th>
                  <th className="py-2 pr-4 text-right font-medium">Due</th>
                  <th className="py-2 pr-4 text-right font-medium">Paid</th>
                  <th className="py-2 pr-4 text-right font-medium">Balance</th>
                  <th className="py-2 pr-4 font-medium">Due date</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.billLineItemId}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                  >
                    <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                      {item.serviceName}
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {formatEnumLabel(item.serviceCategory)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                      {item.quantity}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-zinc-900 dark:text-zinc-100">
                      <Money amount={item.amountDue} currency={item.currency} />
                    </td>
                    <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                      <Money amount={item.amountPaid} currency={item.currency} />
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                      <Money amount={item.balanceDue} currency={item.currency} />
                    </td>
                    <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                      {formatDate(item.dueDate)}
                    </td>
                    <td className="py-2.5">
                      <BillStatusBadge status={item.paymentStatus} />
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
    </div>
  );
}
