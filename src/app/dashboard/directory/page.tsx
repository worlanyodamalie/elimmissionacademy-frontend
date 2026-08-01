"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, PageHeader } from "@/components/ui";
import { EmptyState, Pagination } from "@/components/billing-ui";
import { ResendOnboardingCard } from "@/components/resend-onboarding-card";
import { RoleSwapIcon, SearchIcon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { ROUTES, USERS } from "@/lib/endpoints";
import { formatRoleLabel, getInitials } from "@/lib/utils";
import type { ApiError, PageResponse, UserLookupResult } from "@/lib/types";

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 350;
// The endpoint requires a non-empty `query`, and one-letter searches match
// most of the school — wait for something the person actually meant to type.
const MIN_QUERY = 2;

// Lookup rows are typed as bare objects by the API, so read every display
// value through a tolerant accessor rather than trusting one field name.
function displayName(user: UserLookupResult): string {
  const composed = [user.firstName, user.otherNames, user.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  return composed || user.fullName || user.email || "Unnamed user";
}

function rolesOf(user: UserLookupResult): string[] {
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  if (typeof user.role === "string" && user.role) return [user.role];
  return [];
}

export default function DirectoryPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<UserLookupResult[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const q = query.trim();
  const active = q.length >= MIN_QUERY;
  // Loading is derived from "which search have we finished?" rather than a
  // state flag, so the effect never calls setState synchronously.
  const fetchKey = active ? `${q}|${page}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  const loading = active && loadedKey !== fetchKey;
  const searched = active && !loading;

  useEffect(() => {
    if (!active) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      apiRequest<PageResponse<UserLookupResult>>(USERS.lookup, {
        query: { query: q, page: String(page), size: String(PAGE_SIZE) },
        signal: controller.signal,
      })
        .then((response) => {
          setResults(response?.content ?? []);
          setTotalPages(response?.totalPages ?? 0);
          setTotalElements(response?.totalElements ?? 0);
          setError(null);
        })
        .catch((err: ApiError) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setTotalElements(0);
          setTotalPages(0);
          setError(err.message ?? "Could not search users.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadedKey(fetchKey);
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [active, fetchKey, q, page]);

  // Results belong to the last completed search; hide them while a new one is
  // in flight or the box has been cleared.
  const visibleResults = searched && !error ? results : [];

  function onQueryChange(next: string) {
    setQuery(next);
    // A new term always restarts at the first page.
    setPage(0);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="People"
        description="Search everyone in your school — staff, parents and students — then resend an onboarding link or change someone's role."
        action={
          <Link
            href={ROUTES.roleChange}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900"
          >
            <RoleSwapIcon className="h-4 w-4" />
            Change a role
          </Link>
        }
      />

      <Card>
        <Field
          label="Search"
          htmlFor="user-search"
          hint="Name, email or mobile number. At least two characters."
          error={!loading ? (error ?? undefined) : undefined}
        >
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input
              id="user-search"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              placeholder="e.g. Ama, ama@example.com, 024…"
              className="pl-9"
              autoComplete="off"
              invalid={!!error}
            />
          </div>
        </Field>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            Searching…
          </p>
        ) : null}

        {searched && visibleResults.length === 0 && !error ? (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            No one matches “{q}”.
          </p>
        ) : null}

        {visibleResults.length > 0 ? (
          <>
            <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-900">
              {visibleResults.map((user, i) => {
                const name = displayName(user);
                const roles = rolesOf(user);
                return (
                  <li
                    key={user.publicId ?? user.userId ?? `${user.email}-${i}`}
                    className="flex flex-wrap items-center gap-4 py-4 first:pt-0"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
                      {getInitials(user.firstName, user.lastName, "U")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {name}
                      </p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {[user.email, user.mobileNumber]
                          .filter(Boolean)
                          .join(" · ") || "No contact details"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {roles.map((role) => (
                        <Badge key={role} variant="info">
                          {formatRoleLabel(role)}
                        </Badge>
                      ))}
                      {user.status ? (
                        <Badge
                          variant={
                            user.status === "ACTIVE" ? "success" : "neutral"
                          }
                        >
                          {formatRoleLabel(user.status)}
                        </Badge>
                      ) : null}
                    </div>
                    {user.email ? (
                      <Link
                        href={`${ROUTES.roleChange}?email=${encodeURIComponent(
                          user.email,
                        )}&mobileNumber=${encodeURIComponent(
                          user.mobileNumber ?? "",
                        )}`}
                      >
                        <Button size="sm" variant="secondary" type="button">
                          Change role
                        </Button>
                      </Link>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <Pagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              onPageChange={setPage}
              loading={loading}
            />
          </>
        ) : null}
      </Card>

      {!active ? (
        <EmptyState title="Start typing to find someone">
          The directory searches every user in this school. Use it to check
          whether an account already exists before creating a new one.
        </EmptyState>
      ) : null}

      <ResendOnboardingCard />
    </div>
  );
}
