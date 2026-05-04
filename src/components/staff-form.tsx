"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Select,
} from "./ui";
import { AddressFields, EMPTY_ADDRESS } from "./address-fields";
import { apiRequest } from "@/lib/api";
import { useToast } from "./toast";
import {
  email as emailValidator,
  hasErrors,
  phone as phoneValidator,
  validateAll,
} from "@/lib/validation";
import type { Address, ApiError, Gender, StaffPayload } from "@/lib/types";

type Props = {
  endpoint: string;
  roleLabel: string;
  successDescription?: string;
  redirectTo?: string;
};

export function StaffForm({
  endpoint,
  roleLabel,
  successDescription,
  redirectTo,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    otherNames: "",
    email: "",
    mobileNumber: "",
    gender: "MALE" as Gender,
  });
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    region?: string;
    city?: string;
    street?: string;
  }>({});

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateAll(
      {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        mobileNumber: form.mobileNumber,
        region: address.region,
        city: address.city,
        street: address.street,
      },
      {
        firstName: (v) => (v.trim() ? undefined : "First name is required."),
        lastName: (v) => (v.trim() ? undefined : "Last name is required."),
        email: (v) => (!v.trim() ? "Email is required." : emailValidator(v)),
        mobileNumber: (v) =>
          !v.trim() ? "Mobile number is required." : phoneValidator(v),
        region: (v) => (v.trim() ? undefined : "Region is required."),
        city: (v) => (v.trim() ? undefined : "City is required."),
        street: (v) => (v.trim() ? undefined : "Street is required."),
      },
    );
    setFieldErrors(errors);
    if (hasErrors(errors)) {
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: StaffPayload = {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        otherNames: form.otherNames.trim() || undefined,
        email: form.email.trim(),
        mobileNumber: form.mobileNumber.trim(),
        gender: form.gender,
        address,
      };
      await apiRequest(endpoint, {
        method: "POST",
        body: payload,
      });
      toast({
        title: `${roleLabel} added`,
        description:
          successDescription ??
          `${form.firstName} ${form.lastName} will receive an onboarding email.`,
        variant: "success",
      });
      setFieldErrors({});
      if (redirectTo) router.push(redirectTo);
      else {
        setForm({
          firstName: "",
          lastName: "",
          otherNames: "",
          email: "",
          mobileNumber: "",
          gender: "MALE",
        });
        setAddress(EMPTY_ADDRESS);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? `Could not add ${roleLabel.toLowerCase()}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        <section className="flex flex-col gap-4">
          <header>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Personal details
            </h2>
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
                value={form.firstName}
                onChange={(e) => update("firstName", e.target.value)}
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
                value={form.lastName}
                onChange={(e) => update("lastName", e.target.value)}
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
                value={form.otherNames}
                onChange={(e) => update("otherNames", e.target.value)}
              />
            </Field>
            <Field label="Gender" htmlFor="gender" required>
              <Select
                id="gender"
                value={form.gender}
                onChange={(e) => update("gender", e.target.value as Gender)}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
            <Field
              label="Mobile number"
              htmlFor="mobile"
              required
              error={fieldErrors.mobileNumber}
            >
              <Input
                id="mobile"
                type="tel"
                value={form.mobileNumber}
                onChange={(e) => update("mobileNumber", e.target.value)}
                autoComplete="tel"
                required
                placeholder="+233241234890"
                invalid={!!fieldErrors.mobileNumber}
              />
            </Field>
            <Field
              label="Email"
              htmlFor="email"
              required
              hint={
                fieldErrors.email
                  ? undefined
                  : "Used to send the onboarding link."
              }
              error={fieldErrors.email}
              className="sm:col-span-2"
            >
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
                required
                invalid={!!fieldErrors.email}
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <header>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Address
            </h2>
          </header>
          <AddressFields
            value={address}
            onChange={setAddress}
            errors={{
              region: fieldErrors.region,
              city: fieldErrors.city,
              street: fieldErrors.street,
            }}
          />
        </section>

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : `Add ${roleLabel.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}
