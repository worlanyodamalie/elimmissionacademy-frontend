"use client";

import Link from "next/link";
import { useState } from "react";
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
import { EmptyState, Money, NumericIdField } from "@/components/billing-ui";
import { ChevronRightIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { createDiscount, createDiscountRule } from "@/lib/billing";
import {
  DISCOUNT_NAMES,
  DISCOUNT_RULE_TYPES,
  DISCOUNT_TYPES,
} from "@/lib/billing-options";
import { ROUTES } from "@/lib/endpoints";
import { formatDate, formatEnumLabel } from "@/lib/utils";
import type {
  ApiError,
  DiscountName,
  DiscountResponse,
  DiscountRuleRequest,
  DiscountRuleResponse,
  DiscountRuleType,
  DiscountType,
} from "@/lib/types";

export default function DiscountsPage() {
  // There is no list endpoint for discounts yet, so the page shows what this
  // visit created rather than pretending to be a full register.
  const [discounts, setDiscounts] = useState<DiscountResponse[]>([]);
  const [rules, setRules] = useState<DiscountRuleResponse[]>([]);

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
        <span className="text-zinc-900 dark:text-zinc-100">Discounts</span>
      </nav>

      <PageHeader
        title="Discounts"
        description="A discount says how much comes off. A rule says who gets it automatically — staff children, siblings, scholarships, promotions."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NewDiscountCard
          onCreated={(d) => setDiscounts((prev) => [d, ...prev])}
        />
        <NewRuleCard onCreated={(r) => setRules((prev) => [r, ...prev])} />
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Created in this session
        </h2>
        {discounts.length === 0 && rules.length === 0 ? (
          <EmptyState title="Nothing created yet">
            The API has no endpoint to list existing discounts, so anything
            created here is listed below until you reload.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {discounts.length > 0 ? (
              <Card>
                <CardHeader title="Discounts" />
                <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
                  {discounts.map((d) => (
                    <li
                      key={d.publicId}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatEnumLabel(d.discountName)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {d.discountType === "PERCENTAGE"
                            ? `${d.value}% off`
                            : `${d.value} off`}
                          {d.maxAmount ? (
                            <>
                              {" "}
                              · capped at{" "}
                              <Money amount={d.maxAmount} currency="GHS" />
                            </>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                          {d.publicId}
                        </p>
                      </div>
                      <Badge variant={d.active ? "success" : "neutral"}>
                        {d.active ? "Active" : "Inactive"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {rules.length > 0 ? (
              <Card>
                <CardHeader title="Rules" />
                <ul className="flex flex-col divide-y divide-zinc-100 dark:divide-zinc-900">
                  {rules.map((r) => (
                    <li
                      key={r.publicId}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {formatEnumLabel(r.ruleType)}
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {r.discountName}
                          {r.priority ? ` · priority ${r.priority}` : ""}
                          {r.validUntil
                            ? ` · until ${formatDate(r.validUntil)}`
                            : ""}
                        </p>
                      </div>
                      <Badge variant={r.active ? "success" : "neutral"}>
                        {r.active ? "Active" : "Inactive"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}

function NewDiscountCard({
  onCreated,
}: {
  onCreated: (discount: DiscountResponse) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: "STAFF_CHILDREN" as DiscountName,
    discountType: "PERCENTAGE" as DiscountType,
    value: "",
    maxAmount: "",
    active: true,
    reason: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPercentage = form.discountType === "PERCENTAGE";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const value = Number(form.value);
    const errs: Record<string, string | undefined> = {
      value: !form.value.trim()
        ? "Enter the discount value."
        : value <= 0
          ? "Value must be greater than 0."
          : isPercentage && value > 100
            ? "A percentage can't exceed 100."
            : undefined,
      reason:
        form.reason.length > 500
          ? "Keep the reason under 500 characters."
          : undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const created = await createDiscount({
        name: form.name,
        discountType: form.discountType,
        value,
        ...(form.maxAmount.trim() ? { maxAmount: Number(form.maxAmount) } : {}),
        active: form.active,
        ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
      });
      toast({
        title: "Discount created",
        description: `${formatEnumLabel(created.discountName)} is ready to attach a rule to.`,
        variant: "success",
      });
      setForm({ ...form, value: "", maxAmount: "", reason: "" });
      onCreated(created);
    } catch (err) {
      setError((err as ApiError).message ?? "Could not create the discount.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="New discount"
        description="How much comes off a bill, and whether it's capped."
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
          <Field label="Discount" htmlFor="d-name" required>
            <Select
              id="d-name"
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value as DiscountName })
              }
            >
              {DISCOUNT_NAMES.map((n) => (
                <option key={n.value} value={n.value}>
                  {n.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Type" htmlFor="d-type" required>
            <Select
              id="d-type"
              value={form.discountType}
              onChange={(e) =>
                setForm({
                  ...form,
                  discountType: e.target.value as DiscountType,
                })
              }
            >
              {DISCOUNT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={isPercentage ? "Percentage" : "Amount off"}
            htmlFor="d-value"
            required
            error={errors.value}
            hint={isPercentage ? "1–100." : "In the school's currency."}
          >
            <Input
              id="d-value"
              type="number"
              min="0.01"
              step="0.01"
              max={isPercentage ? 100 : undefined}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder={isPercentage ? "e.g. 25" : "0.00"}
              invalid={!!errors.value}
            />
          </Field>

          <Field
            label="Maximum amount"
            htmlFor="d-max"
            hint="Optional ceiling on what a percentage can take off."
          >
            <Input
              id="d-max"
              type="number"
              min="0"
              step="0.01"
              value={form.maxAmount}
              onChange={(e) => setForm({ ...form, maxAmount: e.target.value })}
              placeholder="0.00"
            />
          </Field>
        </div>

        <Field label="Reason" htmlFor="d-reason" error={errors.reason}>
          <Textarea
            id="d-reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            maxLength={500}
            placeholder="Why this discount exists (max 500 characters)."
            invalid={!!errors.reason}
          />
        </Field>

        <Checkbox
          label="Active"
          description="Inactive discounts stay on record but aren't applied."
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Create discount"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function NewRuleCard({
  onCreated,
}: {
  onCreated: (rule: DiscountRuleResponse) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    discountId: "",
    ruleType: "STAFF_CHILDREN" as DiscountRuleType,
    priority: "",
    active: true,
    reason: "",
    directChildrenOnly: true,
    requireActiveStaff: true,
    multiSiblingCount: "2",
    minAcademicScore: "",
    requiresFinancialNeedAssessment: false,
    maxHouseholdIncome: "",
    validFrom: "",
    validUntil: "",
    maxRedemptions: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Record<string, string | undefined> = {
      discountId: /^\d+$/.test(form.discountId.trim())
        ? undefined
        : "Enter the discount's numeric id.",
      multiSiblingCount:
        form.ruleType === "MULTIPLE_SIBLING" && Number(form.multiSiblingCount) < 2
          ? "At least 2 siblings."
          : undefined,
      minAcademicScore:
        form.ruleType === "SCHOLARSHIP" &&
        form.minAcademicScore &&
        (Number(form.minAcademicScore) <= 0 ||
          Number(form.minAcademicScore) > 100)
          ? "Score must be between 1 and 100."
          : undefined,
      validUntil:
        form.ruleType === "PROMOTIONAL" &&
        form.validFrom &&
        form.validUntil &&
        form.validUntil <= form.validFrom
          ? "The end date must be after the start date."
          : undefined,
    };
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const body: DiscountRuleRequest = {
        discountId: Number(form.discountId),
        ruleType: form.ruleType,
        active: form.active,
        ...(form.priority.trim() ? { priority: Number(form.priority) } : {}),
        ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
      };

      if (form.ruleType === "STAFF_CHILDREN") {
        body.directChildrenOnly = form.directChildrenOnly;
        body.requireActiveStaff = form.requireActiveStaff;
      }
      if (form.ruleType === "MULTIPLE_SIBLING") {
        body.multiSiblingCount = Number(form.multiSiblingCount);
      }
      if (form.ruleType === "SCHOLARSHIP") {
        body.requiresFinancialNeedAssessment =
          form.requiresFinancialNeedAssessment;
        if (form.minAcademicScore.trim()) {
          body.minAcademicScore = Number(form.minAcademicScore);
        }
        if (form.maxHouseholdIncome.trim()) {
          body.maxHouseholdIncome = Number(form.maxHouseholdIncome);
        }
      }
      if (form.ruleType === "PROMOTIONAL") {
        if (form.validFrom) body.validFrom = form.validFrom;
        if (form.validUntil) body.validUntil = form.validUntil;
        if (form.maxRedemptions.trim()) {
          body.maxRedemptions = Number(form.maxRedemptions);
        }
      }

      const created = await createDiscountRule(body);
      toast({
        title: "Rule created",
        description: `${formatEnumLabel(created.ruleType)} now applies ${created.discountName}.`,
        variant: "success",
      });
      onCreated(created);
    } catch (err) {
      setError((err as ApiError).message ?? "Could not create the rule.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="New rule"
        description="Who qualifies for a discount without anyone applying it by hand."
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
          <NumericIdField
            label="Discount id"
            id="r-discount"
            value={form.discountId}
            onChange={(v) => setForm({ ...form, discountId: v })}
            required
            error={errors.discountId}
          />

          <Field label="Rule type" htmlFor="r-type" required>
            <Select
              id="r-type"
              value={form.ruleType}
              onChange={(e) =>
                setForm({
                  ...form,
                  ruleType: e.target.value as DiscountRuleType,
                })
              }
            >
              {DISCOUNT_RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Priority"
            htmlFor="r-priority"
            hint="Lower wins when several rules match."
          >
            <Input
              id="r-priority"
              type="number"
              min={1}
              step={1}
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              placeholder="e.g. 1"
            />
          </Field>
        </div>

        {form.ruleType === "STAFF_CHILDREN" ? (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <Checkbox
              label="Direct children only"
              description="Exclude wards and other dependants."
              checked={form.directChildrenOnly}
              onChange={(e) =>
                setForm({ ...form, directChildrenOnly: e.target.checked })
              }
            />
            <Checkbox
              label="Require active staff"
              description="Drops the discount if the parent leaves the school."
              checked={form.requireActiveStaff}
              onChange={(e) =>
                setForm({ ...form, requireActiveStaff: e.target.checked })
              }
            />
          </div>
        ) : null}

        {form.ruleType === "MULTIPLE_SIBLING" ? (
          <Field
            label="Siblings enrolled"
            htmlFor="r-siblings"
            required
            error={errors.multiSiblingCount}
            hint="Minimum number of enrolled siblings before the discount applies."
          >
            <Input
              id="r-siblings"
              type="number"
              min={2}
              step={1}
              value={form.multiSiblingCount}
              onChange={(e) =>
                setForm({ ...form, multiSiblingCount: e.target.value })
              }
              invalid={!!errors.multiSiblingCount}
            />
          </Field>
        ) : null}

        {form.ruleType === "SCHOLARSHIP" ? (
          <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Minimum academic score"
                htmlFor="r-score"
                error={errors.minAcademicScore}
                hint="Out of 100. Optional."
              >
                <Input
                  id="r-score"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={form.minAcademicScore}
                  onChange={(e) =>
                    setForm({ ...form, minAcademicScore: e.target.value })
                  }
                  placeholder="e.g. 75"
                  invalid={!!errors.minAcademicScore}
                />
              </Field>
              <Field
                label="Maximum household income"
                htmlFor="r-income"
                hint="Optional means test."
              >
                <Input
                  id="r-income"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.maxHouseholdIncome}
                  onChange={(e) =>
                    setForm({ ...form, maxHouseholdIncome: e.target.value })
                  }
                  placeholder="0.00"
                />
              </Field>
            </div>
            <Checkbox
              label="Requires financial need assessment"
              description="A member of staff must sign off before it applies."
              checked={form.requiresFinancialNeedAssessment}
              onChange={(e) =>
                setForm({
                  ...form,
                  requiresFinancialNeedAssessment: e.target.checked,
                })
              }
            />
          </div>
        ) : null}

        {form.ruleType === "PROMOTIONAL" ? (
          <div className="grid grid-cols-1 gap-4 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800 sm:grid-cols-3">
            <Field label="Valid from" htmlFor="r-from">
              <DateInput
                id="r-from"
                value={form.validFrom}
                onChange={(value) => setForm({ ...form, validFrom: value })}
              />
            </Field>
            <Field
              label="Valid until"
              htmlFor="r-until"
              error={errors.validUntil}
            >
              <DateInput
                id="r-until"
                value={form.validUntil}
                onChange={(value) =>
                  setForm({ ...form, validUntil: value })
                }
                invalid={!!errors.validUntil}
              />
            </Field>
            <Field
              label="Max redemptions"
              htmlFor="r-redemptions"
              hint="Optional cap."
            >
              <Input
                id="r-redemptions"
                type="number"
                min={1}
                step={1}
                value={form.maxRedemptions}
                onChange={(e) =>
                  setForm({ ...form, maxRedemptions: e.target.value })
                }
                placeholder="e.g. 50"
              />
            </Field>
          </div>
        ) : null}

        <Field label="Reason" htmlFor="r-reason">
          <Textarea
            id="r-reason"
            value={form.reason}
            onChange={(e) => setForm({ ...form, reason: e.target.value })}
            maxLength={500}
            placeholder="Context for whoever reviews this later."
          />
        </Field>

        <Checkbox
          label="Active"
          checked={form.active}
          onChange={(e) => setForm({ ...form, active: e.target.checked })}
        />

        <div className="flex justify-end">
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Create rule"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
