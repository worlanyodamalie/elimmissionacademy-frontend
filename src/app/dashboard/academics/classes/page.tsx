"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
} from "@/components/ui";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import {
  classTypeLabel,
  createClassLevel,
  GES_CLASS_LEVELS,
  gesClassLevelLabel,
  type ClassLevelRecord,
} from "@/lib/classes";
import { useClassLevels } from "@/lib/use-class-levels";
import { ROUTES } from "@/lib/endpoints";
import type {
  ApiError,
  ClassLevelRequest,
  ClassStreamRequest,
  StandardGESClassLevel,
} from "@/lib/types";

export default function ClassesPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const { classLevels, loading, error } = useClassLevels(reloadKey);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Classes"
        description="The class levels this school teaches and the streams inside them. A student is enrolled into a class level; the stream is assigned automatically."
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
        <Alert variant="error" title="Could not load classes">
          {error}
        </Alert>
      ) : null}

      <NewClassLevelCard
        existing={classLevels}
        onCreated={refresh}
      />

      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          Class levels
        </h2>
        {loading ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
        ) : classLevels.length === 0 ? (
          <Card>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              No classes yet. Add the first one above — students can&apos;t be
              enrolled until at least one class exists.
            </p>
          </Card>
        ) : (
          classLevels.map((level) => (
            <ClassLevelCard key={level.classLevelId} level={level} />
          ))
        )}
      </section>
    </div>
  );
}

// --- The list -------------------------------------------------------------

