"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, Card, Field, Input, PasswordInput } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/toast";
import { readLastSchoolCode } from "@/lib/api";
import {
  hasErrors,
  schoolCode as schoolCodeError,
  validateAll,
} from "@/lib/validation";
import { ROUTES } from "@/lib/endpoints";
import { safeReturnTo } from "@/lib/safe-redirect";
import type { ApiError } from "@/lib/types";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = safeReturnTo(params.get("from"), ROUTES.dashboard);
  const prefilledSchoolCode = params.get("school") ?? "";
  const { login, session } = useAuth();
  const { toast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [schoolCode, setSchoolCode] = useState(
    () => prefilledSchoolCode || readLastSchoolCode() || "",
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    schoolCode?: string;
    identifier?: string;
    password?: string;
  }>({});

  useEffect(() => {
    if (session) router.replace(redirectTo);
  }, [session, router, redirectTo]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateAll(
      { schoolCode, identifier, password },
      {
        schoolCode: (v) =>
          !v.trim() ? "School code is required." : schoolCodeError(v),
        identifier: (v) =>
          v.trim() ? undefined : "Email or username is required.",
        password: (v) => (v ? undefined : "Password is required."),
      },
    );
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      await login({
        login: identifier.trim(),
        password,
        schoolCode: schoolCode.trim(),
      });
      toast({
        title: "Welcome back",
        description: "Signed in successfully.",
        variant: "success",
      });
      router.replace(redirectTo);
    } catch (err) {
      const apiErr = err as ApiError;
      // Don't leak which of school/email/password was wrong — that enables
      // user enumeration. 5xx and network errors get a separate message so
      // the user knows it's not their input.
      const status = apiErr.status ?? 0;
      if (status >= 500 || status === 0) {
        setError("Something went wrong on our end. Please try again.");
      } else {
        setError("Invalid school code, email, or password.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          Sign in
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Use your school code and credentials to access the dashboard.
        </p>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Sign in failed">
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
            autoComplete="organization"
            required
            autoCapitalize="off"
            spellCheck={false}
            invalid={!!fieldErrors.schoolCode}
            aria-invalid={!!fieldErrors.schoolCode || undefined}
          />
        </Field>
        <Field
          label="Email or username"
          htmlFor="identifier"
          required
          error={fieldErrors.identifier}
        >
          <Input
            id="identifier"
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            required
            invalid={!!fieldErrors.identifier}
            aria-invalid={!!fieldErrors.identifier || undefined}
          />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          required
          error={fieldErrors.password}
        >
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            invalid={!!fieldErrors.password}
            aria-invalid={!!fieldErrors.password || undefined}
          />
        </Field>

        <div className="flex items-center justify-between">
          <Link
            href={ROUTES.forgotPassword}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" loading={submitting} className="mt-2 w-full" size="lg">
          {submitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        New school?{" "}
        <Link
          href={ROUTES.registerSchool}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Register your school
        </Link>
      </p>
    </Card>
  );
}
