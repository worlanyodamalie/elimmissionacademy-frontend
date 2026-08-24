// Typed wrappers over the academic year and term endpoints, plus the merge
// that makes terms usable as pickers elsewhere in the app.
//
// The backend splits a term's identity across two responses, and neither is
// complete on its own:
//
//   GET /academics/years  -> AcademicYearTermSummary: numeric `academicTermId`,
//                            but no UUID.
//   GET /academics/terms  -> AcademicTermResponse: the term's `publicId`, but
//                            no numeric term id.
//
// Both identifiers are live: creating a bill takes the numeric `academicTermId`,
// while editing a term's dates takes the `publicId` in the path. So
// `loadAcademics` fetches both and joins them into a single record carrying
// every identifier the UI might need (see docs/API-GAPS.md §1 and §6).

import { apiRequest } from "./api";
import { ACADEMICS } from "./endpoints";
import { formatEnumLabel } from "./utils";
import type {
  AcademicTermResponse,
  AcademicYearRequest,
  AcademicYearResponse,
  PageResponse,
  Term,
  UpdateTermRequest,
} from "./types";

export type PageParams = {
  page?: number;
  size?: number;
  // Spring syntax, e.g. "startDate,desc".
  sort?: string | string[];
};

type Query = Record<string, string | string[] | undefined>;

function pageQuery({ page, size, sort }: PageParams = {}): Query {
  return {
    page: page === undefined ? undefined : String(page),
    size: size === undefined ? undefined : String(size),
    sort,
  };
}

// Some list endpoints answer with a bare array rather than a page wrapper;
// normalize so callers only handle one shape.
function toPage<T>(data: PageResponse<T> | T[] | null): PageResponse<T> {
  if (Array.isArray(data)) {
    return {
      content: data,
      totalElements: data.length,
      totalPages: 1,
      number: 0,
      size: data.length,
    };
  }
  if (!data) {
    return { content: [], totalElements: 0, totalPages: 1, number: 0, size: 0 };
  }
  return { ...data, content: data.content ?? [] };
}

// One request is enough for any school's worth of years or terms.
const ALL = { page: 0, size: 100 } as const;

// --- Academic years -------------------------------------------------------

export async function listAcademicYears(
  params: PageParams = ALL,
  signal?: AbortSignal,
): Promise<PageResponse<AcademicYearResponse>> {
  return toPage(
    await apiRequest<PageResponse<AcademicYearResponse> | AcademicYearResponse[]>(
      ACADEMICS.years,
      { query: pageQuery(params), signal },
    ),
  );
}

export function getAcademicYear(
  yearPublicId: string,
  signal?: AbortSignal,
): Promise<AcademicYearResponse> {
  return apiRequest<AcademicYearResponse>(ACADEMICS.year(yearPublicId), {
    signal,
  });
}

export function createAcademicYear(
  body: AcademicYearRequest,
  signal?: AbortSignal,
): Promise<AcademicYearResponse> {
  return apiRequest<AcademicYearResponse>(ACADEMICS.years, {
    method: "POST",
    body,
    signal,
  });
}

// --- Academic terms -------------------------------------------------------

export async function listAcademicTerms(
  params: PageParams = ALL,
  signal?: AbortSignal,
): Promise<PageResponse<AcademicTermResponse>> {
  return toPage(
    await apiRequest<PageResponse<AcademicTermResponse> | AcademicTermResponse[]>(
      ACADEMICS.terms,
      { query: pageQuery(params), signal },
    ),
  );
}

export function getAcademicTerm(
  termPublicId: string,
  signal?: AbortSignal,
): Promise<AcademicTermResponse> {
  return apiRequest<AcademicTermResponse>(ACADEMICS.term(termPublicId), {
    signal,
  });
}

// Terms can't be created from the client — the backend generates a year's three
// terms when the year itself is created, and `POST /academics/terms` answers 405
// (docs/API-GAPS.md §8). Adjusting the dates is the only write available.
//
// The path param is the term's `publicId`, despite Swagger naming it
// `academicTermId`; passing the numeric id 404s.
export function updateAcademicTerm(
  termPublicId: string,
  body: UpdateTermRequest,
  signal?: AbortSignal,
): Promise<AcademicTermResponse> {
  return apiRequest<AcademicTermResponse>(ACADEMICS.term(termPublicId), {
    method: "PUT",
    body,
    signal,
  });
}

// --- Labels and ordering --------------------------------------------------

