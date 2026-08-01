"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Card, CardHeader, PageHeader } from "@/components/ui";
import { EmptyState } from "@/components/billing-ui";
import { SchoolCodeCard } from "@/components/school-code-card";
import { apiRequest, decodeJwt, readSession } from "@/lib/api";
import { AUTH } from "@/lib/endpoints";
import { formatDate, formatEnumLabel } from "@/lib/utils";
import type {
  ApiError,
  SchoolProfileResponse,
  SchoolSubscriptionSummary,
  SubscriptionStatus,
} from "@/lib/types";

// The profile endpoint is keyed by the school's public UUID. Nothing in the
// dashboard state carries it, so it has to come out of the JWT — different
// deployments name the claim differently, hence the list.
const SCHOOL_ID_CLAIMS = [
  "schoolPublicId",
  "schoolUuid",
  "schoolPublicUuid",
  "schoolId",
];

function schoolIdFromToken(token: string | undefined): string | null {
  if (!token) return null;
  const claims = decodeJwt(token);
  if (!claims) return null;
  for (const key of SCHOOL_ID_CLAIMS) {
    const value = claims[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

function subscriptionVariant(
  status: SubscriptionStatus | undefined,
): "success" | "warning" | "danger" | "neutral" {
  switch (status) {
    case "ACTIVE":
    case "TRIAL":
      return "success";
    case "GRACE_PERIOD":
    case "PENDING_PAYMENT":
    case "CANCELLED_SCHEDULED":
      return "warning";
    case "SUSPENDED":
    case "CANCELLED":
    case "EXPIRED":
      return "danger";
    default:
      return "neutral";
  }
}

export default function SchoolProfilePage() {
  const [profile, setProfile] = useState<SchoolProfileResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Set once the request settles, so `loading` is derived rather than a flag
  // the effect has to set synchronously.
  const [loaded, setLoaded] = useState(false);

  const session = typeof window !== "undefined" ? readSession() : null;
  const schoolCode = session?.schoolCode ?? "";
  const schoolId = schoolIdFromToken(session?.token);

  useEffect(() => {
    if (!schoolId) return;
    const controller = new AbortController();
    apiRequest<SchoolProfileResponse>(AUTH.schoolProfile(schoolId), {
      signal: controller.signal,
    })
      .then((data) => {
        setProfile(data);
        setLoadError(null);
      })
      .catch((err: ApiError) => {
        if (controller.signal.aborted) return;
        setProfile(null);
        setLoadError(err.message ?? "Could not load the school profile.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, [schoolId]);

  const loading = !!schoolId && !loaded;
  const error = schoolId
    ? loadError
    : "Your sign-in token doesn't carry a school id, so the profile can't be fetched.";

  const address = profile?.schoolAddress;
  const addressLine = [
    address?.street,
    address?.city,
    address?.region,
    address?.country,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="School profile"
        description="How your school is registered, and the subscription it runs on."
      />

      {error ? (
        <Alert variant="error" title="Could not load the profile">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <EmptyState title="Loading…">
          Fetching your school&apos;s registration details.
        </EmptyState>
      ) : null}

      {profile ? (
        <>
          <Card>
            <CardHeader
              title={profile.schoolName ?? "Your school"}
              description={addressLine || undefined}
              action={
                profile.status ? (
                  <Badge
                    variant={
                      profile.status === "ACTIVE" ? "success" : "danger"
                    }
                  >
                    {formatEnumLabel(profile.status)}
                  </Badge>
                ) : undefined
              }
            />
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Detail label="Email" value={profile.email} />
              <Detail label="Mobile number" value={profile.mobileNumber} />
              <Detail
                label="Digital address"
                value={address?.digitalAddress}
              />
              <Detail label="Timezone" value={profile.timezone} />
              <Detail label="Currency" value={profile.currency} />
            </dl>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Subscription"
                description="What the school is currently billed for."
              />
              {profile.activeSubscription ? (
                <SubscriptionRow sub={profile.activeSubscription} />
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  No active subscription.
                </p>
              )}

              {profile.subscriptions && profile.subscriptions.length > 1 ? (
                <div className="mt-6">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    History
                  </p>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
                    {profile.subscriptions
                      .filter(
                        (s) =>
                          s.subscriptionId !==
                          profile.activeSubscription?.subscriptionId,
                      )
                      .map((s) => (
                        <li key={s.subscriptionId} className="py-3">
                          <SubscriptionRow sub={s} />
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}
            </Card>

            <Card>
              <CardHeader
                title="School code"
                description="Everyone at this school needs it to sign in."
              />
              <SchoolCodeCard
                code={profile.schoolCode ?? schoolCode}
                title="School code"
                description="Share it with new staff and parents — they can't sign in without it."
              />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-zinc-900 dark:text-zinc-100">
        {value || "—"}
      </dd>
    </div>
  );
}

function SubscriptionRow({ sub }: { sub: SchoolSubscriptionSummary }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {sub.planName ?? "Plan"}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(sub.startDate)} — {formatDate(sub.endDate)}
        </p>
      </div>
      <Badge variant={subscriptionVariant(sub.status)}>
        {formatEnumLabel(sub.status)}
      </Badge>
    </div>
  );
}
