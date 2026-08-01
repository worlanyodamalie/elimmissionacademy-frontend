"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Field, PasswordInput } from "@/components/ui";
import { SchoolCodeCard } from "@/components/school-code-card";
import { apiRequest, rememberSchoolCode } from "@/lib/api";
import { useToast } from "@/components/toast";
import { AUTH, ROUTES } from "@/lib/endpoints";
import {
  hasErrors,
  password as passwordValidator,
  validateAll,
} from "@/lib/validation";
import type { ApiError } from "@/lib/types";

export default function AdminSetupPage() {
  return (
    <Suspense fallback={null}>
      <AdminSetupForm />
    </Suspense>
  );
}

function AdminSetupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  const token = (params.get("token") ?? "").trim();
  const schoolCode = (params.get("schoolCode") ?? "").trim();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    password?: string;
    confirm?: string;
  }>({});

  const linkInvalid = !token || !schoolCode;

  // Scrub the token + schoolCode from the visible URL once we've read them
  // into component state. Stops them from sitting in browser history, sync,
  // screenshots, or being leaked via Referer to any third-party asset.
  useEffect(() => {
    if (linkInvalid) return;
    if (typeof window === "undefined") return;
    if (window.location.search) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [linkInvalid]);

  const mismatch = useMemo(
    () => confirm.length > 0 && password !== confirm,
    [password, confirm],
  );
  const tooShort = password.length > 0 && password.length < 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors = validateAll(
      { password, confirm },
      {
        password: (v) => (!v ? "Password is required." : passwordValidator(v)),
        confirm: (v) =>
          v === password ? undefined : "Passwords do not match.",
      },
    );
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    try {
      await apiRequest(AUTH.adminAccountSetup, {
        method: "POST",
        // The endpoint takes the token in the query string and nothing but the
        // password in the body; the school is identified by the header.
        body: { password },
        query: { token },
        schoolCode,
        auth: false,
      });
      rememberSchoolCode(schoolCode);
      toast({
        title: "Account ready",
        description: "Save your school code and sign in to continue.",
        variant: "success",
      });
      setDone(true);
    } catch (err) {
      const apiErr = err as ApiError;
      const fallback =
        apiErr.status === 401
          ? "This setup link is no longer valid. It may have already been used or expired. Ask your administrator to resend it."
          : "Could not complete setup.";
      setError(apiErr.message?.trim() || fallback);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <Card className="p-8">
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
        <h1 className="text-center text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
          You&apos;re all set
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm text-zinc-500 dark:text-zinc-400">
          Your administrator account is ready. Make a note of your school code
          before continuing — you&apos;ll need it every time you sign in.
        </p>
        <div className="mt-6">
          <SchoolCodeCard code={schoolCode} />
        </div>
        <Button
          onClick={() =>
            router.replace(
              `${ROUTES.login}?school=${encodeURIComponent(schoolCode)}`,
            )
          }
          size="lg"
          className="mt-6 w-full"
        >
          Continue to sign in
        </Button>
      </Card>
    );
  }

  if (linkInvalid) {
    return (
      <Card className="p-8">
        <Alert variant="error" title="This link is invalid">
          The setup link is missing required information. Open the link from
          your invitation email again, or ask your administrator to resend it.
        </Alert>
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
          Administrator setup
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Complete your school&apos;s primary administrator account by setting a
          password.
        </p>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          School code:{" "}
          <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">
            {schoolCode}
          </span>
        </p>
      </div>

      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Setup failed">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field
          label="Password"
          htmlFor="password"
          required
          hint={
            !tooShort && !fieldErrors.password
              ? "Use at least 8 characters."
              : undefined
          }
          error={
            fieldErrors.password ??
            (tooShort ? "Password must be at least 8 characters." : undefined)
          }
        >
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            autoFocus
            invalid={tooShort || !!fieldErrors.password}
            aria-invalid={tooShort || !!fieldErrors.password || undefined}
          />
        </Field>
        <Field
          label="Confirm password"
          htmlFor="confirm"
          required
          error={
            fieldErrors.confirm ??
            (mismatch ? "Passwords do not match." : undefined)
          }
        >
          <PasswordInput
            id="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
            invalid={mismatch || !!fieldErrors.confirm}
            aria-invalid={mismatch || !!fieldErrors.confirm || undefined}
          />
        </Field>

        <Button
          type="submit"
          loading={submitting}
          size="lg"
          className="mt-2 w-full"
        >
          {submitting ? "Setting up…" : "Complete setup"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
        Already done?{" "}
        <Link
          href={ROUTES.login}
          className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
        >
          Sign in
        </Link>
      </p>
    </Card>
  );
}
