"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
  Textarea,
} from "@/components/ui";
import {
  AddressFields,
  EMPTY_ADDRESS,
} from "@/components/address-fields";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/toast";
import { ROUTES, USERS } from "@/lib/endpoints";
import {
  dateNotInFuture,
  email as emailValidator,
  hasErrors,
  phone as phoneValidator,
  validateAll,
} from "@/lib/validation";
import type {
  Address,
  ApiError,
  Gender,
  ParentPayload,
  RelationType,
  StudentPayload,
} from "@/lib/types";

type ParentDraft = {
  firstName: string;
  lastName: string;
  otherNames: string;
  email: string;
  mobileNumber: string;
  gender: Gender;
  relationType: RelationType;
  isPrimaryContact: boolean;
  hasPickupPermission: boolean;
  address: Address;
  copyStudentAddress: boolean;
};

const RELATIONS: { value: RelationType; label: string }[] = [
  { value: "FATHER", label: "Father" },
  { value: "MOTHER", label: "Mother" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "OTHER", label: "Other" },
];

function emptyParent(primary = false): ParentDraft {
  return {
    firstName: "",
    lastName: "",
    otherNames: "",
    email: "",
    mobileNumber: "",
    gender: "FEMALE",
    relationType: "MOTHER",
    isPrimaryContact: primary,
    hasPickupPermission: true,
    address: { ...EMPTY_ADDRESS },
    copyStudentAddress: true,
  };
}

