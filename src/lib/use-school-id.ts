"use client";

import { useEffect, useState } from "react";
import { listAcademicTerms } from "./academics";
import { useAuth } from "./auth-context";
import { listServiceCosts, listStudentBills } from "./billing";
import { listClassLevels } from "./classes";

export type UseSchoolId = {
  // The numeric id `OpenSessionRequest` and `PaymentRequest` take.
  schoolId: number | undefined;
  // True until the token or a list call has answered.
  resolving: boolean;
};

// The sign-in token doesn't always carry `schoolId`, and the one endpoint
// named for it — `GET /auth/school/{schoolId}/profile` — wants the school's
// UUID, which nothing hands the client either. But every tenant-scoped
// response does carry the numeric `schoolId`, so the first row of any list
// answers it. These are tried in order, cheapest and most likely populated
// first; a brand-new school with none of them still gets `undefined`, and the
// caller falls back to asking.
const SOURCES: Array<
  (signal: AbortSignal) => Promise<{ content: Array<{ schoolId?: number }> }>
> = [
  (signal) => listClassLevels({ page: 0, size: 1 }, signal),
  (signal) => listAcademicTerms({ page: 0, size: 1 }, signal),
  (signal) => listServiceCosts({ page: 0, size: 1 }, signal),
  (signal) => listStudentBills({ page: 0, size: 1 }, signal),
];

async function findSchoolId(signal: AbortSignal): Promise<number | undefined> {
  for (const source of SOURCES) {
    if (signal.aborted) return undefined;
    try {
      const page = await source(signal);
      const id = page.content.find((row) => typeof row.schoolId === "number")
        ?.schoolId;
      if (id !== undefined) return id;
    } catch {
      // An empty list can answer 404 and a role may lack access to one of
      // these; either way, move on to the next source.
    }
  }
  return undefined;
}

// Per school code, so two forms on one page — and later visits — share one
// lookup. Only hits are kept: a school that had no data a moment ago may have
// some now.
const resolved = new Map<string, number>();

export function useSchoolId(): UseSchoolId {
  const { session } = useAuth();
  const fromToken = session?.user?.schoolId;
  const schoolCode = session?.schoolCode ?? "";
  const cached = resolved.get(schoolCode);

  const [found, setFound] = useState<{
    code: string;
    id: number | undefined;
  } | null>(null);

  const known = fromToken ?? cached;

  useEffect(() => {
    if (known !== undefined) return;
    const controller = new AbortController();
    findSchoolId(controller.signal).then((id) => {
      if (controller.signal.aborted) return;
      if (id !== undefined) resolved.set(schoolCode, id);
      setFound({ code: schoolCode, id });
    });
    return () => controller.abort();
  }, [known, schoolCode]);

  if (known !== undefined) return { schoolId: known, resolving: false };
  const answered = found?.code === schoolCode;
  return {
    schoolId: answered ? found.id : undefined,
    resolving: !answered,
  };
}
