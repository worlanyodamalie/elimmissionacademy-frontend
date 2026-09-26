"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { EnrolmentForm } from "@/components/enrolment-form";
import { ChevronRightIcon } from "@/components/icons";
import { ROUTES } from "@/lib/endpoints";

export default function EnrolmentsPage() {
  return (
    <Suspense fallback={null}>
      <EnrolmentsPageInner />
    </Suspense>
  );
}

function EnrolmentsPageInner() {
  const params = useSearchParams();
  // Set by student onboarding when it hands over: the new student's name, so
  // the search below lands on them without anyone retyping it.
  const studentQuery = (params.get("student") ?? "").trim();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Enrol a student"
        description="Place a student in a class for an academic year. The stream is assigned for you — the first one with room, in fill order."
      />

      {studentQuery ? (
        <Card>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Continuing from onboarding —{" "}
            <span className="font-medium text-zinc-900 dark:text-zinc-100">
              {studentQuery}
            </span>{" "}
            was just added. Confirm the student below and choose their class.
          </p>
        </Card>
      ) : null}

      <EnrolmentForm initialStudentQuery={studentQuery} />

      <Card>
        <ul className="flex flex-col gap-3 text-sm">
          <li>
            <Link
              href={ROUTES.classes}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Classes and streams
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Add a class level, or see who is already in one.
            </p>
          </li>
          <li>
            <Link
              href={ROUTES.academics}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Academic years and terms
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Enrolment is always for a year; its terms decide which one the
              placement falls in.
            </p>
          </li>
          <li>
            <Link
              href={ROUTES.newStudent}
              className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              Onboard another student
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </li>
        </ul>
      </Card>
    </div>
  );
}
