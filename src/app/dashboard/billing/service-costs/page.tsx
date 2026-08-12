"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { DateInput } from "@/components/date-input";
import {
  EmptyState,
  Money,
  NumericIdField,
  Pagination,
} from "@/components/billing-ui";
import { ChevronRightIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { createServiceCost, listServiceCosts } from "@/lib/billing";
import {
  BILLING_CYCLES,
  CURRENCIES,
  SERVICE_CATEGORIES,
} from "@/lib/billing-options";
import { ROUTES } from "@/lib/endpoints";
import { formatDate, formatEnumLabel } from "@/lib/utils";
import type {
  ApiError,
  BillingCycle,
  Currency,
  ServiceCategory,
  ServiceCostResponse,
} from "@/lib/types";

const PAGE_SIZE = 10;

export default function ServiceCostsPage() {
  const [costs, setCosts] = useState<ServiceCostResponse[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // See the billing hub: "loading" is derived so the effect never calls
  // setState synchronously.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const fetchKey = `${page}|${reloadKey}`;
  const loading = loadedKey !== fetchKey;

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    listServiceCosts(
      { page, size: PAGE_SIZE, sort: "priorityOrder,asc" },
      controller.signal,
    )
      .then((data) => {
        setCosts(data.content);
        setTotalPages(data.totalPages ?? 1);
        setTotalElements(data.totalElements ?? data.content.length);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setLoadError(err.message ?? "Could not load the price list.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(fetchKey);
      });
    return () => controller.abort();
  }, [page, fetchKey]);

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
        <span className="text-zinc-900 dark:text-zinc-100">Price list</span>
      </nav>

      <PageHeader
        title="Price list"
        description="What the school charges, per service and class level. Mandatory entries land on every new bill automatically."
      />

      <NewServiceCostCard onCreated={refresh} />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Service costs
        </h2>

        {loadError ? (
          <Alert variant="error" title="Could not load the price list">
            {loadError}
          </Alert>
        ) : null}

        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : costs.length === 0 ? (
          <EmptyState title="Nothing priced yet">
            Add the school&apos;s fees above — tuition, transport, feeding and so
            on. Bills are built from these.
          </EmptyState>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="py-2 pr-4 font-medium">Service</th>
                    <th className="py-2 pr-4 font-medium">Category</th>
                    <th className="py-2 pr-4 font-medium">Class level</th>
                    <th className="py-2 pr-4 font-medium">Cycle</th>
                    <th className="py-2 pr-4 text-right font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Effective</th>
                    <th className="py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((cost) => (
                    <tr
                      key={cost.publicId}
                      className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          {cost.serviceCostName}
                        </span>
                        {cost.mandatory ? (
                          <span className="ml-2 align-middle">
                            <Badge variant="info">Mandatory</Badge>
                          </span>
                        ) : null}
                        {cost.serviceCostDescription ? (
                          <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                            {cost.serviceCostDescription}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {formatEnumLabel(cost.serviceCategory)}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {cost.classLevelName ?? "All levels"}
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {formatEnumLabel(cost.billingCycle)}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                        <Money amount={cost.amount} currency={cost.currency} />
                      </td>
                      <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                        {formatDate(cost.effectiveFrom)}
                        {cost.effectiveTo
                          ? ` – ${formatDate(cost.effectiveTo)}`
                          : " onwards"}
                      </td>
                      <td className="py-2.5">
                        <Badge
                          variant={
                            cost.status === "ACTIVE" ? "success" : "neutral"
                          }
                        >
                          {formatEnumLabel(cost.status)}
                        </Badge>
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

function NewServiceCostCard({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    serviceCostName: "",
    serviceCostDescription: "",
    classLevelId: "",
    serviceCategory: "SCHOOL_FEES" as ServiceCategory,
    billingCycle: "TERMLY" as BillingCycle,
    amount: "",
    currency: "GHS" as Currency,
    priorityOrder: "",
    mandatory: true,
    effectiveFrom: "",
    effectiveTo: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string | undefined> = {
      serviceCostName: !form.serviceCostName.trim()
        ? "Name this service."
        : form.serviceCostName.length > 100
          ? "Keep the name under 100 characters."
          : undefined,
      amount:
        Number(form.amount) > 0
          ? undefined
          : "Amount must be greater than 0.",
      effectiveFrom: form.effectiveFrom
        ? undefined
        : "Pick the date this price starts applying.",
      effectiveTo:
        form.effectiveTo && form.effectiveTo <= form.effectiveFrom
          ? "The end date must be after the start date."
          : undefined,
      classLevelId:
        form.classLevelId && !/^\d+$/.test(form.classLevelId.trim())
          ? "Class level id must be a number."
          : undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const created = await createServiceCost({
        serviceCostName: form.serviceCostName.trim(),
        ...(form.serviceCostDescription.trim()
          ? { serviceCostDescription: form.serviceCostDescription.trim() }
          : {}),
        ...(form.classLevelId.trim()
          ? { classLevelId: Number(form.classLevelId) }
          : {}),
        serviceCategory: form.serviceCategory,
        billingCycle: form.billingCycle,
        amount: Number(form.amount),
        currency: form.currency,
        ...(form.priorityOrder.trim()
          ? { priorityOrder: Number(form.priorityOrder) }
          : {}),
        mandatory: form.mandatory,
        effectiveFrom: form.effectiveFrom,
        ...(form.effectiveTo ? { effectiveTo: form.effectiveTo } : {}),
      });
      toast({
        title: "Service priced",
        description: `${created.serviceCostName} added to the price list.`,
        variant: "success",
      });
      setForm({
        ...form,
        serviceCostName: "",
        serviceCostDescription: "",
        amount: "",
        priorityOrder: "",
      });
      onCreated();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not save the service cost.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Price a service"
        description="Leave the class level blank to charge every level the same."
      />
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            htmlFor="sc-name"
            required
            error={errors.serviceCostName}
          >
            <Input
              id="sc-name"
              value={form.serviceCostName}
              onChange={(e) =>
                setForm({ ...form, serviceCostName: e.target.value })
              }
              placeholder="e.g. Term tuition — JHS 1"
              invalid={!!errors.serviceCostName}
            />
          </Field>

          <Field label="Category" htmlFor="sc-category" required>
            <Select
              id="sc-category"
              value={form.serviceCategory}
              onChange={(e) =>
                setForm({
                  ...form,
                  serviceCategory: e.target.value as ServiceCategory,
                })
              }
            >
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Billing cycle" htmlFor="sc-cycle" required>
            <Select
              id="sc-cycle"
              value={form.billingCycle}
              onChange={(e) =>
                setForm({
                  ...form,
                  billingCycle: e.target.value as BillingCycle,
                })
              }
            >
              {BILLING_CYCLES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Amount"
              htmlFor="sc-amount"
              required
              error={errors.amount}
            >
              <Input
                id="sc-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
                invalid={!!errors.amount}
              />
            </Field>
            <Field label="Currency" htmlFor="sc-currency" required>
              <Select
                id="sc-currency"
                value={form.currency}
                onChange={(e) =>
                  setForm({ ...form, currency: e.target.value as Currency })
                }
              >
                {CURRENCIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Effective from"
            htmlFor="sc-from"
            required
            error={errors.effectiveFrom}
          >
            <DateInput
              id="sc-from"
              value={form.effectiveFrom}
              onChange={(value) =>
                setForm({ ...form, effectiveFrom: value })
              }
              invalid={!!errors.effectiveFrom}
            />
          </Field>

          <Field
            label="Effective to"
            htmlFor="sc-to"
            error={errors.effectiveTo}
            hint="Leave blank to keep it open-ended."
          >
            <DateInput
              id="sc-to"
              value={form.effectiveTo}
              onChange={(value) => setForm({ ...form, effectiveTo: value })}
              invalid={!!errors.effectiveTo}
            />
          </Field>

          <NumericIdField
            label="Class level id"
            id="sc-class"
            value={form.classLevelId}
            onChange={(v) => setForm({ ...form, classLevelId: v })}
            error={errors.classLevelId}
            hint="Optional — leave blank to apply to all class levels."
          />

          <Field
            label="Priority order"
            htmlFor="sc-priority"
            hint="Lower numbers are settled first when a payment is allocated."
          >
            <Input
              id="sc-priority"
              type="number"
              min={0}
              step={1}
              value={form.priorityOrder}
              onChange={(e) =>
                setForm({ ...form, priorityOrder: e.target.value })
              }
              placeholder="e.g. 1"
            />
          </Field>
        </div>

        <Field label="Description" htmlFor="sc-desc">
          <Textarea
            id="sc-desc"
            value={form.serviceCostDescription}
            onChange={(e) =>
              setForm({ ...form, serviceCostDescription: e.target.value })
            }
            maxLength={255}
            placeholder="What this covers (max 255 characters)."
          />
        </Field>

        <Checkbox
          label="Mandatory"
          description="Charged on every new bill for the matching class level."
          checked={form.mandatory}
          onChange={(e) => setForm({ ...form, mandatory: e.target.checked })}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Add to price list"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
