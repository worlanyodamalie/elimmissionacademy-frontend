"use client";

import { useEffect, useState } from "react";
import { loadAcademics, type AcademicTermRecord } from "./academics";
import type { AcademicYearResponse } from "./types";

export type UseAcademicTerms = {
  terms: AcademicTermRecord[];
  // The years the terms belong to, from the same fetch.
  years: AcademicYearResponse[];
  // The term today falls inside, if any — what a term picker should preselect.
  currentTerm: AcademicTermRecord | null;
  loading: boolean;
  error: string | null;
};

// Loads every term once, joined across both academic endpoints. Shared by the
// billing screens (which need a term on almost every form) and the academics
// page (which needs the years' numeric ids that only the terms call returns).
export function useAcademicTerms(reloadKey: number = 0): UseAcademicTerms {
  const [terms, setTerms] = useState<AcademicTermRecord[]>([]);
  const [years, setYears] = useState<AcademicYearResponse[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Deriving "loading" from which fetch has landed keeps the effect free of
  // synchronous setState, which React flags as a cascading render.
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const loading = loadedKey !== reloadKey;

  useEffect(() => {
    const controller = new AbortController();
    loadAcademics(controller.signal)
      .then((snapshot) => {
        if (controller.signal.aborted) return;
        setTerms(snapshot.terms);
        setYears(snapshot.years);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          (err as { message?: string }).message ??
            "Could not load academic terms.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(reloadKey);
      });
    return () => controller.abort();
  }, [reloadKey]);

  return {
    terms,
    years,
    currentTerm: terms.find((t) => t.isCurrent) ?? null,
    loading,
    error,
  };
}
