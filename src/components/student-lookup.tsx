"use client";

// Debounced search over the school's active students, used anywhere billing
// asks for a student: opening a bill, carrying arrears forward, recording a
// payment, or narrowing the charge worklists. The endpoint hands back both id
// flavours the billing API uses, so the caller picks whichever it needs
// (`profileId` for request bodies, `profilePublicId` for filters and arrears).

import { useEffect, useRef, useState } from "react";
import { Button, Field, Input } from "./ui";
import { apiRequest } from "@/lib/api";
import { USERS } from "@/lib/endpoints";
import type { ApiError, PageResponse, StudentSearchResult } from "@/lib/types";

const LOOKUP_DEBOUNCE_MS = 300;

type Props = {
  inputId: string;
  selected: StudentSearchResult | null;
  onSelect: (student: StudentSearchResult | null) => void;
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
  // Pre-fills the search box, e.g. with the name of the student who was just
  // onboarded. Read once; typing after that is the user's own.
  initialQuery?: string;
  // With `initialQuery`, pick the student automatically when that search comes
  // back with exactly one match, so a hand-off lands on a filled-in form rather
  // than a search result the user has to click.
  autoSelectSingleMatch?: boolean;
};

export function studentLabel(student: StudentSearchResult): string {
  return student.fullName?.trim() || `Student #${student.profileId}`;
}

export function StudentLookup({
  inputId,
  selected,
  onSelect,
  error,
  label = "Find student",
  hint = "Search by name or student number.",
  required = false,
  initialQuery = "",
  autoSelectSingleMatch = false,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<StudentSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  // Auto-selection is a one-off courtesy for the pre-filled search. Once the
  // user edits the box, or clears a selection, their next search is theirs.
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
          StudentSearchResult[] | PageResponse<StudentSearchResult>
        >(USERS.studentsLookup, {
          query: { query: q },
          signal: controller.signal,
        });
        // The endpoint answers with a bare array; tolerate a page wrapper in
        // case it grows pagination like the parent lookup has.
        const found = Array.isArray(data) ? data : (data?.content ?? []);
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
          // A search with no matches comes back as 404 STUDENT_NOT_FOUND
          // rather than an empty list; that is "no results", not a failure.
          if ((err as ApiError).status !== 404) {
            setSearchError(
              (err as ApiError).message ?? "Could not search students.",
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
    // itself; re-running the search because the parent re-rendered would fire a
    // second request for the same query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  if (selected) {
    return (
      <Field label={label} htmlFor={inputId} required={required} error={error}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {studentLabel(selected)}
            </p>
            <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              {selected.studentNumber ?? `id ${selected.profileId}`}
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
          placeholder="e.g. Kofi, EMA/2026/014"
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
            No students matched your search.
          </p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {results.map((r) => (
              <li key={r.profilePublicId ?? r.profileId}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {studentLabel(r)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {r.studentNumber ?? `id ${r.profileId}`}
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
