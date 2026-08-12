"use client";

// Debounced search over the parent directory, used anywhere a parent already on
// record has to be picked by id: linking a guardian during enrollment, or
// attributing a payment to the parent who made it.

import { useEffect, useState } from "react";
import { Button, Field, Input } from "./ui";
import { apiRequest } from "@/lib/api";
import { USERS } from "@/lib/endpoints";
import type { ApiError, PageResponse, ParentSummary } from "@/lib/types";

const LOOKUP_DEBOUNCE_MS = 300;
const LOOKUP_PAGE_SIZE = 8;

type Props = {
  inputId: string;
  selected: ParentSummary | null;
  onSelect: (parent: ParentSummary | null) => void;
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
};

export function ParentLookup({
  inputId,
  selected,
  onSelect,
  error,
  label = "Find parent",
  hint = "Search by name, email, or mobile number.",
  required = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ParentSummary[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleQueryChange(value: string) {
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
        const page = await apiRequest<
          PageResponse<ParentSummary & { id?: number }>
        >(USERS.parentsLookup, {
          query: { query: q, page: "0", size: String(LOOKUP_PAGE_SIZE) },
          signal: controller.signal,
        });
        setResults(
          (page?.content ?? []).map((r) => ({
            ...r,
            // Tolerate either `parentId` or a generic `id` in lookup rows.
            parentId: r.parentId ?? r.id ?? 0,
          })),
        );
        setSearched(true);
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(true);
          setSearchError(
            (err as ApiError).message ?? "Could not search parents.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, LOOKUP_DEBOUNCE_MS);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  if (selected) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {selected.firstName} {selected.lastName}
          </p>
          <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
            {selected.email} · {selected.mobileNumber}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onSelect(null)}
        >
          Change
        </Button>
      </div>
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
          placeholder="e.g. Ama, ama@example.com, +2332…"
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
            No parents matched your search.
          </p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {results.map((r) => (
              <li key={r.parentId}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {r.firstName} {r.lastName}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.email} · {r.mobileNumber}
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