function ClassLevelCard({ level }: { level: ClassLevelRecord }) {
  const capacity = level.streams?.reduce(
    (sum, s) => sum + (s.enrollmentCapacity ?? 0),
    0,
  );

  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {level.className}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {level.code ? `${level.code} · ` : ""}
            {classTypeLabel(level.classType)}
            {capacity ? ` · ${capacity} places` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={level.hasMultipleStreams ? "info" : "neutral"}>
            {level.streams?.length ?? 0}{" "}
            {level.streams?.length === 1 ? "stream" : "streams"}
          </Badge>
          {level.classLevelPublicId ? (
            <Link
              href={ROUTES.classLevel(level.classLevelPublicId)}
              className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            >
              View students
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          ) : null}
        </div>
      </header>

      {level.streams?.length ? (
        <ul className="flex flex-wrap gap-2">
          {level.streams.map((stream) => (
            <li
              key={stream.id}
              className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-300"
            >
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {stream.fullName || stream.streamName}
              </span>
              {stream.enrollmentCapacity
                ? ` · ${stream.enrollmentCapacity} places`
                : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No streams on this class.
        </p>
      )}

      {/* The class-level pages are keyed by a UUID that only the lookup
          returns. When that lookup didn't cover this class there is no link to
          give — see docs/API-GAPS.md §A1. */}
      {!level.classLevelPublicId ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Class roster unavailable — the API didn&apos;t return this
          class&apos;s public id.
        </p>
      ) : null}
    </Card>
  );
}

// --- Creating a class level ----------------------------------------------

type StreamDraft = {
  classStreamName: string;
  priority: string;
  classStreamCapacity: string;
};

function newStream(index: number): StreamDraft {
  return {
    // A, B, C… which is how Ghanaian schools name their streams.
    classStreamName: String.fromCharCode(65 + Math.min(index, 19)),
    priority: String(index + 1),
    classStreamCapacity: "",
  };
}

const MAX_STREAMS = 20;

function NewClassLevelCard({
  existing,
  onCreated,
}: {
  existing: ClassLevelRecord[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [gesLevel, setGesLevel] = useState<StandardGESClassLevel | "">("");
  const [customClassName, setCustomClassName] = useState("");
  const [capacity, setCapacity] = useState("30");
  const [hasMultipleStreams, setHasMultipleStreams] = useState(false);
  const [streams, setStreams] = useState<StreamDraft[]>([
    newStream(0),
    newStream(1),
  ]);
  const [errors, setErrors] = useState<{
    gesLevel?: string;
    capacity?: string;
    streams?: string;
  }>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A school teaches each GES level once, so a level it already has is greyed
  // out rather than offered for a guaranteed 409. Matching is on the class's
  // display name, which is the GES name unless the school renamed it — a
  // renamed level slips through and the 409 message covers it.
  const takenLabels = new Set(
    existing.map((l) => l.className?.trim().toLowerCase()),
  );

  function updateStream(index: number, patch: Partial<StreamDraft>) {
    setStreams((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  function reset() {
    setGesLevel("");
    setCustomClassName("");
    setCapacity("30");
    setHasMultipleStreams(false);
    setStreams([newStream(0), newStream(1)]);
    setErrors({});
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs: typeof errors = {};
    if (!gesLevel) errs.gesLevel = "Choose the GES class level.";
    const capacityValue = Number(capacity);
    if (!capacity || !Number.isInteger(capacityValue) || capacityValue < 1) {
      errs.capacity = "Capacity must be a whole number, at least 1.";
    }
    if (hasMultipleStreams) {
      const named = streams.filter((s) => s.classStreamName.trim());
      if (named.length === 0) {
        errs.streams = "Name at least one stream, or turn streams off.";
      } else if (
        new Set(named.map((s) => s.classStreamName.trim().toLowerCase()))
          .size !== named.length
      ) {
        errs.streams = "Stream names must be different from each other.";
      } else if (
        named.some((s) => {
          const p = Number(s.priority);
          return !Number.isInteger(p) || p < 1 || p > 10;
        })
      ) {
        errs.streams = "Fill order must be a whole number between 1 and 10.";
      }
    }
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;

    setSubmitting(true);
    try {
      const classStreams: ClassStreamRequest[] = streams
        .filter((s) => s.classStreamName.trim())
        .map((s) => ({
          classStreamName: s.classStreamName.trim(),
          priority: Number(s.priority),
          // Left off so the class-wide capacity applies.
          classStreamCapacity: s.classStreamCapacity
            ? Number(s.classStreamCapacity)
            : undefined,
        }));

      const payload: ClassLevelRequest = {
        standardGESClassLevel: gesLevel as StandardGESClassLevel,
        customClassName: customClassName.trim() || undefined,
        hasMultipleStreams,
        // A single-stream class gets a "Main" stream created for it, so the
        // array is only meaningful when streams are on.
        classStreams: hasMultipleStreams ? classStreams : undefined,
        defaultStreamOrClassCapacity: capacityValue,
      };

      const created = await createClassLevel(payload);
      toast({
        title: "Class created",
        description: `${created.className ?? gesClassLevelLabel(gesLevel)} is ready for enrolment.`,
        variant: "success",
      });
      reset();
      setOpen(false);
      onCreated();
    } catch (err) {
      const apiErr = err as ApiError;
      setError(
        apiErr.message?.trim() ||
          (apiErr.status === 409
            ? "This class level already exists at the school."
            : "Could not create the class."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Add a class level
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Pick a GES level, set how many children it holds, and split it into
              streams if it needs them.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <span className="inline-flex items-center gap-1.5">
              <PlusIcon className="h-4 w-4" />
              New class
            </span>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <header className="mb-4">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          New class level
        </h2>
      </header>
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="GES class level"
            htmlFor="c-ges"
            required
            error={errors.gesLevel}
            hint="The national level. It decides the class type and ordering."
          >
            <Select
              id="c-ges"
              value={gesLevel}
              onChange={(e) =>
                setGesLevel(e.target.value as StandardGESClassLevel | "")
              }
              required
              invalid={!!errors.gesLevel}
            >
              <option value="">Select a level</option>
              {GES_CLASS_LEVELS.map((level) => (
                <option
                  key={level.value}
                  value={level.value}
                  disabled={takenLabels.has(level.label.toLowerCase())}
                >
                  {level.label}
                  {takenLabels.has(level.label.toLowerCase())
                    ? " — already added"
                    : ""}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="What the school calls it"
            htmlFor="c-name"
            hint="Optional. Leave blank to use the GES name."
          >
            <Input
              id="c-name"
              value={customClassName}
              onChange={(e) => setCustomClassName(e.target.value)}
              maxLength={50}
              placeholder="e.g. Grade 1"
            />
          </Field>
        </div>

        <Field
          label="Places per stream"
          htmlFor="c-capacity"
          required
          error={errors.capacity}
          hint="Used for every stream that doesn't set its own number."
        >
          <Input
            id="c-capacity"
            type="number"
            min={1}
            step={1}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            required
            invalid={!!errors.capacity}
            className="max-w-[10rem]"
          />
        </Field>

        <Checkbox
          label="This class is split into streams"
          description="Leave off for one undivided class — a single “Main” stream is created for it."
          checked={hasMultipleStreams}
          onChange={(e) => setHasMultipleStreams(e.target.checked)}
        />

        {hasMultipleStreams ? (
          <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Streams
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Enrolment fills them in order of the fill rank, skipping any
                  that are full.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  setStreams((prev) => [...prev, newStream(prev.length)])
                }
                disabled={streams.length >= MAX_STREAMS}
              >
                Add stream
              </Button>
            </div>

            {errors.streams ? (
              <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                {errors.streams}
              </p>
            ) : null}

            {streams.map((stream, index) => (
              <div
                key={index}
                className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <Field label="Name" htmlFor={`s-name-${index}`} required>
                  <Input
                    id={`s-name-${index}`}
                    value={stream.classStreamName}
                    onChange={(e) =>
                      updateStream(index, { classStreamName: e.target.value })
                    }
                    maxLength={10}
                    placeholder="A"
                  />
                </Field>
                <Field label="Fill rank" htmlFor={`s-priority-${index}`} required>
                  <Input
                    id={`s-priority-${index}`}
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={stream.priority}
                    onChange={(e) =>
                      updateStream(index, { priority: e.target.value })
                    }
                  />
                </Field>
                <Field label="Places" htmlFor={`s-capacity-${index}`}>
                  <Input
                    id={`s-capacity-${index}`}
                    type="number"
                    min={1}
                    step={1}
                    value={stream.classStreamCapacity}
                    onChange={(e) =>
                      updateStream(index, {
                        classStreamCapacity: e.target.value,
                      })
                    }
                    placeholder={capacity || "30"}
                  />
                </Field>
                <div className="pb-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setStreams((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={streams.length <= 1}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Create class"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
