"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  Alert,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";
import {
  EmptyState,
  NumericIdField,
  SessionStatusBadge,
  StatTile,
} from "@/components/billing-ui";
import { PaymentForm } from "@/components/payment-form";
import { useToast } from "@/components/toast";
import { useAuth } from "@/lib/auth-context";
import {
  approveCashSession,
  closeCashSession,
  getCashSession,
  openCashSession,
} from "@/lib/billing";
import {
  readTrackedSessions,
  readTrackedSessionsServer,
  subscribeTrackedSessions,
  trackSession,
  untrackSession,
} from "@/lib/cash-session-store";
import { formatDateTime, formatMoney } from "@/lib/utils";
import type { ApiError, CashSessionResponse } from "@/lib/types";

export default function CollectionsPage() {
  // Read through the store so the list stays in step with other tabs, and so
  // the prerendered markup starts empty rather than mismatching on hydration.
  const tracked = useSyncExternalStore(
    subscribeTrackedSessions,
    readTrackedSessions,
    readTrackedSessionsServer,
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Collections"
        description="Open a till before taking cash, record what comes in, then count down and hand the session to a supervisor."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <OpenSessionCard onOpened={trackSession} />
        <TrackSessionCard onTracked={trackSession} />
      </div>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Cash sessions
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Sessions you opened or looked up on this device.
          </p>
        </div>
        {tracked.length === 0 ? (
          <EmptyState title="No sessions on this device">
            Open a till above, or paste a session id to pull one up.
          </EmptyState>
        ) : (
          tracked.map((id) => (
            <SessionCard key={id} publicId={id} onForget={untrackSession} />
          ))
        )}
      </section>

      <PaymentForm />
    </div>
  );
}

