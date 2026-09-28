"use client";

// Picks one of the school's class levels.
//
// Fed by `GET /class_levels/lookup` with a blank query, which returns every
// class in one request and is the only response carrying both ids — the
// numeric `classLevelId` an enrolment body takes, and the
// `classLevelPublicId` the class-level pages are keyed by. The paginated list
// has neither the second id nor any advantage here.
//
// A select rather than a search box: `StandardGESClassLevel` has thirteen
// values, so a school can never have more classes than fit comfortably in a
// dropdown, and making someone type to discover them would be worse.

import { useEffect, useState } from "react";
import { Field, Select } from "./ui";
import { listAllClassLevelsForPicker } from "@/lib/classes";
import { formatEnumLabel } from "@/lib/utils";
import type { ApiError, ClassLevelLookUpResponse } from "@/lib/types";

type Props = {
  inputId: string;
  selected: ClassLevelLookUpResponse | null;
  onSelect: (classLevel: ClassLevelLookUpResponse | null) => void;
  error?: string;
  label?: string;
  hint?: string;
  required?: boolean;
};

export function classLevelLabel(level: ClassLevelLookUpResponse): string {
  const name = level.className?.trim() || `Class #${level.classLevelId}`;
  return level.code ? `${name} (${level.code})` : name;
}

export function ClassLevelSelect({
  inputId,
  selected,
  onSelect,
  error,
  label = "Class",
  hint,
  required = false,
}: Props) {
  const [classLevels, setClassLevels] = useState<ClassLevelLookUpResponse[]>(
    [],
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  // Derived from which fetch has landed, so the effect never calls setState
  // synchronously — the same shape as the other loaders in this app.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    listAllClassLevelsForPicker(controller.signal)
      .then((levels) => {
        if (controller.signal.aborted) return;
        setClassLevels(levels);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        // A school with no classes yet answers 404, which is an ordinary
        // state here, not a failure worth showing.
        if ((err as ApiError).status === 404) {
          setClassLevels([]);
          setLoadError(null);
          return;
        }
        setLoadError((err as ApiError).message ?? "Could not load classes.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoaded(true);
      });
    return () => controller.abort();
  }, []);

  const empty = loaded && classLevels.length === 0;

  return (
    <Field
      label={label}
      htmlFor={inputId}
      required={required}
      error={error ?? loadError ?? undefined}
      hint={
        empty
          ? "No classes yet — add one before enrolling anyone."
          : (hint ?? undefined)
      }
    >
      <Select
        id={inputId}
        value={selected ? String(selected.classLevelId) : ""}
        onChange={(e) => {
          const id = Number(e.target.value);
          onSelect(
            classLevels.find((level) => level.classLevelId === id) ?? null,
          );
        }}
        disabled={!loaded || empty}
        invalid={!!error || !!loadError}
        required={required}
      >
        <option value="">
          {!loaded ? "Loading classes…" : empty ? "No classes" : "Select a class"}
        </option>
        {classLevels.map((level) => (
          <option key={level.classLevelId} value={level.classLevelId}>
            {classLevelLabel(level)}
            {level.classType ? ` — ${formatEnumLabel(level.classType)}` : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}
