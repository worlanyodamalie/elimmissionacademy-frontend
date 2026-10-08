"use client";

// Debounced search over everyone in the school, for the cash-session fields
// that name a person: the cashier a till is opened for and the supervisor who
// approves it.
//
// `GET /auth/users/lookup` rows carry the person's numeric id as `id` — the
// same id `OpenSessionRequest.cashierId` and `ApproveSessionRequest.approvedById`
// take (verified 2026-10-08: id 4 opened, closed and approved a session as the
// right person; an unknown id answers 404 USER_NOT_FOUND). The rows have no
// roles, so this can't narrow to cashiers or approvers; the backend decides.

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input } from "./ui";
import { apiRequest, isNoMatchError } from "@/lib/api";
import { USERS } from "@/lib/endpoints";
import type { ApiError, PageResponse, UserLookupResult } from "@/lib/types";

const LOOKUP_DEBOUNCE_MS = 300;

// A row the session fields can use: one with the numeric id they post.
export type PickedUser = UserLookupResult & { id: number };

type Props = {
  inputId: string;
  selected: PickedUser | null;
  onSelect: (user: PickedUser | null) => void;
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  // Pre-fills the search box — e.g. with the signed-in user's email, so the
  // field starts on them. Read once; typing after that is the user's own.
  initialQuery?: string;
  // With `initialQuery`, pick the person automatically when that search comes
  // back with exactly one match.
  autoSelectSingleMatch?: boolean;
};

export function userLabel(user: UserLookupResult): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name || user.email || `User #${String(user.id)}`;
}

export function UserLookup({
  inputId,
  selected,
  onSelect,
  error,
  label = "Find person",
  hint = "Search by name or email.",
  required = false,
  initialQuery = "",
  autoSelectSingleMatch = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<PickedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const autoSelectRef = useRef(autoSelectSingleMatch && !!initialQuery.trim());

  function handleQueryChange(value: string) {
    autoSelectRef.current = false;
    setQuery(value);
    setSearchError(null);
    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      setSearching(false);
    }
  }

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await apiRequest<
          UserLookupResult[] | PageResponse<UserLookupResult> | UserLookupResult
        >(USERS.lookup, {
          query: { query: q },
          signal: controller.signal,
        });
        // A bare array today (API-GAPS §O9); a page or a lone object in the
        // past. Rows without a numeric id can't be posted, so they're dropped.
        const rows = Array.isArray(data)
          ? data
          : data && "content" in data && Array.isArray(data.content)
            ? data.content
            : data
              ? [data as UserLookupResult]
              : [];
        const found = rows.filter(
          (r): r is PickedUser => typeof r.id === "number",
        );
        setResults(found);
        setSearched(true);
        if (autoSelectRef.current && found.length === 1) {
          autoSelectRef.current = false;
          onSelect(found[0]);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(true);
          // No match is a 404 USER_NOT_FOUND, which is "no results" here.
          if (!isNoMatchError(err)) {
            setSearchError(
              (err as ApiError).message ?? "Could not search people.",
            );
          }
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
    // `onSelect` is only read inside the auto-select branch, which disarms
    // itself; see `StudentLookup`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (selected) {
    return (
      <Field label={label} htmlFor={inputId} required={required} error={error}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {userLabel(selected)}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {selected.email ?? `id ${selected.id}`}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              autoSelectRef.current = false;
              onSelect(null);
            }}
          >
            Change
          </Button>
        </div>
      </Field>
    );
  }

  return (
    <Field
      label={label}
      htmlFor={inputId}
      required={required}
      hint={hint}
      error={error}
    >
      <div className="flex flex-col gap-2">
        <Input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="e.g. Ama, ama@example.com"
          invalid={!!error}
        />
        {searching ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Searching…</p>
        ) : searchError ? (
          <p className="text-xs text-rose-600 dark:text-rose-400">
            {searchError}
          </p>
        ) : searched && results.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            No one matched your search.
          </p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {userLabel(r)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.email ?? `id ${r.id}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
