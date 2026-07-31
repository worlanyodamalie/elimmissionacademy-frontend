"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Textarea,
} from "@/components/ui";
import {
  BillStatusBadge,
  Money,
  NumericIdField,
  StatTile,
} from "@/components/billing-ui";
import { PaymentForm } from "@/components/payment-form";
import { ChevronRightIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  addBillLineItemFromServiceCost,
  addManualBillLineItem,
  getStudentBill,
  listServiceCosts,
} from "@/lib/billing";
import {
  BILLING_CYCLES,
  CURRENCIES,
  SERVICE_CATEGORIES,
} from "@/lib/billing-options";
import { ROUTES } from "@/lib/endpoints";
import { cn, formatDate, formatEnumLabel, formatMoney } from "@/lib/utils";
import type {
  ApiError,
  BillingCycle,
  Currency,
  ServiceCategory,
  ServiceCostResponse,
  StudentBillResponse,
} from "@/lib/types";

export default function BillDetailPage({
  params,
}: {
  params: Promise<{ publicId: string }>;
}) {
  const { publicId } = use(params);
  const [bill, setBill] = useState<StudentBillResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Derived rather than set inside the effect — see the billing hub.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const fetchKey = `${publicId}|${reloadKey}`;
  const loading = loadedKey !== fetchKey;

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    getStudentBill(publicId, controller.signal)
      .then((data) => {
        setBill(data);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setLoadError(err.message ?? "Could not load this bill.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(fetchKey);
      });
    return () => controller.abort();
  }, [publicId, fetchKey]);

  // Bills come back with a UUID, but charges are posted against the numeric id.
  // Any existing line item carries it; a brand-new empty bill doesn't.
  const lineItems = bill?.billLineItems ?? [];
  const derivedBillId = lineItems[0]?.studentBillId;

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
        <span className="text-zinc-900 dark:text-zinc-100">
          {bill?.billNumber ?? "Bill"}
        </span>
      </nav>

      {loadError ? (
        <Alert variant="error" title="Could not load this bill">
          {loadError}
        </Alert>
      ) : null}

      {loading && !bill ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : !bill ? null : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {bill.studentName}
              </h1>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {bill.billNumber} · {bill.academicTermName},{" "}
                {bill.academicYearName} · Issued {formatDate(bill.issueDate)}
                {bill.dueDate ? ` · Due ${formatDate(bill.dueDate)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <BillStatusBadge status={bill.paymentStatus} />
              <Button size="sm" variant="secondary" onClick={refresh}>
                Refresh
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Total billed"
              value={formatMoney(bill.totalAmount, bill.currency)}
            />
            <StatTile
              label="Discount"
              value={formatMoney(bill.totalDiscount, bill.currency)}
            />
            <StatTile
              label="Paid"
              value={formatMoney(bill.totalPaid, bill.currency)}
              tone={bill.totalPaid > 0 ? "positive" : "default"}
            />
            <StatTile
              label="Balance due"
              value={formatMoney(bill.totalBalanceDue, bill.currency)}
              tone={bill.totalBalanceDue > 0 ? "negative" : "positive"}
            />
          </div>

          <Card>
            <CardHeader
              title="Charges"
              description={`${lineItems.length} ${
                lineItems.length === 1 ? "line item" : "line items"
              } on this bill.`}
            />
            {lineItems.length === 0 ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Nothing charged yet. Add a charge from the price list or a manual
                one below.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                      <th className="py-2 pr-4 font-medium">Service</th>
                      <th className="py-2 pr-4 font-medium">Category</th>
                      <th className="py-2 pr-4 text-right font-medium">Qty</th>
                      <th className="py-2 pr-4 text-right font-medium">Unit</th>
                      <th className="py-2 pr-4 text-right font-medium">Due</th>
                      <th className="py-2 pr-4 text-right font-medium">Paid</th>
                      <th className="py-2 pr-4 text-right font-medium">
                        Balance
                      </th>
                      <th className="py-2 pr-4 font-medium">Due date</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr
                        key={item.billLineItemId}
                        className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                      >
                        <td className="py-2.5 pr-4">
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {item.serviceName}
                          </span>
                          {item.serviceCostId ? null : (
                            <span className="ml-2 align-middle">
                              <Badge>Manual</Badge>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                          {formatEnumLabel(item.serviceCategory)}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-zinc-600 dark:text-zinc-300">
                          <Money amount={item.unitCost} currency={item.currency} />
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
            )}
          </Card>

          <AddChargeCard
            derivedBillId={derivedBillId}
            currency={bill.currency}
            onAdded={refresh}
          />

          <PaymentForm
            studentId={bill.studentId}
            studentName={bill.studentName}
            studentBillId={derivedBillId}
            onRecorded={refresh}
          />
        </>
      )}
    </div>
  );
}

type ChargeMode = "price-list" | "manual";

function AddChargeCard({
  derivedBillId,
  currency,
  onAdded,
}: {
  derivedBillId?: number;
  currency: Currency;
  onAdded: () => void;
}) {
  const [mode, setMode] = useState<ChargeMode>("price-list");
  const [billId, setBillId] = useState(
    derivedBillId ? String(derivedBillId) : "",
  );

  const resolvedBillId = derivedBillId ?? (billId ? Number(billId) : undefined);

  return (
    <Card>
      <CardHeader
        title="Add a charge"
        description="Price it from the school's list, or enter a one-off amount."
        action={
          <div
            className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800"
            role="tablist"
            aria-label="Charge source"
          >
            {(
              [
                { value: "price-list", label: "From price list" },
                { value: "manual", label: "Manual" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={mode === tab.value}
                onClick={() => setMode(tab.value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition",
                  mode === tab.value
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        }
      />

      {derivedBillId ? null : (
        <div className="mb-4 flex flex-col gap-3">
          <Alert variant="warning" title="Bill id needed">
            This bill has no charges yet, so its numeric id can&apos;t be read
            off a line item. Enter it once to add the first charge.
          </Alert>
          <NumericIdField
            label="Bill id"
            id="charge-bill-id"
            value={billId}
            onChange={setBillId}
            required
          />
        </div>
      )}

      {mode === "price-list" ? (
        <FromPriceListForm billId={resolvedBillId} onAdded={onAdded} />
      ) : (
        <ManualChargeForm
          billId={resolvedBillId}
          currency={currency}
          onAdded={onAdded}
        />
      )}
    </Card>
  );
}

function FromPriceListForm({
  billId,
  onAdded,
}: {
  billId?: number;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [costs, setCosts] = useState<ServiceCostResponse[]>([]);
  const [costsError, setCostsError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [serviceCostId, setServiceCostId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    listServiceCosts({ page: 0, size: 100 }, controller.signal)
      .then((data) => {
        setCosts(data.content.filter((c) => c.status !== "INACTIVE"));
        setCostsError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setCostsError(err.message ?? "Could not load the price list.");
      });
    return () => controller.abort();
  }, []);

  const chosen = costs.find((c) => c.publicId === selected);
  const total = chosen ? chosen.amount * (Number(quantity) || 0) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string | undefined> = {
      billId: billId ? undefined : "Enter the bill's numeric id first.",
      serviceCostId: /^\d+$/.test(serviceCostId.trim())
        ? undefined
        : "Enter the service cost's numeric id.",
      quantity:
        Number(quantity) >= 1 ? undefined : "Quantity must be at least 1.",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean) || !billId) return;

    setSubmitting(true);
    try {
      const item = await addBillLineItemFromServiceCost({
        serviceCostId: Number(serviceCostId),
        studentBillId: billId,
        quantity: Number(quantity),
        ...(dueDate ? { dueDate } : {}),
      });
      toast({
        title: "Charge added",
        description: `${item.serviceName} · ${formatMoney(
          item.totalCost,
          item.currency,
        )}.`,
        variant: "success",
      });
      setQuantity("1");
      setDueDate("");
      onAdded();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not add the charge.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <Alert variant="error" title="Could not add charge">
          {error}
        </Alert>
      ) : null}
      {costsError ? (
        <Alert variant="warning" title="Price list unavailable">
          {costsError}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Service"
          htmlFor="pl-service"
          hint={
            costs.length === 0
              ? "No active service costs — add one to the price list first."
              : "Picking one shows its price; the numeric id below is what gets posted."
          }
        >
          <Select
            id="pl-service"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={costs.length === 0}
          >
            <option value="">Select a service…</option>
            {costs.map((c) => (
              <option key={c.publicId} value={c.publicId}>
                {c.serviceCostName} — {formatMoney(c.amount, c.currency)}
                {c.classLevelName ? ` (${c.classLevelName})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <NumericIdField
          label="Service cost id"
          id="pl-service-id"
          value={serviceCostId}
          onChange={setServiceCostId}
          required
          error={errors.serviceCostId}
        />

        <Field
          label="Quantity"
          htmlFor="pl-qty"
          required
          error={errors.quantity}
          hint={
            total !== null
              ? `Line total: ${formatMoney(total, chosen?.currency)}`
              : undefined
          }
        >
          <Input
            id="pl-qty"
            type="number"
            min={1}
            step={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            invalid={!!errors.quantity}
          />
        </Field>

        <Field label="Due date" htmlFor="pl-due" hint="Optional.">
          <Input
            id="pl-due"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </Field>
      </div>

      {errors.billId ? (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {errors.billId}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitting ? "Adding…" : "Add charge"}
        </Button>
      </div>
    </form>
  );
}

function ManualChargeForm({
  billId,
  currency,
  onAdded,
}: {
  billId?: number;
  currency: Currency;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    serviceName: "",
    serviceCategory: "SCHOOL_FEES" as ServiceCategory,
    billingCycle: "ONE_TIME" as BillingCycle,
    unitCost: "",
    quantity: "1",
    currency,
    manualReason: "",
    dueDate: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = Number(form.unitCost) * (Number(form.quantity) || 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string | undefined> = {
      billId: billId ? undefined : "Enter the bill's numeric id first.",
      serviceName: form.serviceName.trim()
        ? undefined
        : "Name what is being charged.",
      unitCost:
        Number(form.unitCost) > 0
          ? undefined
          : "Unit cost must be greater than 0.",
      quantity:
        Number(form.quantity) >= 1 ? undefined : "Quantity must be at least 1.",
      manualReason: form.manualReason.trim()
        ? undefined
        : "A reason is required — manual charges are audited.",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean) || !billId) return;

    setSubmitting(true);
    try {
      const item = await addManualBillLineItem({
        studentBillId: billId,
        serviceName: form.serviceName.trim(),
        serviceCategory: form.serviceCategory,
        billingCycle: form.billingCycle,
        unitCost: Number(form.unitCost),
        quantity: Number(form.quantity),
        currency: form.currency,
        manualReason: form.manualReason.trim(),
        ...(form.dueDate ? { dueDate: form.dueDate } : {}),
      });
      toast({
        title: "Manual charge added",
        description: `${item.serviceName} · ${formatMoney(
          item.totalCost,
          item.currency,
        )}.`,
        variant: "success",
      });
      setForm({ ...form, serviceName: "", unitCost: "", manualReason: "" });
      onAdded();
    } catch (err) {
      setError((err as ApiError).message ?? "Could not add the charge.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <Alert variant="error" title="Could not add charge">
          {error}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="What is being charged"
          htmlFor="mc-name"
          required
          error={errors.serviceName}
        >
          <Input
            id="mc-name"
            value={form.serviceName}
            onChange={(e) => setForm({ ...form, serviceName: e.target.value })}
            placeholder="e.g. Replacement ID card"
            invalid={!!errors.serviceName}
          />
        </Field>

        <Field label="Category" htmlFor="mc-category" required>
          <Select
            id="mc-category"
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

        <Field label="Billing cycle" htmlFor="mc-cycle" required>
          <Select
            id="mc-cycle"
            value={form.billingCycle}
            onChange={(e) =>
              setForm({ ...form, billingCycle: e.target.value as BillingCycle })
            }
          >
            {BILLING_CYCLES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Currency" htmlFor="mc-currency" required>
          <Select
            id="mc-currency"
            value={form.currency}
            onChange={(e) =>
              setForm({ ...form, currency: e.target.value as Currency })
            }
          >
            {CURRENCIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Unit cost"
          htmlFor="mc-unit"
          required
          error={errors.unitCost}
        >
          <Input
            id="mc-unit"
            type="number"
            min="0.01"
            step="0.01"
            value={form.unitCost}
            onChange={(e) => setForm({ ...form, unitCost: e.target.value })}
            placeholder="0.00"
            invalid={!!errors.unitCost}
          />
        </Field>

        <Field
          label="Quantity"
          htmlFor="mc-qty"
          required
          error={errors.quantity}
          hint={
            total > 0
              ? `Line total: ${formatMoney(total, form.currency)}`
              : undefined
          }
        >
          <Input
            id="mc-qty"
            type="number"
            min={1}
            step={1}
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            invalid={!!errors.quantity}
          />
        </Field>

        <Field label="Due date" htmlFor="mc-due" hint="Optional.">
          <Input
            id="mc-due"
            type="date"
            value={form.dueDate}
            onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          />
        </Field>
      </div>

      <Field
        label="Reason"
        htmlFor="mc-reason"
        required
        error={errors.manualReason}
        hint="Kept on the line item for audit."
      >
        <Textarea
          id="mc-reason"
          value={form.manualReason}
          onChange={(e) => setForm({ ...form, manualReason: e.target.value })}
          placeholder="Why is this being charged outside the price list?"
          invalid={!!errors.manualReason}
        />
      </Field>

      {errors.billId ? (
        <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {errors.billId}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitting ? "Adding…" : "Add charge"}
        </Button>
      </div>
    </form>
  );
}
