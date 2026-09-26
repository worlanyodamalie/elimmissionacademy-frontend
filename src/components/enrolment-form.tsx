"use client";

// Puts a student in a class for an academic year. This is the step that follows
// student onboarding: `POST /auth/users/students` creates the person, this
// creates their place in the school.
//
// The form asks for a class level, not a stream — the backend picks the stream
// itself, filling them in priority order and skipping any that are full.

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Field, Select, Textarea } from "./ui";
import { FormError, focusFirstError, useFormError } from "./form-error";
import { DateInput } from "./date-input";
import { StudentLookup } from "./student-lookup";
import { useToast } from "./toast";
import { academicYearOptions } from "@/lib/academics";
import {
  ENROLMENT_TYPES,
  enrolStudent,
  enrolmentStatusVariant,
  getStudentEnrolmentOrNull,
} from "@/lib/classes";
import { useAcademicTerms } from "@/lib/use-academic-terms";
import { useClassLevels } from "@/lib/use-class-levels";
import { formatDate, formatEnumLabel, todayIso } from "@/lib/utils";
import type {
  ApiError,
  EnrolmentType,
  StudentEnrolmentRequest,
  StudentEnrolmentResponse,
  StudentSearchResult,
} from "@/lib/types";

type Props = {
  // Pre-fills the student search — the name of the student who was just
  // onboarded, handed over through the URL.
  initialStudentQuery?: string;
  onEnrolled?: (enrolment: StudentEnrolmentResponse) => void;
};

type Errors = {
  student?: string;
  classLevelId?: string;
  academicYearId?: string;
  enrolmentDate?: string;
};

