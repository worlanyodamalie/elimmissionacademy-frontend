// Typed wrappers over the Academic Management endpoints: the class levels a
// school teaches, the streams inside them, and student enrolments.
//
// Same two-identifier problem as the academic calendar, in a sharper form:
//
//   GET  /academics/class_levels         -> an untyped `Page`; assumed to hold
//                                           `ClassLevelResponse`, which has a
//                                           numeric `classLevelId` and no UUID.
//   GET  /academics/class_levels/lookup  -> ClassLevelLookUpResponse: both the
//                                           numeric id and `classLevelPublicId`.
//   GET  /academics/class_levels/{uuid}  -> keyed by the UUID.
//
// So the list alone cannot link to a class level's own page. `loadClassLevels`
// lists the classes and then recovers their UUIDs from the lookup, joining on
// the numeric id (docs/API-GAPS.md §A1).

import { apiRequest } from "./api";
import { CLASSES } from "./endpoints";
import type { PageParams } from "./academics";
import { formatEnumLabel } from "./utils";
import type {
  ClassLevelLookUpResponse,
  ClassLevelRequest,
  ClassLevelResponse,
  ClassLevelStudentsGroupedResponse,
  ClassType,
  EnrolmentStatus,
  EnrolmentType,
  PageResponse,
  StandardGESClassLevel,
  StudentEnrolmentRequest,
  StudentEnrolmentResponse,
} from "./types";

type Query = Record<string, string | string[] | undefined>;

function pageQuery({ page, size, sort }: PageParams = {}): Query {
  return {
    page: page === undefined ? undefined : String(page),
    size: size === undefined ? undefined : String(size),
    sort,
  };
}

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

// A school teaches at most thirteen GES levels, so one page holds them all.
const ALL = { page: 0, size: 100 } as const;

// --- Class levels ---------------------------------------------------------

export async function listClassLevels(
  params: PageParams = ALL,
  signal?: AbortSignal,
): Promise<PageResponse<ClassLevelResponse>> {
  return toPage(
    await apiRequest<PageResponse<ClassLevelResponse> | ClassLevelResponse[]>(
      CLASSES.classLevels,
      { query: pageQuery(params), signal },
    ),
  );
}

// `query` is a required request param, so there is no "list everything" call
// here — a blank search is answered locally rather than with a guaranteed 400.
export async function lookupClassLevels(
  query: string,
  signal?: AbortSignal,
): Promise<ClassLevelLookUpResponse[]> {
  if (!query.trim()) return [];
  const data = await apiRequest<
    ClassLevelLookUpResponse[] | PageResponse<ClassLevelLookUpResponse> | null
  >(CLASSES.classLevelsLookup, { query: { query }, signal });
  if (!data) return [];
  return Array.isArray(data) ? data : (data.content ?? []);
}

export function getClassLevel(
  classLevelPublicId: string,
  signal?: AbortSignal,
): Promise<ClassLevelResponse> {
  return apiRequest<ClassLevelResponse>(
    CLASSES.classLevel(classLevelPublicId),
    { signal },
  );
}

export function createClassLevel(
  body: ClassLevelRequest,
  signal?: AbortSignal,
): Promise<ClassLevelResponse> {
  return apiRequest<ClassLevelResponse>(CLASSES.classLevels, {
    method: "POST",
    body,
    signal,
  });
}

export function getClassLevelStudents(
  classLevelPublicId: string,
  signal?: AbortSignal,
): Promise<ClassLevelStudentsGroupedResponse> {
  return apiRequest<ClassLevelStudentsGroupedResponse>(
    CLASSES.classLevelStudents(classLevelPublicId),
    { signal },
  );
}

// --- Enrolments -----------------------------------------------------------

// The backend chooses the stream (by priority rank, skipping full ones) and
// resolves which term inside the year the enrolment lands in.
export function enrolStudent(
  body: StudentEnrolmentRequest,
  signal?: AbortSignal,
): Promise<StudentEnrolmentResponse> {
  return apiRequest<StudentEnrolmentResponse>(CLASSES.enrolments, {
    method: "POST",
    body,
    signal,
  });
}

// The student's *active* enrolment. 404 means they have never been enrolled,
// or their last enrolment ended — both are ordinary states, not errors, so
// callers usually want `getStudentEnrolmentOrNull`.
export function getStudentEnrolment(
  studentPublicId: string,
  signal?: AbortSignal,
): Promise<StudentEnrolmentResponse> {
  return apiRequest<StudentEnrolmentResponse>(
    CLASSES.studentEnrolment(studentPublicId),
    { signal },
  );
}

