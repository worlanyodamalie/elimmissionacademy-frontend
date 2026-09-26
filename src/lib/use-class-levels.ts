"use client";

import { useEffect, useState } from "react";
import { loadClassLevels, type ClassLevelRecord } from "./classes";

export type UseClassLevels = {
  classLevels: ClassLevelRecord[];
  loading: boolean;
  error: string | null;
};

// Loads the school's class levels once, with each one's UUID recovered from the
// lookup. Shared by the classes hub and the enrolment form, which needs the
// numeric ids the enrolment body takes.
export function useClassLevels(reloadKey: number = 0): UseClassLevels {
  const [classLevels, setClassLevels] = useState<ClassLevelRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  // Deriving "loading" from which fetch has landed keeps the effect free of
  // synchronous setState, matching `useAcademicTerms`.
  const [loadedKey, setLoadedKey] = useState<number | null>(null);
  const loading = loadedKey !== reloadKey;

  useEffect(() => {
    const controller = new AbortController();
    loadClassLevels(controller.signal)
      .then((levels) => {
        if (controller.signal.aborted) return;
        setClassLevels(levels);
        setError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setError(
          (err as { message?: string }).message ?? "Could not load classes.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedKey(reloadKey);
      });
    return () => controller.abort();
  }, [reloadKey]);

  return { classLevels, loading, error };
}
