"use client";

// Records money received. Shared by the bill detail page (where the student is
// already known) and the collections page (where the cashier types everything).

import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "./ui";
import { Money, NumericIdField, PaymentStatusBadge } from "./billing-ui";
import { useToast } from "./toast";
import { useAuth } from "@/lib/auth-context";
import { createPayment } from "@/lib/billing";
import {
  CHANNELS_BY_METHOD,
  PAYMENT_CHANNELS,
  PAYMENT_METHODS,
} from "@/lib/billing-options";
import { formatEnumLabel } from "@/lib/utils";
import type {
  ApiError,
  PaymentChannel,
  PaymentMethod,
  PaymentRequest,
  PaymentResponse,
} from "@/lib/types";

type Props = {
  // Prefilled when the caller already knows them.
  studentId?: number;
  studentName?: string;
  studentBillId?: number;
  cashSessionId?: number;
  onRecorded?: (payment: PaymentResponse) => void;
};

function channelsFor(method: PaymentMethod): PaymentChannel[] {
  const allowed = CHANNELS_BY_METHOD[method];
  return PAYMENT_CHANNELS.filter((c) => allowed.includes(c.value)).map(
    (c) => c.value,
  );
}

export function PaymentForm({
  studentId,
  studentName,
  studentBillId,
  cashSessionId,
  onRecorded,
}: Props) {
  const { toast } = useToast();
  const { session } = useAuth();
  const sessionSchoolId = session?.user?.schoolId;

  const [form, setForm] = useState({
    schoolId: sessionSchoolId ? String(sessionSchoolId) : "",
    studentId: studentId ? String(studentId) : "",
    studentBillId: studentBillId ? String(studentBillId) : "",
    cashCollectionSessionId: cashSessionId ? String(cashSessionId) : "",
    cashAmount: "",
    paymentMethod: "CASH" as PaymentMethod,
    paymentChannel: "CASH_OFFICE" as PaymentChannel,
    payeeName: "",
    payeeRelationship: "",
    payeeContact: "",
    notes: "",
    paidAt: "",
    allowOverpayment: false,
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<PaymentResponse | null>(null);

  const studentLocked = typeof studentId === "number";
  const allowedChannels = channelsFor(form.paymentMethod);
  // Cash that isn't tied to an open till can't be reconciled at close.
  const cashWithoutSession =
    form.paymentMethod === "CASH" && !form.cashCollectionSessionId.trim();

  function setMethod(method: PaymentMethod) {
    const channels = channelsFor(method);
    setForm((f) => ({
      ...f,
      paymentMethod: method,
      paymentChannel: channels.includes(f.paymentChannel)
        ? f.paymentChannel
        : channels[0],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const amount = Number(form.cashAmount);
    const errs: Record<string, string | undefined> = {
      schoolId: /^\d+$/.test(form.schoolId.trim())
        ? undefined
        : "Enter the school's numeric id.",
      studentId: /^\d+$/.test(form.studentId.trim())
        ? undefined
        : "Enter the student's numeric id.",
      cashAmount:
        form.cashAmount.trim() && amount >= 0.01
          ? undefined
          : "Enter an amount of at least 0.01.",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const body: PaymentRequest = {
        schoolId: Number(form.schoolId),
        studentId: Number(form.studentId),
        cashAmount: amount,
        paymentMethod: form.paymentMethod,
        paymentChannel: form.paymentChannel,
        allowOverpayment: form.allowOverpayment,
      };
      if (form.studentBillId.trim()) {
        body.studentBillId = Number(form.studentBillId);
      }
      if (form.cashCollectionSessionId.trim()) {
        body.cashCollectionSessionId = Number(form.cashCollectionSessionId);
      }
      if (form.payeeName.trim()) body.payeeName = form.payeeName.trim();
      if (form.payeeRelationship.trim()) {
        body.payeeRelationship = form.payeeRelationship.trim();
      }
      if (form.payeeContact.trim()) body.payeeContact = form.payeeContact.trim();
      if (form.notes.trim()) body.notes = form.notes.trim();
      if (form.paidAt) body.paidAt = new Date(form.paidAt).toISOString();

      const payment = await createPayment(body);
      setReceipt(payment);
      toast({
        title: "Payment recorded",
        description: payment.receiptNumber
          ? `Receipt ${payment.receiptNumber}.`
          : `Reference ${payment.transactionReference}.`,
        variant: "success",
      });
      setForm((f) => ({
        ...f,
        cashAmount: "",
        payeeName: "",
        payeeRelationship: "",
        payeeContact: "",
        notes: "",
        paidAt: "",
        allowOverpayment: false,
      }));
      onRecorded?.(payment);
    } catch (err) {
      setError((err as ApiError).message ?? "Could not record the payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Record a payment"
        description={
          studentName
            ? `Money received for ${studentName}. The backend allocates it across the outstanding charges.`
            : "Money received at the counter. The backend allocates it across the student's outstanding charges."
        }
      />

      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not record payment">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {studentLocked ? (
            <Field label="Student" htmlFor="pay-student-locked">
              <Input
                id="pay-student-locked"
                value={studentName ?? `Student #${studentId}`}
                disabled
              />
            </Field>
          ) : (
            <NumericIdField
              label="Student id"
              id="pay-student"
              value={form.studentId}
              onChange={(v) => setForm({ ...form, studentId: v })}
              required
              error={errors.studentId}
            />
          )}

          <Field
            label="Amount"
            htmlFor="pay-amount"
            required
            error={errors.cashAmount}
          >
            <Input
              id="pay-amount"
              type="number"
              min="0.01"
              step="0.01"
              inputMode="decimal"
              value={form.cashAmount}
              onChange={(e) => setForm({ ...form, cashAmount: e.target.value })}
              placeholder="0.00"
              invalid={!!errors.cashAmount}
              aria-invalid={!!errors.cashAmount}
            />
          </Field>

          <Field label="Method" htmlFor="pay-method">
            <Select
              id="pay-method"
              value={form.paymentMethod}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Channel"
            htmlFor="pay-channel"
            hint="Filtered to channels that fit the method."
          >
            <Select
              id="pay-channel"
              value={form.paymentChannel}
              onChange={(e) =>
                setForm({
                  ...form,
                  paymentChannel: e.target.value as PaymentChannel,
                })
              }
            >
              {allowedChannels.map((c) => (
                <option key={c} value={c}>
                  {PAYMENT_CHANNELS.find((o) => o.value === c)?.label ??
                    formatEnumLabel(c)}
                </option>
              ))}
            </Select>
          </Field>

          {typeof studentBillId === "number" ? null : (
            <NumericIdField
              label="Bill id (optional)"
              id="pay-bill"
              value={form.studentBillId}
              onChange={(v) => setForm({ ...form, studentBillId: v })}
              hint="Leave blank to let the backend spread the payment across outstanding bills."
            />
          )}

          <NumericIdField
            label="Cash session id"
            id="pay-session"
            value={form.cashCollectionSessionId}
            onChange={(v) =>
              setForm({ ...form, cashCollectionSessionId: v })
            }
            hint="The open till this cash was taken in. Required for the session to reconcile."
          />

          {sessionSchoolId ? null : (
            <NumericIdField
              label="School id"
              id="pay-school"
              value={form.schoolId}
              onChange={(v) => setForm({ ...form, schoolId: v })}
              required
              error={errors.schoolId}
              hint="Not present in your sign-in token, so it has to be typed."
            />
          )}

          <Field label="Paid at" htmlFor="pay-at" hint="Defaults to now.">
            <Input
              id="pay-at"
              type="datetime-local"
              value={form.paidAt}
              onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
            />
          </Field>
        </div>

        <details className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Who paid? (optional)
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Payee name" htmlFor="pay-payee">
              <Input
                id="pay-payee"
                value={form.payeeName}
                onChange={(e) => setForm({ ...form, payeeName: e.target.value })}
                placeholder="Name on the receipt"
              />
            </Field>
            <Field label="Relationship" htmlFor="pay-rel">
              <Input
                id="pay-rel"
                value={form.payeeRelationship}
                onChange={(e) =>
                  setForm({ ...form, payeeRelationship: e.target.value })
                }
                placeholder="e.g. Mother"
              />
            </Field>
            <Field label="Contact" htmlFor="pay-contact">
              <Input
                id="pay-contact"
                value={form.payeeContact}
                onChange={(e) =>
                  setForm({ ...form, payeeContact: e.target.value })
                }
                placeholder="Phone or email"
              />
            </Field>
          </div>
        </details>

        <Field label="Notes" htmlFor="pay-notes">
          <Textarea
            id="pay-notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Anything the cash office should remember about this payment."
          />
        </Field>

        <Checkbox
          label="Allow overpayment"
          description="Accept more than the outstanding balance and leave a credit."
          checked={form.allowOverpayment}
          onChange={(e) =>
            setForm({ ...form, allowOverpayment: e.target.checked })
          }
        />

        {cashWithoutSession ? (
          <Alert variant="warning" title="No cash session">
            Cash without a session id won&apos;t show up in a till&apos;s
            expected total, so the close-of-day count will look short.
          </Alert>
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Recording…" : "Record payment"}
          </Button>
        </div>
      </form>

      {receipt ? <Receipt payment={receipt} /> : null}
    </Card>
  );
}

function Receipt({ payment }: { payment: PaymentResponse }) {
  return (
    <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            {payment.receiptNumber
              ? `Receipt ${payment.receiptNumber}`
              : "Payment recorded"}
          </p>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
            Ref {payment.transactionReference} ·{" "}
            <Money amount={payment.amount} currency={payment.currency} /> ·{" "}
            {formatEnumLabel(payment.paymentMethod)}
          </p>
        </div>
        <PaymentStatusBadge status={payment.paymentStatus} />
      </div>

      {payment.paymentAllocations?.length ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-emerald-200/70 text-xs uppercase tracking-wider text-emerald-800/80 dark:border-emerald-900/50 dark:text-emerald-200/70">
                <th className="py-1.5 pr-4 font-medium">Applied to</th>
                <th className="py-1.5 pr-4 text-right font-medium">Amount</th>
                <th className="py-1.5 text-right font-medium">
                  Balance after
                </th>
              </tr>
            </thead>
            <tbody>
              {payment.paymentAllocations.map((a) => (
                <tr key={a.id}>
                  <td className="py-1.5 pr-4 text-emerald-900 dark:text-emerald-100">
                    {a.serviceName}
                  </td>
                  <td className="py-1.5 pr-4 text-right text-emerald-900 dark:text-emerald-100">
                    <Money
                      amount={a.allocatedAmount}
                      currency={payment.currency}
                    />
                  </td>
                  <td className="py-1.5 text-right text-emerald-900 dark:text-emerald-100">
                    <Money
                      amount={a.lineItemBalanceAfter}
                      currency={payment.currency}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