export function EnrolmentForm({ initialStudentQuery = "", onEnrolled }: Props) {
  const { toast } = useToast();
  const { terms, years, loading: academicsLoading, error: academicsError } =
    useAcademicTerms();
  const {
    classLevels,
    loading: classesLoading,
    error: classesError,
  } = useClassLevels();

  const yearOptions = academicYearOptions({ years, terms });

  const [student, setStudent] = useState<StudentSearchResult | null>(null);
  const [classLevelId, setClassLevelId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [enrolmentType, setEnrolmentType] =
    useState<EnrolmentType>("NEW_ADMISSION");
  const [enrolmentDate, setEnrolmentDate] = useState(todayIso());
  const [remarks, setRemarks] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const { error, errorNonce, setError } = useFormError();
  const [result, setResult] = useState<StudentEnrolmentResponse | null>(null);

  // The enrolment the student already has, if any. A second POST for a student
  // who is already enrolled answers 409, so it's worth saying so up front.
  // Keyed by the student it describes so the result of a stale check is never
  // shown against a different student, and so "still checking" is derived
  // rather than tracked in its own state.
  const [enrolmentCheck, setEnrolmentCheck] = useState<{
    forStudent: string;
    enrolment: StudentEnrolmentResponse | null;
  } | null>(null);

  // The year today falls inside is the one an admin nearly always wants, so it
  // stands in until they pick another. Derived rather than written into state
  // by an effect, which would cascade a render.
  const currentYearId = yearOptions.find((y) => y.isCurrent)?.academicYearId;
  const selectedYearId =
    academicYearId ||
    (currentYearId !== undefined ? String(currentYearId) : "");

  const studentPublicId = student?.profilePublicId;
  const checked = studentPublicId && enrolmentCheck?.forStudent === studentPublicId;
  const existing = checked ? enrolmentCheck.enrolment : null;
  const checkingExisting = !!studentPublicId && !checked;

  useEffect(() => {
    if (!studentPublicId) return;
    const controller = new AbortController();
    getStudentEnrolmentOrNull(studentPublicId, controller.signal)
      .then((enrolment) => {
        if (!controller.signal.aborted) {
          setEnrolmentCheck({ forStudent: studentPublicId, enrolment });
        }
      })
      .catch(() => {
        // A failed check is not worth blocking on: the POST is the authority,
        // and it answers 409 if the student is already placed.
        if (!controller.signal.aborted) {
          setEnrolmentCheck({ forStudent: studentPublicId, enrolment: null });
        }
      });
    return () => controller.abort();
  }, [studentPublicId]);

  function resetForAnother() {
    setResult(null);
    setStudent(null);
    setRemarks("");
    setErrors({});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: Errors = {};
    if (!student) errs.student = "Search for and select a student.";
    if (!classLevelId) errs.classLevelId = "Choose a class.";
    if (!selectedYearId) errs.academicYearId = "Choose an academic year.";
    if (!enrolmentDate) errs.enrolmentDate = "Enrolment date is required.";
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) {
      focusFirstError(errs, {
        student: "enrol-student",
        classLevelId: "enrol-class",
        academicYearId: "enrol-year",
        enrolmentDate: "enrol-date",
      });
      return;
    }

    setSubmitting(true);
    try {
      const body: StudentEnrolmentRequest = {
        studentId: student!.profileId,
        classLevelId: Number(classLevelId),
        academicYearId: Number(selectedYearId),
        enrolmentType,
        enrolmentDate,
        remarks: remarks.trim() || undefined,
      };
      const enrolment = await enrolStudent(body);
      toast({
        title: "Student enrolled",
        description: `${enrolment.studentFullName ?? "The student"} is in ${
          enrolment.classStreamFullName ?? enrolment.className
        }.`,
        variant: "success",
      });
      setResult(enrolment);
      onEnrolled?.(enrolment);
    } catch (err) {
      const apiErr = err as ApiError;
      // 409 is the common one: already enrolled for this year, or every stream
      // in the class is full. The backend's own message says which.
      setError(apiErr.message?.trim() || "Could not enrol the student.");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <Card>
        <div className="flex flex-col gap-4">
          <Alert variant="success" title="Enrolled">
            {result.studentFullName} has been placed in{" "}
            {result.classStreamFullName ?? result.className} for{" "}
            {result.academicYearName}
            {result.academicTermName ? ` (${result.academicTermName})` : ""}.
          </Alert>
          <EnrolmentSummary enrolment={result} />
          <div className="flex justify-end">
            <Button variant="secondary" onClick={resetForAnother}>
              Enrol another student
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const loadError = academicsError ?? classesError;
  const noYears = !academicsLoading && yearOptions.length === 0;
  const noClasses = !classesLoading && classLevels.length === 0;

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {loadError ? (
          <Alert variant="error" title="Could not load the form">
            {loadError}
          </Alert>
        ) : null}
        {noYears ? (
          <Alert variant="warning" title="No academic year to enrol into">
            Create an academic year first — enrolment is always for a specific
            year, and its terms supply the id this form needs.
          </Alert>
        ) : null}
        {noClasses ? (
          <Alert variant="warning" title="No classes yet">
            Add the school&apos;s class levels before enrolling anyone.
          </Alert>
        ) : null}

        <StudentLookup
          inputId="enrol-student"
          selected={student}
          onSelect={setStudent}
          error={errors.student}
          required
          initialQuery={initialStudentQuery}
          autoSelectSingleMatch
        />

        {checkingExisting ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Checking current enrolment…
          </p>
        ) : existing ? (
          <Alert variant="info" title="Already enrolled">
            <div className="flex flex-col gap-2">
              <p>
                {existing.studentFullName} is in{" "}
                {existing.classStreamFullName ?? existing.className} for{" "}
                {existing.academicYearName}. Enrolling again for the same year
                will be rejected.
              </p>
              <EnrolmentSummary enrolment={existing} />
            </div>
          </Alert>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Class"
            htmlFor="enrol-class"
            required
            error={errors.classLevelId}
            hint="The stream is chosen for you — the first one with room."
          >
            <Select
              id="enrol-class"
              value={classLevelId}
              onChange={(e) => setClassLevelId(e.target.value)}
              disabled={classesLoading || noClasses}
              invalid={!!errors.classLevelId}
              required
            >
              <option value="">
                {classesLoading ? "Loading classes…" : "Select a class"}
              </option>
              {classLevels.map((level) => (
                <option key={level.classLevelId} value={level.classLevelId}>
                  {level.className}
                  {level.code ? ` (${level.code})` : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Academic year"
            htmlFor="enrol-year"
            required
            error={errors.academicYearId}
            hint="The term inside the year is resolved by the school system."
          >
            <Select
              id="enrol-year"
              value={selectedYearId}
              onChange={(e) => setAcademicYearId(e.target.value)}
              disabled={academicsLoading || noYears}
              invalid={!!errors.academicYearId}
              required
            >
              <option value="">
                {academicsLoading ? "Loading years…" : "Select a year"}
              </option>
              {yearOptions.map((year) => (
                <option key={year.academicYearId} value={year.academicYearId}>
                  {year.name}
                  {year.isCurrent ? " — current" : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Enrolment type" htmlFor="enrol-type" required>
            <Select
              id="enrol-type"
              value={enrolmentType}
              onChange={(e) =>
                setEnrolmentType(e.target.value as EnrolmentType)
              }
              required
            >
              {ENROLMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Enrolment date"
            htmlFor="enrol-date"
            required
            error={errors.enrolmentDate}
          >
            <DateInput
              id="enrol-date"
              value={enrolmentDate}
              onChange={setEnrolmentDate}
              required
              invalid={!!errors.enrolmentDate}
            />
          </Field>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {ENROLMENT_TYPES.find((t) => t.value === enrolmentType)?.hint}
        </p>

        <Field
          label="Remarks"
          htmlFor="enrol-remarks"
          hint="Optional. Anything the class teacher should know about the placement."
        >
          <Textarea
            id="enrol-remarks"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={2000}
            placeholder="e.g. Placed in the morning stream at the parents' request."
          />
        </Field>

        <FormError error={error} nonce={errorNonce} title="Could not enrol" />

        <div className="flex justify-end">
          <Button type="submit" loading={submitting} disabled={noYears || noClasses}>
            {submitting ? "Enrolling…" : "Enrol student"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

export function EnrolmentSummary({
  enrolment,
}: {
  enrolment: StudentEnrolmentResponse;
}) {
  const rows: { label: string; value: string }[] = [
    { label: "Class", value: enrolment.classStreamFullName || enrolment.className },
    { label: "Academic year", value: enrolment.academicYearName },
    { label: "Term", value: enrolment.academicTermName },
    { label: "Enrolled", value: formatDate(enrolment.enrolmentDate) },
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
      {rows.map((row) =>
        row.value ? (
          <div key={row.label} className="min-w-0">
            <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {row.label}
            </dt>
            <dd className="truncate font-medium text-zinc-900 dark:text-zinc-100">
              {row.value}
            </dd>
          </div>
        ) : null,
      )}
      {enrolment.status ? (
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Status
          </dt>
          <dd className="mt-0.5">
            <Badge variant={enrolmentStatusVariant(enrolment.status)}>
              {formatEnumLabel(enrolment.status)}
            </Badge>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