function OpenSessionCard({
  onOpened,
}: {
  onOpened: (publicId: string) => void;
}) {
  const { toast } = useToast();
  const { session } = useAuth();
  const schoolId = session?.user?.schoolId;
  const userId = session?.user?.userId;

  const [form, setForm] = useState({
    schoolId: schoolId ? String(schoolId) : "",
    cashierId: userId ? String(userId) : "",
    openingFloatingAmount: "0",
    remarks: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const float = Number(form.openingFloatingAmount);
    const errs: Record<string, string | undefined> = {
      schoolId: /^\d+$/.test(form.schoolId.trim())
        ? undefined
        : "Enter the school's numeric id.",
      cashierId: /^\d+$/.test(form.cashierId.trim())
        ? undefined
        : "Enter the cashier's numeric user id.",
      openingFloatingAmount:
        form.openingFloatingAmount.trim() && float >= 0
          ? undefined
          : "Enter the opening float (0 or more).",
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const opened = await openCashSession({
        schoolId: Number(form.schoolId),
        cashierId: Number(form.cashierId),
        openingFloatingAmount: float,
        ...(form.remarks.trim() ? { remarks: form.remarks.trim() } : {}),
      });
      toast({
        title: "Session open",
        description: `${opened.sessionNumber} — ${opened.cashierName} can now take cash.`,
        variant: "success",
      });
      setForm({ ...form, remarks: "" });
      onOpened(opened.publicId);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(
        apiErr.status === 409
          ? "That cashier already has an open session. Close it before opening another."
          : (apiErr.message ?? "Could not open the session."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Open a till"
        description="One open session per cashier. The opening float is the change they start with."
      />
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not open">
            {error}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <NumericIdField
            label="Cashier user id"
            id="os-cashier"
            value={form.cashierId}
            onChange={(v) => setForm({ ...form, cashierId: v })}
            required
            error={errors.cashierId}
            hint={
              userId && form.cashierId === String(userId)
                ? "Defaults to you — change it to open a till for someone else."
                : undefined
            }
          />
          <Field
            label="Opening float"
            htmlFor="os-float"
            required
            error={errors.openingFloatingAmount}
          >
            <Input
              id="os-float"
              type="number"
              min="0"
              step="0.01"
              value={form.openingFloatingAmount}
              onChange={(e) =>
                setForm({ ...form, openingFloatingAmount: e.target.value })
              }
              invalid={!!errors.openingFloatingAmount}
            />
          </Field>
          {schoolId ? null : (
            <NumericIdField
              label="School id"
              id="os-school"
              value={form.schoolId}
              onChange={(v) => setForm({ ...form, schoolId: v })}
              required
              error={errors.schoolId}
              hint="Not present in your sign-in token, so it has to be typed."
            />
          )}
        </div>
        <Field label="Remarks" htmlFor="os-remarks">
          <Textarea
            id="os-remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            placeholder="Shift, window, anything worth noting."
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Opening…" : "Open session"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function TrackSessionCard({
  onTracked,
}: {
  onTracked: (publicId: string) => void;
}) {
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = value.trim();
    if (!id) {
      setError("Paste a session id first.");
      return;
    }
    setError(null);
    setChecking(true);
    try {
      // Confirm it exists before pinning it to the list.
      const found = await getCashSession(id);
      onTracked(found.publicId);
      setValue("");
      toast({
        title: "Session added",
        description: `${found.sessionNumber} is now listed below.`,
        variant: "success",
      });
    } catch (err) {
      setError((err as ApiError).message ?? "No session with that id.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Look up a session"
        description="Pull up a till opened elsewhere — on another device, or by another cashier."
      />
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not find it">
            {error}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Session id"
          htmlFor="ts-id"
          required
          hint="The session's public UUID."
        >
          <Input
            id="ts-id"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 9c2f…-…"
            invalid={!!error}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" loading={checking}>
            {checking ? "Looking up…" : "Add to list"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SessionCard({
  publicId,
  onForget,
}: {
  publicId: string;
  onForget: (publicId: string) => void;
}) {
  const [session, setSession] = useState<CashSessionResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [action, setAction] = useState<"none" | "close" | "approve">("none");
  // Derived so the effect body stays free of synchronous setState.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const fetchKey = `${publicId}|${reloadKey}`;
  const loading = loadedKey !== fetchKey;

  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    getCashSession(publicId, controller.signal)
      .then((data) => {
        setSession(data);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setLoadError(err.message ?? "Could not load this session.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(fetchKey);
      });
    return () => controller.abort();
  }, [publicId, fetchKey]);

  if (loading && !session) {
    return (
      <Card>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading session…
        </p>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              Session unavailable
            </p>
            <p className="truncate font-mono text-xs text-zinc-500 dark:text-zinc-400">
              {publicId}
            </p>
            {loadError ? (
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {loadError}
              </p>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={refresh}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onForget(publicId)}>
              Remove
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const expectedTotal =
    (session.openingFloatingAmount ?? 0) + (session.expectedCashAmount ?? 0);
  const isOpen = session.status === "OPEN";
  const isClosed = session.status === "CLOSED" || session.status === "PENDING_APPROVAL";

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {session.sessionNumber}
            </h3>
            <SessionStatusBadge status={session.status} />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {session.cashierName} · opened {formatDateTime(session.openedAt)}
            {session.closedAt ? ` · closed ${formatDateTime(session.closedAt)}` : ""}
            {session.approvedAt
              ? ` · approved ${formatDateTime(session.approvedAt)}`
              : ""}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
            {session.publicId}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isOpen ? (
            <Button
              size="sm"
              onClick={() => setAction(action === "close" ? "none" : "close")}
            >
              {action === "close" ? "Cancel" : "Close till"}
            </Button>
          ) : null}
          {isClosed ? (
            <Button
              size="sm"
              onClick={() =>
                setAction(action === "approve" ? "none" : "approve")
              }
            >
              {action === "approve" ? "Cancel" : "Approve"}
            </Button>
          ) : null}
          <Button size="sm" variant="secondary" onClick={refresh}>
            Refresh
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onForget(publicId)}>
            Remove
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Opening float"
          value={formatMoney(session.openingFloatingAmount)}
        />
        <StatTile
          label="Expected cash"
          value={formatMoney(session.expectedCashAmount)}
          hint={`With float: ${formatMoney(expectedTotal)}`}
        />
        <StatTile
          label="Non-cash taken"
          value={formatMoney(session.expectedNonCashAmount)}
          hint={`${session.paymentCount} ${
            session.paymentCount === 1 ? "payment" : "payments"
          }`}
        />
        <StatTile
          label={isOpen ? "Counted" : "Variance"}
          value={
            isOpen
              ? formatMoney(session.actualCashCounted)
              : formatMoney(session.varianceAmount)
          }
          tone={
            isOpen
              ? "default"
              : (session.varianceAmount ?? 0) === 0
                ? "positive"
                : "negative"
          }
          hint={session.varianceReason ?? undefined}
        />
      </div>

      {session.remarks ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          {session.remarks}
        </p>
      ) : null}

      {action === "close" ? (
        <CloseSessionForm
          session={session}
          expectedTotal={expectedTotal}
          onDone={(updated) => {
            setSession(updated);
            setAction("none");
          }}
        />
      ) : null}

      {action === "approve" ? (
        <ApproveSessionForm
          session={session}
          onDone={(updated) => {
            setSession(updated);
            setAction("none");
          }}
        />
      ) : null}
    </Card>
  );
}

function CloseSessionForm({
  session,
  expectedTotal,
  onDone,
}: {
  session: CashSessionResponse;
  expectedTotal: number;
  onDone: (updated: CashSessionResponse) => void;
}) {
  const { toast } = useToast();
  const { session: auth } = useAuth();
  const [counted, setCounted] = useState("");
  const [varianceReason, setVarianceReason] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live variance so the cashier sees the gap before submitting, not after.
  const countedNumber = Number(counted);
  const hasCount = counted.trim() !== "" && !Number.isNaN(countedNumber);
  const variance = hasCount ? countedNumber - expectedTotal : 0;
  const short = variance < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string | undefined> = {
      counted:
        hasCount && countedNumber >= 0
          ? undefined
          : "Enter the cash counted (0 or more).",
      varianceReason:
        hasCount && variance !== 0 && !varianceReason.trim()
          ? "Explain the difference — the count doesn't match what's expected."
          : undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const updated = await closeCashSession(session.publicId, {
        actualCashCounted: countedNumber,
        ...(auth?.user?.userId ? { closedById: auth.user.userId } : {}),
        ...(varianceReason.trim()
          ? { varianceReason: varianceReason.trim() }
          : {}),
        ...(remarks.trim() ? { remarks: remarks.trim() } : {}),
      });
      toast({
        title: "Till closed",
        description:
          (updated.varianceAmount ?? 0) === 0
            ? "The count matched the expected total."
            : `Variance of ${formatMoney(updated.varianceAmount)} recorded.`,
        variant: (updated.varianceAmount ?? 0) === 0 ? "success" : "info",
      });
      onDone(updated);
    } catch (err) {
      setError((err as ApiError).message ?? "Could not close the session.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      noValidate
    >
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Close {session.sessionNumber}
        </h4>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Expected in the drawer: {formatMoney(expectedTotal)} (float +
          cash taken).
        </p>
      </div>

      {error ? (
        <Alert variant="error" title="Could not close">
          {error}
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Cash counted"
          htmlFor={`cs-count-${session.publicId}`}
          required
          error={errors.counted}
        >
          <Input
            id={`cs-count-${session.publicId}`}
            type="number"
            min="0"
            step="0.01"
            value={counted}
            onChange={(e) => setCounted(e.target.value)}
            placeholder="0.00"
            invalid={!!errors.counted}
          />
        </Field>
        <div className="flex items-end">
          <div className="w-full rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Variance
            </p>
            <p
              className={
                !hasCount
                  ? "text-sm text-zinc-500 dark:text-zinc-400"
                  : variance === 0
                    ? "text-sm font-semibold text-emerald-600 dark:text-emerald-400"
                    : "text-sm font-semibold text-rose-600 dark:text-rose-400"
              }
            >
              {!hasCount
                ? "Enter a count"
                : variance === 0
                  ? "Balanced"
                  : `${short ? "Short" : "Over"} by ${formatMoney(Math.abs(variance))}`}
            </p>
          </div>
        </div>
      </div>

      {hasCount && variance !== 0 ? (
        <Field
          label="Variance reason"
          htmlFor={`cs-reason-${session.publicId}`}
          required
          error={errors.varianceReason}
        >
          <Textarea
            id={`cs-reason-${session.publicId}`}
            value={varianceReason}
            onChange={(e) => setVarianceReason(e.target.value)}
            placeholder="What accounts for the difference?"
            invalid={!!errors.varianceReason}
          />
        </Field>
      ) : null}

      <Field label="Remarks" htmlFor={`cs-remarks-${session.publicId}`}>
        <Textarea
          id={`cs-remarks-${session.publicId}`}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Anything the supervisor should know."
        />
      </Field>

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitting ? "Closing…" : "Close till"}
        </Button>
      </div>
    </form>
  );
}

function ApproveSessionForm({
  session,
  onDone,
}: {
  session: CashSessionResponse;
  onDone: (updated: CashSessionResponse) => void;
}) {
  const { toast } = useToast();
  const { session: auth } = useAuth();
  const [approvedById, setApprovedById] = useState(
    auth?.user?.userId ? String(auth.user.userId) : "",
  );
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!/^\d+$/.test(approvedById.trim())) {
      setFieldError("Enter the approver's numeric user id.");
      return;
    }
    setFieldError(undefined);

    setSubmitting(true);
    try {
      const updated = await approveCashSession(session.publicId, {
        approvedById: Number(approvedById),
      });
      toast({
        title: "Session approved",
        description: `${updated.sessionNumber} is signed off.`,
        variant: "success",
      });
      onDone(updated);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(
        apiErr.status === 403
          ? "That user isn't allowed to approve sessions."
          : (apiErr.message ?? "Could not approve the session."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
      noValidate
    >
      <div>
        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Approve {session.sessionNumber}
        </h4>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Sign-off on the count
          {session.varianceAmount
            ? ` and the ${formatMoney(session.varianceAmount)} variance`
            : ""}
          .
        </p>
      </div>

      {error ? (
        <Alert variant="error" title="Could not approve">
          {error}
        </Alert>
      ) : null}

      <NumericIdField
        label="Approver user id"
        id={`ap-user-${session.publicId}`}
        value={approvedById}
        onChange={setApprovedById}
        required
        error={fieldError}
        hint="Defaults to you. The backend rejects users without the approval role."
      />

      <div className="flex justify-end">
        <Button type="submit" loading={submitting}>
          {submitting ? "Approving…" : "Approve session"}
        </Button>
      </div>
    </form>
  );
}
