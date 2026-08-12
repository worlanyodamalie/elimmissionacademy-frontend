"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
} from "@/components/ui";
import {
  AddressFields,
  EMPTY_ADDRESS,
} from "@/components/address-fields";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/toast";
import { AUTH, ROUTES } from "@/lib/endpoints";
import {
  email as emailValidator,
  ghanaMobile,
  hasErrors,
  normalizeGhanaMobile,
  phone as phoneValidator,
  validateAll,
} from "@/lib/validation";
import type {
  Address,
  ApiError,
  Currency,
  SchoolRegistrationPayload,
  SubscriptionCycle,
  SubscriptionPlan,
} from "@/lib/types";

const PLANS: { value: SubscriptionPlan; label: string; description: string }[] =
  [
    {
      value: "BASIC",
      label: "Basic",
      description: "Enrolment, staff records and billing essentials.",
    },
    {
      value: "PREMIUM",
      label: "Premium",
      description: "Adds the full billing, collections and messaging suite.",
    },
    {
      value: "ENTERPRISE",
      label: "Enterprise",
      description: "Everything, for groups running several campuses.",
    },
  ];

const CYCLES: { value: SubscriptionCycle; label: string }[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "TERMLY", label: "Per term" },
  { value: "YEARLY", label: "Yearly" },
];

