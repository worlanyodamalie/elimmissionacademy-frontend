"use client";

// Debounced search over the school's class levels, for anywhere a form needs
// to name one.
//
// `GET /class_levels/lookup` is the right endpoint for a picker: it answers
// with the numeric `classLevelId` an enrolment body takes, alongside the
// `classLevelPublicId` the class-level pages are keyed by. Nothing else
// returns both, and nothing else needs to be called to get them — the list
// endpoint has no UUID at all (docs/API-GAPS.md §A1), so populating a picker
// from it costs a fan-out of lookups to recover ids this one hands over
// directly.

import { useEffect, useState } from "react";
import { Button, Field, Input } from "./ui";
import { lookupClassLevels } from "@/lib/classes";
import { formatEnumLabel } from "@/lib/utils";
import type { ApiError, ClassLevelLookUpResponse } from "@/lib/types";

const LOOKUP_DEBOUNCE_MS = 300;

type Props = {
  inputId: string;
  selected: ClassLevelLookUpResponse | null;
  onSelect: (classLevel: ClassLevelLookUpResponse | null) => void;
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
};

export function classLevelLabel(level: ClassLevelLookUpResponse): string {
  return level.className?.trim() || `Class #${level.classLevelId}`;
}

// "BAS1 · Lower primary", the two things that tell one class from another when
// several have similar names.
function classLevelDetail(level: ClassLevelLookUpResponse): string {
  return [level.code, level.classType ? formatEnumLabel(level.classType) : null]
    .filter(Boolean)
    .join(" · ");
}

export function ClassLevelLookup({
  inputId,
  selected,
  onSelect,
  error,
  label = "Class",
  hint = "Search by class name or code.",
  required = false,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClassLevelLookUpResponse[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSearchError(null);
    if (value.trim().length < 1) {
      setResults([]);
      setSearched(false);
      setSearching(false);
    }
  }

  useEffect(() => {
    // One character is enough here, unlike the people lookups: class names are
    // short and a school has a dozen of them, so "1" is a useful search.
    const q = query.trim();
    if (q.length < 1) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const found = await lookupClassLevels(q, controller.signal);
        setResults(found);
        setSearched(true);
      } catch (err) {
        if (!controller.signal.aborted) {
          setResults([]);
          setSearched(true);
          setSearchError(
            (err as ApiError).message ?? "Could not search classes.",
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
    const detail = classLevelDetail(selected);
    return (
      <Field label={label} htmlFor={inputId} required={required} error={error}>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {classLevelLabel(selected)}
            </p>
            {detail ? (
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {detail}
              </p>
            ) : null}
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
          placeholder="e.g. Basic 1, KG2"
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
            No classes matched your search.
          </p>
        ) : results.length > 0 ? (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {results.map((level) => {
              const detail = classLevelDetail(level);
              return (
                <li key={level.classLevelPublicId ?? level.classLevelId}>
                  <button
                    type="button"
                    onClick={() => onSelect(level)}
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {classLevelLabel(level)}
                    </span>
                    {detail ? (
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {detail}
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </Field>
  );
}
