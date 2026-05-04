"use client";

import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { apiRequest } from "@/lib/api";
import { AUTH, ROUTES } from "@/lib/endpoints";
import {
  email as emailValidator,
  hasErrors,
  schoolCode as schoolCodeError,
  validateAll,
} from "@/lib/validation";
import type { ApiError } from "@/lib/types";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [schoolCode, setSchoolCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    schoolCode?: string;
    email?: string;
  }>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateAll(
      { schoolCode, email },
      {
        schoolCode: (v) =>
          !v.trim() ? "School code is required." : schoolCodeError(v),
        email: (v) =>
          !v.trim() ? "Email is required." : emailValidator(v),
      },
    );
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      await apiRequest(AUTH.forgotPassword, {
        method: "POST",
        body: { email: email.trim() },
        schoolCode: schoolCode.trim(),
        auth: false,
      });
      setSubmitted(true);
    } catch (err) {
      const apiErr = err as ApiError;
      const status = apiErr.status ?? 0;
      // For 4xx (e.g. unknown email, unknown school code), show the same
      // success message we'd show on success — otherwise we leak whether
      // the email/school exists. Only true server errors get an error UI.
      if (status >= 500 || status === 0) {
        setError("Something went wrong on our end. Please try again.");
      } else {
        setSubmitted(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
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
            <path d="M4 6h16v12H4z" />
            <path d="m4 6 8 7 8-7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
          Check your inbox
        </h1>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          If an account exists for{" "}
          <span className="font-medium text-zinc-700 dark:text-zinc-300">
            {email}
          </span>
          , you&apos;ll receive a password reset link shortly.
        </p>
        <Link
          href={ROUTES.login}
          className="mt-6 inline-block text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Back to sign in
        </Link>
      </Card>
    );
  }

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Forgot password
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter your school code and email and we&apos;ll send instructions to
          reset your password.
        </p>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not send email">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label="School code"
          htmlFor="schoolCode"
          required
          error={fieldErrors.schoolCode}
        >
          <Input
            id="schoolCode"
            value={schoolCode}
            onChange={(e) => setSchoolCode(e.target.value)}
            placeholder="e.g. ELI_cac4d"
            required
            autoCapitalize="off"
            spellCheck={false}
            invalid={!!fieldErrors.schoolCode}
            aria-invalid={!!fieldErrors.schoolCode || undefined}
          />
        </Field>
        <Field
          label="Email"
          htmlFor="email"
          required
          error={fieldErrors.email}
        >
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            invalid={!!fieldErrors.email}
            aria-invalid={!!fieldErrors.email || undefined}
          />
        </Field>

        <Button
          type="submit"
          loading={submitting}
          size="lg"
          className="mt-2 w-full"
        >
          {submitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Remembered it?{" "}
        <Link
          href={ROUTES.login}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
