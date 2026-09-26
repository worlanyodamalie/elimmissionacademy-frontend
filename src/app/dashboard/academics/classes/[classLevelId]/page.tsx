"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import { ChevronRightIcon } from "@/components/icons";
import {
  classTypeLabel,
  enrolmentStatusVariant,
  getClassLevel,
  getClassLevelStudents,
} from "@/lib/classes";
import { ROUTES } from "@/lib/endpoints";
import { formatEnumLabel } from "@/lib/utils";
import type {
  ClassLevelResponse,
  ClassLevelStudentsGroupedResponse,
  ClassStreamStudentsResponse,
} from "@/lib/types";

export default function ClassLevelPage({
  params,
}: {
  params: Promise<{ classLevelId: string }>;
}) {
  // The route segment is the class level's public UUID — the id its API paths
  // take, which the classes hub recovers from the lookup.
  const { classLevelId } = use(params);

  const [level, setLevel] = useState<ClassLevelResponse | null>(null);
  const [roster, setRoster] = useState<ClassLevelStudentsGroupedResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  // Derived rather than set inside the effect, as elsewhere in the dashboard.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const loading = loadedId !== classLevelId;

  useEffect(() => {
    const controller = new AbortController();
    Promise.allSettled([
      getClassLevel(classLevelId, controller.signal),
      getClassLevelStudents(classLevelId, controller.signal),
    ])
      .then(([levelResult, rosterResult]) => {
        if (controller.signal.aborted) return;
        setLevel(levelResult.status === "fulfilled" ? levelResult.value : null);
        setRoster(
          rosterResult.status === "fulfilled" ? rosterResult.value : null,
        );
        if (levelResult.status === "rejected" && rosterResult.status === "rejected") {
          setError(
            (levelResult.reason as { message?: string }).message ??
              "Could not load this class.",
          );
        } else {
          setError(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedId(classLevelId);
      });
    return () => controller.abort();
  }, [classLevelId]);

  const className = level?.className ?? roster?.className ?? "Class";
  const total =
    roster?.streams?.reduce((sum, s) => sum + (s.students?.length ?? 0), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={ROUTES.classes}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
          All classes
        </Link>
      </div>

      <PageHeader
        title={loading ? "Loading…" : className}
        description={
          level
            ? `${level.code ? `${level.code} · ` : ""}${classTypeLabel(level.classType)} · ${total} active ${total === 1 ? "student" : "students"}`
            : undefined
        }
        action={
          <Link
            href={ROUTES.enrolments}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Enrol a student
          </Link>
        }
      />

      {error ? (
        <Alert variant="error" title="Could not load this class">
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : !roster?.streams?.length ? (
        <Card>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No streams to show for this class yet.
          </p>
        </Card>
      ) : (
        roster.streams.map((stream) => (
          <StreamCard key={stream.streamId} stream={stream} />
        ))
      )}
    </div>
  );
}

function StreamCard({ stream }: { stream: ClassStreamStudentsResponse }) {
  const students = stream.students ?? [];
  const full = stream.capacity > 0 && students.length >= stream.capacity;

  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          {stream.fullName || stream.streamName}
        </h2>
        <Badge variant={full ? "warning" : "neutral"}>
          {students.length}
          {stream.capacity ? ` / ${stream.capacity}` : ""} enrolled
          {full ? " · full" : ""}
        </Badge>
      </header>

      {students.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No students in this stream.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                <th className="py-2 pr-4 font-medium">Student</th>
                <th className="py-2 pr-4 font-medium">Admission no.</th>
                <th className="py-2 pr-4 font-medium">Gender</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.studentId}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
                >
                  <td className="py-2.5 pr-4 font-medium text-zinc-900 dark:text-zinc-100">
                    {student.fullName}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                    {student.admissionNumber ?? "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-zinc-600 dark:text-zinc-300">
                    {student.gender ? formatEnumLabel(student.gender) : "—"}
                  </td>
                  <td className="py-2.5">
                    {student.enrolmentStatus ? (
                      <Badge
                        variant={enrolmentStatusVariant(student.enrolmentStatus)}
                      >
                        {formatEnumLabel(student.enrolmentStatus)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