export const TERM_OPTIONS: { value: Term; label: string }[] = [
  { value: "FIRST_TERM", label: "First term" },
  { value: "SECOND_TERM", label: "Second term" },
  { value: "THIRD_TERM", label: "Third term" },
];

export function termLabel(term: Term | string): string {
  return (
    TERM_OPTIONS.find((t) => t.value === term)?.label ?? formatEnumLabel(term)
  );
}

// --- The merged view ------------------------------------------------------

// A term with every identifier the API might ask for. Both id fields are
// optional because each comes from a different endpoint: if one of the two
// calls fails, the records still carry whatever the other returned.
export type AcademicTermRecord = {
  // From GET /academics/terms. Editing a term's dates and the carry-forward
  // body both take it.
  publicId?: string;
  // From the term summaries on GET /academics/years. Bill creation takes it.
  academicTermId?: number;
  academicYearName: string;
  termNumber: Term;
  startDate: string;
  endDate: string;
  // "2026/2027 · First term"
  label: string;
  // Today falls inside [startDate, endDate].
  isCurrent: boolean;
};

// A school has at most one of each term per year, so year name + term number
// identifies a term across both responses.
function joinKey(yearName: string, term: Term | string): string {
  return `${yearName.trim().toLowerCase()}|${term}`;
}

function coversToday(startDate: string, endDate: string): boolean {
  if (!startDate || !endDate) return false;
  // Compare as plain YYYY-MM-DD strings: the API sends dates without a zone,
  // so parsing them into Date would shift the boundaries by the local offset.
  const today = new Date();
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return startDate <= iso && iso <= endDate;
}

const TERM_ORDER: Term[] = ["FIRST_TERM", "SECOND_TERM", "THIRD_TERM"];

// Most recent first — the term someone is billing for is nearly always the
// newest one.
function byRecencyDesc(a: AcademicTermRecord, b: AcademicTermRecord): number {
  if (a.startDate && b.startDate && a.startDate !== b.startDate) {
    return a.startDate < b.startDate ? 1 : -1;
  }
  return TERM_ORDER.indexOf(b.termNumber) - TERM_ORDER.indexOf(a.termNumber);
}

export type AcademicsSnapshot = {
  years: AcademicYearResponse[];
  terms: AcademicTermRecord[];
};

// Fetches both endpoints and joins them. A failure in either call is tolerated
// as long as the other succeeds — the records are simply missing that call's
// identifier, and callers filter on the id they need.
export async function loadAcademics(
  signal?: AbortSignal,
): Promise<AcademicsSnapshot> {
  const [yearsResult, termsResult] = await Promise.allSettled([
    listAcademicYears(ALL, signal),
    listAcademicTerms(ALL, signal),
  ]);

  if (yearsResult.status === "rejected" && termsResult.status === "rejected") {
    throw yearsResult.reason;
  }

  const byKey = new Map<string, AcademicTermRecord>();

  if (termsResult.status === "fulfilled") {
    for (const term of termsResult.value.content) {
      const yearName = term.academicYearName ?? "";
      byKey.set(joinKey(yearName, term.termNumber), {
        publicId: term.publicId,
        academicYearName: yearName,
        termNumber: term.termNumber,
        startDate: term.startDate,
        endDate: term.endDate,
        label: `${yearName} · ${termLabel(term.termNumber)}`,
        isCurrent: coversToday(term.startDate, term.endDate),
      });
    }
  }

  if (yearsResult.status === "fulfilled") {
    for (const year of yearsResult.value.content) {
      for (const summary of year.academicTerms ?? []) {
        const key = joinKey(year.name, summary.termNumber);
        const existing = byKey.get(key);
        if (existing) {
          existing.academicTermId = summary.academicTermId;
          // The year list is the authority on the year's own name and, where
          // the terms call didn't run, on the dates.
          existing.startDate ||= summary.startDate;
          existing.endDate ||= summary.endDate;
          existing.isCurrent = coversToday(existing.startDate, existing.endDate);
        } else {
          byKey.set(key, {
            academicTermId: summary.academicTermId,
            academicYearName: year.name,
            termNumber: summary.termNumber,
            startDate: summary.startDate,
            endDate: summary.endDate,
            label: `${year.name} · ${termLabel(summary.termNumber)}`,
            isCurrent: coversToday(summary.startDate, summary.endDate),
          });
        }
      }
    }
  }

  return {
    years: yearsResult.status === "fulfilled" ? yearsResult.value.content : [],
    terms: [...byKey.values()].sort(byRecencyDesc),
  };
}