export default function NewStudentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [student, setStudent] = useState({
    firstName: "",
    lastName: "",
    otherNames: "",
    gender: "MALE" as Gender,
    dateOfBirth: "",
    previousSchoolName: "",
    hasSpecialNeeds: false,
    specialNeedsDetails: "",
  });
  const [studentAddress, setStudentAddress] = useState<Address>(EMPTY_ADDRESS);
  const [parents, setParents] = useState<ParentDraft[]>([emptyParent(true)]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type StudentErrors = {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    region?: string;
    city?: string;
    street?: string;
  };
  type ParentErrors = {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    region?: string;
    city?: string;
    street?: string;
  };
  const [studentErrors, setStudentErrors] = useState<StudentErrors>({});
  const [parentErrors, setParentErrors] = useState<ParentErrors[]>([{}]);

  function updateParent(index: number, patch: Partial<ParentDraft>) {
    setParents((curr) =>
      curr.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    );
  }

  function setPrimary(index: number) {
    setParents((curr) =>
      curr.map((p, i) => ({ ...p, isPrimaryContact: i === index })),
    );
  }

  function addParent() {
    setParents((curr) => [...curr, emptyParent(false)]);
    setParentErrors((curr) => [...curr, {}]);
  }

  function removeParent(index: number) {
    setParents((curr) => {
      const next = curr.filter((_, i) => i !== index);
      if (!next.some((p) => p.isPrimaryContact) && next.length > 0) {
        next[0] = { ...next[0], isPrimaryContact: true };
      }
      return next;
    });
    setParentErrors((curr) => curr.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (parents.length === 0) {
      setError("Add at least one parent or guardian.");
      return;
    }
    if (!parents.some((p) => p.isPrimaryContact)) {
      setError("Mark one parent or guardian as the primary contact.");
      return;
    }

    const sErr = validateAll(
      {
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        region: studentAddress.region,
        city: studentAddress.city,
        street: studentAddress.street,
      },
      {
        firstName: (v) => (v.trim() ? undefined : "First name is required."),
        lastName: (v) => (v.trim() ? undefined : "Last name is required."),
        dateOfBirth: (v) =>
          !v
            ? "Date of birth is required."
            : dateNotInFuture("Date of birth")(v),
        region: (v) => (v.trim() ? undefined : "Region is required."),
        city: (v) => (v.trim() ? undefined : "City is required."),
        street: (v) => (v.trim() ? undefined : "Street is required."),
      },
    );

    const pErrs: ParentErrors[] = parents.map((p) => {
      const errs = validateAll(
        {
          firstName: p.firstName,
          lastName: p.lastName,
          email: p.email,
          mobileNumber: p.mobileNumber,
          region: p.copyStudentAddress ? "ok" : p.address.region,
          city: p.copyStudentAddress ? "ok" : p.address.city,
          street: p.copyStudentAddress ? "ok" : p.address.street,
        },
        {
          firstName: (v) => (v.trim() ? undefined : "First name is required."),
          lastName: (v) => (v.trim() ? undefined : "Last name is required."),
          email: (v) =>
            !v.trim() ? "Email is required." : emailValidator(v),
          mobileNumber: (v) =>
            !v.trim() ? "Mobile number is required." : phoneValidator(v),
          region: (v) => (v.trim() ? undefined : "Region is required."),
          city: (v) => (v.trim() ? undefined : "City is required."),
          street: (v) => (v.trim() ? undefined : "Street is required."),
        },
      );
      return errs as ParentErrors;
    });

    setStudentErrors(sErr as StudentErrors);
    setParentErrors(pErrs);

    if (
      hasErrors(sErr as Record<string, string | undefined>) ||
      pErrs.some((e) => hasErrors(e as Record<string, string | undefined>))
    ) {
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const parentPayloads: ParentPayload[] = parents.map((p) => ({
        firstName: p.firstName.trim(),
        lastName: p.lastName.trim(),
        otherNames: p.otherNames.trim() || undefined,
        email: p.email.trim(),
        mobileNumber: p.mobileNumber.trim(),
        gender: p.gender,
        relationType: p.relationType,
        isPrimaryContact: p.isPrimaryContact,
        hasPickupPermission: p.hasPickupPermission,
        address: p.copyStudentAddress ? studentAddress : p.address,
      }));

      const payload: StudentPayload = {
        student: {
          firstName: student.firstName.trim(),
          lastName: student.lastName.trim(),
          otherNames: student.otherNames.trim() || undefined,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          address: studentAddress,
          previousSchoolName: student.previousSchoolName.trim() || undefined,
          hasSpecialNeeds: student.hasSpecialNeeds,
          specialNeedsDetails: student.hasSpecialNeeds
            ? student.specialNeedsDetails.trim() || null
            : null,
        },
        parents: parentPayloads,
      };

      await apiRequest(USERS.students, {
        method: "POST",
        body: payload,
      });

      toast({
        title: "Student enrolled",
        description: `${student.firstName} ${student.lastName} has been added. Parents will receive onboarding emails.`,
        variant: "success",
      });
      router.push(ROUTES.students);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? "Could not enroll student.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <li>
            <Link
              href={ROUTES.students}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Students
            </Link>
          </li>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <li className="font-medium text-zinc-900 dark:text-zinc-100">
            Enroll student
          </li>
        </ol>
      </nav>

      <PageHeader
        title="Enroll a student"
        description="Add a student with their parents or guardians. Parents will receive onboarding emails to set up their accounts."
      />

      {error ? (
        <Alert variant="error" title="Could not save">
          {error}
        </Alert>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
        <Card>
          <header className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Student details
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="First name"
              htmlFor="s-first"
              required
              error={studentErrors.firstName}
            >
              <Input
                id="s-first"
                value={student.firstName}
                onChange={(e) =>
                  setStudent({ ...student, firstName: e.target.value })
                }
                autoComplete="given-name"
                required
                invalid={!!studentErrors.firstName}
              />
            </Field>
            <Field
              label="Last name"
              htmlFor="s-last"
              required
              error={studentErrors.lastName}
            >
              <Input
                id="s-last"
                value={student.lastName}
                onChange={(e) =>
                  setStudent({ ...student, lastName: e.target.value })
                }
                autoComplete="family-name"
                required
                invalid={!!studentErrors.lastName}
              />
            </Field>
            <Field
              label="Other names"
              htmlFor="s-other"
              className="sm:col-span-2"
            >
              <Input
                id="s-other"
                value={student.otherNames}
                onChange={(e) =>
                  setStudent({ ...student, otherNames: e.target.value })
                }
              />
            </Field>
            <Field label="Gender" htmlFor="s-gender" required>
              <Select
                id="s-gender"
                value={student.gender}
                onChange={(e) =>
                  setStudent({ ...student, gender: e.target.value as Gender })
                }
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
            <Field
              label="Date of birth"
              htmlFor="s-dob"
              required
              error={studentErrors.dateOfBirth}
            >
              <Input
                id="s-dob"
                type="date"
                value={student.dateOfBirth}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) =>
                  setStudent({ ...student, dateOfBirth: e.target.value })
                }
                required
                invalid={!!studentErrors.dateOfBirth}
              />
            </Field>
            <Field
              label="Previous school"
              htmlFor="s-prev"
              hint="If transferring from another school"
              className="sm:col-span-2"
            >
              <Input
                id="s-prev"
                value={student.previousSchoolName}
                onChange={(e) =>
                  setStudent({
                    ...student,
                    previousSchoolName: e.target.value,
                  })
                }
              />
            </Field>
            <div className="sm:col-span-2">
              <Checkbox
                label="This student has special needs"
                description="We'll note this so teachers and staff can give appropriate support."
                checked={student.hasSpecialNeeds}
                onChange={(e) =>
                  setStudent({
                    ...student,
                    hasSpecialNeeds: e.target.checked,
                  })
                }
              />
            </div>
            {student.hasSpecialNeeds ? (
              <Field
                label="Special needs details"
                htmlFor="s-special"
                hint="Kept confidential and visible only to authorized staff."
                className="sm:col-span-2"
              >
                <Textarea
                  id="s-special"
                  value={student.specialNeedsDetails}
                  onChange={(e) =>
                    setStudent({
                      ...student,
                      specialNeedsDetails: e.target.value,
                    })
                  }
                  rows={3}
                />
              </Field>
            ) : null}
          </div>
        </Card>

        <Card>
          <header className="mb-4">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Student address
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Parents who live at the same address can copy this when added below.
            </p>
          </header>
          <AddressFields
            value={studentAddress}
            onChange={setStudentAddress}
            idPrefix="student-addr"
            errors={{
              region: studentErrors.region,
              city: studentErrors.city,
              street: studentErrors.street,
            }}
          />
        </Card>

        <Card>
          <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Parents & guardians
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Add at least one. Mark exactly one as the primary contact.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={addParent}
              leftIcon={<PlusIcon className="h-4 w-4" />}
            >
              Add another
            </Button>
          </header>

          <div className="flex flex-col gap-4">
            {parents.map((parent, idx) => (
              <ParentBlock
                key={idx}
                index={idx}
                parent={parent}
                errors={parentErrors[idx] ?? {}}
                canRemove={parents.length > 1}
                onUpdate={(patch) => updateParent(idx, patch)}
                onSetPrimary={() => setPrimary(idx)}
                onRemove={() => removeParent(idx)}
              />
            ))}
          </div>
        </Card>

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-zinc-100 pt-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {submitting ? "Saving…" : "Enroll student"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ParentBlock({
  index,
  parent,
  errors,
  canRemove,
  onUpdate,
  onSetPrimary,
  onRemove,
}: {
  index: number;
  parent: ParentDraft;
  errors: {
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    region?: string;
    city?: string;
    street?: string;
  };
  canRemove: boolean;
  onUpdate: (patch: Partial<ParentDraft>) => void;
  onSetPrimary: () => void;
  onRemove: () => void;
}) {
  const id = (k: string) => `p${index}-${k}`;
  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Parent {index + 1}
          </h3>
          {parent.isPrimaryContact ? (
            <Badge variant="success">Primary contact</Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {!parent.isPrimaryContact ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onSetPrimary}
            >
              Make primary
            </Button>
          ) : null}
          {canRemove ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRemove}
              className="text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="First name"
          htmlFor={id("first")}
          required
          error={errors.firstName}
        >
          <Input
            id={id("first")}
            value={parent.firstName}
            onChange={(e) => onUpdate({ firstName: e.target.value })}
            required
            invalid={!!errors.firstName}
          />
        </Field>
        <Field
          label="Last name"
          htmlFor={id("last")}
          required
          error={errors.lastName}
        >
          <Input
            id={id("last")}
            value={parent.lastName}
            onChange={(e) => onUpdate({ lastName: e.target.value })}
            required
            invalid={!!errors.lastName}
          />
        </Field>
        <Field
          label="Other names"
          htmlFor={id("other")}
          className="sm:col-span-2"
        >
          <Input
            id={id("other")}
            value={parent.otherNames}
            onChange={(e) => onUpdate({ otherNames: e.target.value })}
          />
        </Field>
        <Field label="Relationship" htmlFor={id("rel")} required>
          <Select
            id={id("rel")}
            value={parent.relationType}
            onChange={(e) =>
              onUpdate({ relationType: e.target.value as RelationType })
            }
          >
            {RELATIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gender" htmlFor={id("gender")} required>
          <Select
            id={id("gender")}
            value={parent.gender}
            onChange={(e) => onUpdate({ gender: e.target.value as Gender })}
          >
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </Select>
        </Field>
        <Field
          label="Email"
          htmlFor={id("email")}
          required
          error={errors.email}
        >
          <Input
            id={id("email")}
            type="email"
            value={parent.email}
            onChange={(e) => onUpdate({ email: e.target.value })}
            required
            invalid={!!errors.email}
          />
        </Field>
        <Field
          label="Mobile number"
          htmlFor={id("phone")}
          required
          error={errors.mobileNumber}
        >
          <Input
            id={id("phone")}
            type="tel"
            value={parent.mobileNumber}
            onChange={(e) => onUpdate({ mobileNumber: e.target.value })}
            required
            placeholder="+233241112223"
            invalid={!!errors.mobileNumber}
          />
        </Field>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Checkbox
          label="Lives at the same address as the student"
          checked={parent.copyStudentAddress}
          onChange={(e) => onUpdate({ copyStudentAddress: e.target.checked })}
        />
        {!parent.copyStudentAddress ? (
          <div className="rounded-lg border border-dashed border-zinc-200 p-4 dark:border-zinc-800">
            <AddressFields
              value={parent.address}
              onChange={(addr) => onUpdate({ address: addr })}
              idPrefix={`parent${index}`}
              errors={{
                region: errors.region,
                city: errors.city,
                street: errors.street,
              }}
            />
          </div>
        ) : null}
        <Checkbox
          label="Allowed to pick up the student"
          description="Authorize this parent or guardian to pick up the student from school."
          checked={parent.hasPickupPermission}
          onChange={(e) => onUpdate({ hasPickupPermission: e.target.checked })}
        />
      </div>
    </div>
  );
}
