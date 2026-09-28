"use client";

import { useEffect, useState } from "react";
import { loadClassLevels, type ClassLevelRecord } from "./classes";

export type UseClassLevels = {
  classLevels: ClassLevelRecord[];
  loading: boolean;
  error: string | null;
};

// Loads the school's class levels once, with each one's UUID recovered from the
// lookup.
//
// Only the classes hub needs this: it renders every class with its streams
// (which the list carries and the lookup doesn't) *and* links to each one's
// roster (which needs the UUID the list doesn't carry). Anything that just
// needs to name a class — the enrolment form — should use `ClassLevelSelect`,
// which makes the single lookup call and skips the list entirely.
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
