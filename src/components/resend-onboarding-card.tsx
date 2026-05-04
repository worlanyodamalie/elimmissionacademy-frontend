"use client";

import { useState } from "react";
import { Alert, Button, Card, CardHeader, Field, Input } from "./ui";
import { apiRequest } from "@/lib/api";
import { useToast } from "./toast";
import { MailIcon } from "./icons";
import { USERS } from "@/lib/endpoints";
import { email as emailValidator } from "@/lib/validation";
import type { ApiError } from "@/lib/types";

export function ResendOnboardingCard() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const localError = !email.trim()
      ? "Email is required."
      : emailValidator(email);
    setFieldError(localError);
    if (localError) return;

    setSubmitting(true);
    try {
      await apiRequest(USERS.resendOnboarding, {
        method: "POST",
        query: { email: email.trim() },
      });
      toast({
        title: "Onboarding link sent",
        description: `A new setup link was sent to ${email}.`,
        variant: "success",
      });
      setEmail("");
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? "Could not resend the onboarding link.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader
        title="Resend onboarding"
        description="If a teammate didn't receive their setup link, send them a fresh one."
      />
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not resend">
            {error}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="User email"
          htmlFor="resend-email"
          required
          className="flex-1"
          error={fieldError}
        >
          <Input
            id="resend-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            required
            invalid={!!fieldError}
          />
        </Field>
        <Button
          type="submit"
          loading={submitting}
          leftIcon={!submitting ? <MailIcon className="h-4 w-4" /> : undefined}
          variant="secondary"
        >
          {submitting ? "Sending…" : "Resend link"}
        </Button>
      </form>
    </Card>
  );
}