export async function getStudentEnrolmentOrNull(
  studentPublicId: string,
  signal?: AbortSignal,
): Promise<StudentEnrolmentResponse | null> {
  try {
    return await getStudentEnrolment(studentPublicId, signal);
  } catch (err) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

// --- The merged class-level view ------------------------------------------

// A class level carrying both identifiers: the numeric one an enrolment body
// takes, and the UUID its own pages are keyed by.
export type ClassLevelRecord = ClassLevelResponse & {
  // From the lookup. Absent if that call failed or didn't return this class,
  // in which case the class can be listed but not opened.
  classLevelPublicId?: string;
};

// Lowest level first — how a school lists its classes.
function byAcademicLevel(a: ClassLevelRecord, b: ClassLevelRecord): number {
  return (a.academicLevel ?? 0) - (b.academicLevel ?? 0);
}

// A UUID carried on a list row, if the row happens to have one.
//
// `GET /class_levels` declares its 200 as the *generic* `Page`, whose `content`
// is an untyped `array of object` — the spec never says which DTO comes back.
// `ClassLevelResponse` (what `POST` returns) has no UUID, so the assumption
// below is that the list rows match it. That assumption is unverified, so
// rather than bet on it we read a UUID off the row when one is there under
// either spelling, and only pay for the lookup on rows that need it. If the
// backend already sends it, or starts to, the fan-out disappears by itself.
function publicIdOnRow(level: ClassLevelResponse): string | undefined {
  const row = level as ClassLevelResponse & {
    classLevelPublicId?: unknown;
    publicId?: unknown;
  };
  const candidate = row.classLevelPublicId ?? row.publicId;
  return typeof candidate === "string" && candidate ? candidate : undefined;
}

// Lists the class levels, then recovers any missing UUIDs from the lookup.
//
// The lookup is the only response the spec documents as pairing the numeric id
// with the UUID, and it insists on a search term, so there is no single call
// that returns them all. Searching for each distinct class name covers the list
// exactly, and a school has at most thirteen of them. Results are joined on the
// numeric id, so a search that happens to match several classes is still placed
// correctly.
//
// A failing lookup is tolerated: the classes still render, they just can't be
// opened. See docs/API-GAPS.md §A1 for the ask.
export async function loadClassLevels(
  signal?: AbortSignal,
): Promise<ClassLevelRecord[]> {
  const list = await listClassLevels(ALL, signal);

  const publicIds = new Map<number, string>();
  for (const level of list.content) {
    const onRow = publicIdOnRow(level);
    if (onRow) publicIds.set(level.classLevelId, onRow);
  }

  // Only the rows the list didn't already identify.
  const names = [
    ...new Set(
      list.content
        .filter((l) => !publicIds.has(l.classLevelId))
        .map((l) => l.className?.trim())
        .filter(Boolean),
    ),
  ] as string[];

  if (names.length > 0) {
    const lookups = await Promise.allSettled(
      names.map((name) => lookupClassLevels(name, signal)),
    );
    for (const result of lookups) {
      if (result.status !== "fulfilled") continue;
      for (const entry of result.value) {
        if (entry.classLevelId !== undefined && entry.classLevelPublicId) {
          publicIds.set(entry.classLevelId, entry.classLevelPublicId);
        }
      }
    }
  }

  return list.content
    .map((level) => ({
      ...level,
      classLevelPublicId: publicIds.get(level.classLevelId),
    }))
    .sort(byAcademicLevel);
}

// --- Labels and options ---------------------------------------------------

// In GES order, which is also the order the backend's `academicLevel` follows.
export const GES_CLASS_LEVELS: {
  value: StandardGESClassLevel;
  label: string;
}[] = [
  { value: "NURSERY_1", label: "Nursery 1" },
  { value: "NURSERY_2", label: "Nursery 2" },
  { value: "KINDERGARTEN_1", label: "Kindergarten 1" },
  { value: "KINDERGARTEN_2", label: "Kindergarten 2" },
  { value: "BASIC_1", label: "Basic 1" },
  { value: "BASIC_2", label: "Basic 2" },
  { value: "BASIC_3", label: "Basic 3" },
  { value: "BASIC_4", label: "Basic 4" },
  { value: "BASIC_5", label: "Basic 5" },
  { value: "BASIC_6", label: "Basic 6" },
  { value: "BASIC_7", label: "Basic 7 (JHS 1)" },
  { value: "BASIC_8", label: "Basic 8 (JHS 2)" },
  { value: "BASIC_9", label: "Basic 9 (JHS 3)" },
];

export function gesClassLevelLabel(value: StandardGESClassLevel | string): string {
  return (
    GES_CLASS_LEVELS.find((l) => l.value === value)?.label ??
    formatEnumLabel(value)
  );
}

export function classTypeLabel(value: ClassType | string): string {
  return formatEnumLabel(value);
}

export const ENROLMENT_TYPES: { value: EnrolmentType; label: string; hint: string }[] =
  [
    {
      value: "NEW_ADMISSION",
      label: "New admission",
      hint: "First time at this school.",
    },
    {
      value: "PROMOTION",
      label: "Promotion",
      hint: "Moving up from the class below.",
    },
    {
      value: "TRANSFER_IN",
      label: "Transfer in",
      hint: "Arriving from another school.",
    },
    {
      value: "RE_ADMISSION",
      label: "Re-admission",
      hint: "Returning after leaving.",
    },
  ];

export function enrolmentTypeLabel(value: EnrolmentType | string): string {
  return (
    ENROLMENT_TYPES.find((t) => t.value === value)?.label ??
    formatEnumLabel(value)
  );
}

export function enrolmentStatusVariant(
  status: EnrolmentStatus | string | undefined,
): "neutral" | "success" | "warning" | "info" | "danger" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "COMPLETED":
    case "GRADUATED":
      return "info";
    case "SUSPENDED":
      return "warning";
    case "WITHDRAWN":
    case "TRANSFERRED":
      return "danger";
    default:
      return "neutral";
  }
}