// The backend spells the euro "EURO"; these are the only codes it accepts.
const CURRENCIES: { value: Currency; label: string }[] = [
  { value: "GHS", label: "GHS — Ghana Cedi" },
  { value: "USD", label: "USD — US Dollar" },
  { value: "EURO", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — Pound Sterling" },
];

export default function RegisterSchoolPage() {
  const { toast } = useToast();

  const [school, setSchool] = useState({
    schoolName: "",
    mobileNumber: "",
    email: "",
  });
  const [subscription, setSubscription] = useState({
    plan: "BASIC" as SubscriptionPlan,
    cycle: "TERMLY" as SubscriptionCycle,
    currency: "GHS" as Currency,
    startWithTrial: true,
  });
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [admin, setAdmin] = useState({
    firstName: "",
    lastName: "",
    otherNames: "",
    email: "",
    mobileNumber: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    schoolName?: string;
    schoolEmail?: string;
    schoolPhone?: string;
    addressRegion?: string;
    addressCity?: string;
    addressStreet?: string;
    firstName?: string;
    lastName?: string;
    adminEmail?: string;
    adminPhone?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateAll(
      {
        schoolName: school.schoolName,
        schoolEmail: school.email,
        schoolPhone: school.mobileNumber,
        addressRegion: address.region,
        addressCity: address.city,
        addressStreet: address.street,
        firstName: admin.firstName,
        lastName: admin.lastName,
        adminEmail: admin.email,
        adminPhone: admin.mobileNumber,
      },
      {
        schoolName: (v) =>
          v.trim().length >= 2 ? undefined : "School name is required.",
        schoolEmail: (v) =>
          !v.trim() ? "School email is required." : emailValidator(v),
        schoolPhone: (v) =>
          !v.trim() ? "School phone is required." : ghanaMobile(v),
        addressRegion: (v) =>
          v.trim() ? undefined : "Region is required.",
        addressCity: (v) => (v.trim() ? undefined : "City is required."),
        addressStreet: (v) => (v.trim() ? undefined : "Street is required."),
        firstName: (v) => (v.trim() ? undefined : "First name is required."),
        lastName: (v) => (v.trim() ? undefined : "Last name is required."),
        adminEmail: (v) =>
          !v.trim() ? "Admin email is required." : emailValidator(v),
        adminPhone: (v) =>
          !v.trim() ? "Admin phone is required." : phoneValidator(v),
      },
    );
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: SchoolRegistrationPayload = {
        school: {
          schoolName: school.schoolName.trim(),
          email: school.email.trim(),
          mobileNumber: normalizeGhanaMobile(school.mobileNumber),
          address,
        },
        admin: {
          firstName: admin.firstName.trim(),
          lastName: admin.lastName.trim(),
          otherNames: admin.otherNames.trim() || undefined,
          email: admin.email.trim(),
          mobileNumber: normalizeGhanaMobile(admin.mobileNumber),
        },
        subscription: {
          plan: subscription.plan,
          cycle: subscription.cycle,
          currency: subscription.currency,
          startWithTrial: subscription.startWithTrial,
        },
      };
      await apiRequest(AUTH.registerSchool, {
        method: "POST",
        body: payload,
        auth: false,
      });
      setDone(true);
      toast({
        title: "School registered",
        description: "Check the admin email for the setup link.",
        variant: "success",
      });
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? "Could not register school.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Registration submitted
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          We&apos;ve sent a setup link to{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {admin.email}
          </span>
          . Use it to activate the administrator account, then sign in with
          your school code.
        </p>
        <Link
          href={ROUTES.login}
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Go to sign in
        </Link>
      </Card>
    );
  }

  return (
    <div data-auth-wide className="w-full">
      <Card className="p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
            Register your school
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Set up your school and primary administrator. We&apos;ll email a
            setup link to activate the admin account.
          </p>
        </div>

        {error ? (
          <div className="mb-4">
            <Alert variant="error" title="Registration failed">
              {error}
            </Alert>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-8"
          noValidate
        >
          <section className="flex flex-col gap-4">
            <header>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                School details
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Tell us about your institution.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="School name"
                htmlFor="schoolName"
                required
                className="sm:col-span-2"
                error={fieldErrors.schoolName}
              >
                <Input
                  id="schoolName"
                  value={school.schoolName}
                  onChange={(e) =>
                    setSchool({ ...school, schoolName: e.target.value })
                  }
                  required
                  invalid={!!fieldErrors.schoolName}
                />
              </Field>
              <Field
                label="School email"
                htmlFor="schoolEmail"
                required
                error={fieldErrors.schoolEmail}
              >
                <Input
                  id="schoolEmail"
                  type="email"
                  value={school.email}
                  onChange={(e) =>
                    setSchool({ ...school, email: e.target.value })
                  }
                  autoComplete="email"
                  required
                  invalid={!!fieldErrors.schoolEmail}
                />
              </Field>
              <Field
                label="School phone"
                htmlFor="schoolPhone"
                hint={
                  fieldErrors.schoolPhone
                    ? undefined
                    : "Ghanaian number, e.g. +233241234567 or 0241234567."
                }
                required
                error={fieldErrors.schoolPhone}
              >
                <Input
                  id="schoolPhone"
                  type="tel"
                  value={school.mobileNumber}
                  onChange={(e) =>
                    setSchool({ ...school, mobileNumber: e.target.value })
                  }
                  autoComplete="tel"
                  required
                  invalid={!!fieldErrors.schoolPhone}
                />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <header>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Subscription
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                What the school is billed for, and how often. You can change
                the plan later from the dashboard.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Plan"
                htmlFor="plan"
                required
                hint={
                  PLANS.find((p) => p.value === subscription.plan)?.description
                }
              >
                <Select
                  id="plan"
                  value={subscription.plan}
                  onChange={(e) =>
                    setSubscription({
                      ...subscription,
                      plan: e.target.value as SubscriptionPlan,
                    })
                  }
                >
                  {PLANS.map((p) => (
                    <option key={p.value} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Billing cycle" htmlFor="cycle" required>
                <Select
                  id="cycle"
                  value={subscription.cycle}
                  onChange={(e) =>
                    setSubscription({
                      ...subscription,
                      cycle: e.target.value as SubscriptionCycle,
                    })
                  }
                >
                  {CYCLES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Currency" htmlFor="currency" required>
                <Select
                  id="currency"
                  value={subscription.currency}
                  onChange={(e) =>
                    setSubscription({
                      ...subscription,
                      currency: e.target.value as Currency,
                    })
                  }
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="flex items-center sm:pt-6">
                <Checkbox
                  label="Start with a free trial"
                  description="Explore the dashboard before the first invoice."
                  checked={subscription.startWithTrial}
                  onChange={(e) =>
                    setSubscription({
                      ...subscription,
                      startWithTrial: e.target.checked,
                    })
                  }
                />
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <header>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                School address
              </h2>
            </header>
            <AddressFields
              value={address}
              onChange={setAddress}
              idPrefix="school"
              errors={{
                region: fieldErrors.addressRegion,
                city: fieldErrors.addressCity,
                street: fieldErrors.addressStreet,
              }}
            />
          </section>

          <section className="flex flex-col gap-4">
            <header>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Primary administrator
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                The first person who will manage the school. They&apos;ll
                receive a setup link via email.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="First name"
                htmlFor="firstName"
                required
                error={fieldErrors.firstName}
              >
                <Input
                  id="firstName"
                  value={admin.firstName}
                  onChange={(e) =>
                    setAdmin({ ...admin, firstName: e.target.value })
                  }
                  autoComplete="given-name"
                  required
                  invalid={!!fieldErrors.firstName}
                />
              </Field>
              <Field
                label="Last name"
                htmlFor="lastName"
                required
                error={fieldErrors.lastName}
              >
                <Input
                  id="lastName"
                  value={admin.lastName}
                  onChange={(e) =>
                    setAdmin({ ...admin, lastName: e.target.value })
                  }
                  autoComplete="family-name"
                  required
                  invalid={!!fieldErrors.lastName}
                />
              </Field>
              <Field
                label="Other names"
                htmlFor="otherNames"
                className="sm:col-span-2"
              >
                <Input
                  id="otherNames"
                  value={admin.otherNames}
                  onChange={(e) =>
                    setAdmin({ ...admin, otherNames: e.target.value })
                  }
                  autoComplete="additional-name"
                />
              </Field>
              <Field
                label="Email"
                htmlFor="adminEmail"
                required
                error={fieldErrors.adminEmail}
              >
                <Input
                  id="adminEmail"
                  type="email"
                  value={admin.email}
                  onChange={(e) =>
                    setAdmin({ ...admin, email: e.target.value })
                  }
                  autoComplete="email"
                  required
                  invalid={!!fieldErrors.adminEmail}
                />
              </Field>
              <Field
                label="Mobile number"
                htmlFor="adminPhone"
                required
                error={fieldErrors.adminPhone}
              >
                <Input
                  id="adminPhone"
                  type="tel"
                  value={admin.mobileNumber}
                  onChange={(e) =>
                    setAdmin({ ...admin, mobileNumber: e.target.value })
                  }
                  autoComplete="tel"
                  required
                  invalid={!!fieldErrors.adminPhone}
                />
              </Field>
            </div>
          </section>

          <div className="flex flex-col-reverse items-stretch gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <Link
              href={ROUTES.login}
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Already have an account? Sign in
            </Link>
            <Button type="submit" loading={submitting} size="lg">
              {submitting ? "Submitting…" : "Register school"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
