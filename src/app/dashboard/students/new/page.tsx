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
import { DateInput } from "@/components/date-input";
import { todayIso } from "@/lib/utils";
import {
  AddressFields,
  EMPTY_ADDRESS,
} from "@/components/address-fields";
import { ChevronRightIcon, PlusIcon } from "@/components/icons";
import { ParentLookup } from "@/components/parent-lookup";
import { apiRequest } from "@/lib/api";
import { useToast } from "@/components/toast";
import { ROUTES, USERS } from "@/lib/endpoints";
import {
  dateNotInFuture,
  email as emailValidator,
  ghanaMobile,
  hasErrors,
  normalizeGhanaMobile,
  validateAll,
} from "@/lib/validation";
import type {
  Address,
  ApiError,
  CustodyType,
  Gender,
  ParentRelationship,
  ParentSummary,
  PreferredContactMethod,
  RelationType,
  StudentParentEntry,
  StudentPayload,
} from "@/lib/types";

// How a new parent's address is supplied: copied from the student, or entered
// by hand. The API takes the address as an optional whole, so a partial one is
// never sent.
//
// There is deliberately no "skip it" mode: the address is optional in the API
// contract, but POST /auth/users/students answers 500 when `newParent.address`
// is absent. See docs/API-GAPS.md.
type ParentAddressMode = "same" | "custom";

type ParentDraft = {
  mode: "new" | "existing";
  selectedParent: ParentSummary | null;
  firstName: string;
  lastName: string;
  otherNames: string;
  email: string;
  mobileNumber: string;
  // Optional on the API; "" means "not specified" and is omitted from the body.
  gender: Gender | "";
  addressMode: ParentAddressMode;
  address: Address;
  relationType: RelationType;
  isPrimaryContact: boolean;
  hasPickupPermission: boolean;
  hasFinancialResponsibility: boolean;
  custodyType: CustodyType;
  custodyNotes: string;
  preferredContactMethods: PreferredContactMethod[];
};

const RELATIONS: { value: RelationType; label: string }[] = [
  { value: "MOTHER", label: "Mother" },
  { value: "FATHER", label: "Father" },
  { value: "STEP_MOTHER", label: "Step-mother" },
  { value: "STEP_FATHER", label: "Step-father" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "UNCLE", label: "Uncle" },
  { value: "AUNT", label: "Aunt" },
  { value: "GRANDPARENT", label: "Grandparent" },
  { value: "FOSTER_PARENT", label: "Foster parent" },
  { value: "ADOPTIVE_PARENT", label: "Adoptive parent" },
];

const CUSTODY_TYPES: { value: CustodyType; label: string }[] = [
  { value: "PRIMARY", label: "Primary" },
  { value: "JOINT", label: "Joint" },
  { value: "WEEKEND", label: "Weekend" },
  { value: "SUPERVISED", label: "Supervised" },
  { value: "NONE", label: "None" },
];

const CONTACT_METHODS: { value: PreferredContactMethod; label: string }[] = [
  { value: "PHONE_CALL", label: "Phone call" },
  { value: "SMS", label: "SMS" },
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "WhatsApp" },
];

function emptyParent(primary = false): ParentDraft {
  return {
    mode: "new",
    selectedParent: null,
    firstName: "",
    lastName: "",
    otherNames: "",
    email: "",
    mobileNumber: "",
    gender: "",
    addressMode: "same",
    address: EMPTY_ADDRESS,
    relationType: "MOTHER",
    isPrimaryContact: primary,
    hasPickupPermission: true,
    hasFinancialResponsibility: primary,
    custodyType: primary ? "PRIMARY" : "JOINT",
    custodyNotes: "",
    preferredContactMethods: ["PHONE_CALL"],
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
    admissionDate: "",
    previousSchoolName: "",
    medicalNotes: "",
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
    admissionDate?: string;
    region?: string;
    city?: string;
    street?: string;
  };
  type ParentErrors = {
    parentId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    preferredContactMethods?: string;
    country?: string;
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
        admissionDate: student.admissionDate,
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
        admissionDate: (v) =>
          v ? undefined : "Admission date is required.",
        region: (v) => (v.trim() ? undefined : "Region is required."),
        city: (v) => (v.trim() ? undefined : "City is required."),
        street: (v) => (v.trim() ? undefined : "Street is required."),
      },
    );

    const pErrs: ParentErrors[] = parents.map((p) => {
      const errs: ParentErrors = {};
      if (p.mode === "existing") {
        if (!p.selectedParent) {
          errs.parentId = "Search for and select a parent.";
        }
      } else {
        Object.assign(
          errs,
          validateAll(
            {
              firstName: p.firstName,
              lastName: p.lastName,
              email: p.email,
              mobileNumber: p.mobileNumber,
            },
            {
              firstName: (v) =>
                v.trim() ? undefined : "First name is required.",
              lastName: (v) =>
                v.trim() ? undefined : "Last name is required.",
              email: (v) =>
                !v.trim() ? "Email is required." : emailValidator(v),
              mobileNumber: (v) =>
                !v.trim() ? "Mobile number is required." : ghanaMobile(v),
            },
          ),
        );
        // The API rejects a partial address, so a hand-entered one must be
        // complete before we include it.
        if (p.addressMode === "custom") {
          Object.assign(
            errs,
            validateAll(
              {
                country: p.address.country,
                region: p.address.region,
                city: p.address.city,
                street: p.address.street,
              },
              {
                country: (v) => (v.trim() ? undefined : "Country is required."),
                region: (v) => (v.trim() ? undefined : "Region is required."),
                city: (v) => (v.trim() ? undefined : "City is required."),
                street: (v) => (v.trim() ? undefined : "Street is required."),
              },
            ),
          );
        }
      }
      if (p.preferredContactMethods.length === 0) {
        errs.preferredContactMethods =
          "Select at least one contact method.";
      }
      return errs;
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
      const parentEntries: StudentParentEntry[] = parents.map((p, i) => {
        const relationship: ParentRelationship = {
          relationType: p.relationType,
          isPrimaryContact: p.isPrimaryContact,
          hasPickupPermission: p.hasPickupPermission,
          hasFinancialResponsibility: p.hasFinancialResponsibility,
          emergencyContactOrder: i + 1,
          custodyType: p.custodyType,
          custodyNotes: p.custodyNotes.trim() || null,
          preferredContactMethods: p.preferredContactMethods,
        };
        if (p.mode === "existing" && p.selectedParent) {
          return {
            existingParent: {
              parentId: p.selectedParent.parentId,
              relationship,
            },
            newParent: null,
          };
        }
        const parentAddress =
          p.addressMode === "same" ? studentAddress : p.address;
        return {
          existingParent: null,
          newParent: {
            firstName: p.firstName.trim(),
            lastName: p.lastName.trim(),
            otherNames: p.otherNames.trim() || undefined,
            email: p.email.trim(),
            mobileNumber: normalizeGhanaMobile(p.mobileNumber),
            gender: p.gender || undefined,
            address: parentAddress,
            relationship,
          },
        };
      });

      const payload: StudentPayload = {
        student: {
          firstName: student.firstName.trim(),
          lastName: student.lastName.trim(),
          otherNames: student.otherNames.trim() || undefined,
          gender: student.gender,
          dateOfBirth: student.dateOfBirth,
          admissionDate: student.admissionDate,
          address: studentAddress,
          previousSchoolName: student.previousSchoolName.trim() || undefined,
          medicalNotes: student.medicalNotes.trim() || null,
          hasSpecialNeeds: student.hasSpecialNeeds,
          specialNeedsDetails: student.hasSpecialNeeds
            ? student.specialNeedsDetails.trim() || null
            : null,
        },
        parents: parentEntries,
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
      // The API answers a bare 500 when a new parent's email or mobile already
      // belongs to someone at the school, so there is no message to show and
      // the cause is impossible to guess from the form. Name the likely reason
      // rather than leaving the admin staring at "something went wrong".
      // See docs/API-GAPS.md §O8.
      const duplicateHint =
        apiErr.status === 500 && parents.some((p) => p.mode === "new")
          ? "Could not enroll student. If a parent above is already at this school — as a staff member, or as another student's parent — their email and mobile number are already registered. Tick “This parent already has an account” and link them instead."
          : "Could not enroll student.";
      setError(apiErr.message?.trim() || duplicateHint);
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
              <DateInput
                id="s-dob"
                value={student.dateOfBirth}
                max={todayIso()}
                onChange={(value) =>
                  setStudent({ ...student, dateOfBirth: value })
                }
                required
                invalid={!!studentErrors.dateOfBirth}
              />
            </Field>
            <Field
              label="Admission date"
              htmlFor="s-admission"
              required
              error={studentErrors.admissionDate}
            >
              <DateInput
                id="s-admission"
                value={student.admissionDate}
                onChange={(value) =>
                  setStudent({ ...student, admissionDate: value })
                }
                required
                invalid={!!studentErrors.admissionDate}
              />
            </Field>
            <Field
              label="Previous school"
              htmlFor="s-prev"
              hint="If transferring from another school"
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
            <Field
              label="Medical notes"
              htmlFor="s-medical"
              hint="Allergies, medication, or conditions staff should know about."
              className="sm:col-span-2"
            >
              <Textarea
                id="s-medical"
                value={student.medicalNotes}
                onChange={(e) =>
                  setStudent({ ...student, medicalNotes: e.target.value })
                }
                rows={3}
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
                Their order below sets the emergency contact order.
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
    parentId?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    preferredContactMethods?: string;
    country?: string;
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

  function toggleContactMethod(method: PreferredContactMethod) {
    const has = parent.preferredContactMethods.includes(method);
    onUpdate({
      preferredContactMethods: has
        ? parent.preferredContactMethods.filter((m) => m !== method)
        : [...parent.preferredContactMethods, method],
    });
  }

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

      <div className="mb-4">
        <Checkbox
          label="This parent already has an account"
          description="Link an existing parent by their ID instead of creating a new account."
          checked={parent.mode === "existing"}
          onChange={(e) =>
            onUpdate({ mode: e.target.checked ? "existing" : "new" })
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {parent.mode === "existing" ? (
          <div className="sm:col-span-2">
            <ParentLookup
              inputId={id("parent-search")}
              selected={parent.selectedParent}
              required
              error={errors.parentId}
              onSelect={(selectedParent) => onUpdate({ selectedParent })}
            />
          </div>
        ) : (
          <>
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
              hint={
                errors.mobileNumber
                  ? undefined
                  : "Ghanaian number, e.g. +233241234567 or 0241234567."
              }
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
            <Field label="Gender" htmlFor={id("gender")}>
              <Select
                id={id("gender")}
                value={parent.gender}
                onChange={(e) =>
                  onUpdate({ gender: e.target.value as Gender | "" })
                }
              >
                <option value="">Not specified</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
              </Select>
            </Field>
          </>
        )}

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
        <Field label="Custody type" htmlFor={id("custody")} required>
          <Select
            id={id("custody")}
            value={parent.custodyType}
            onChange={(e) =>
              onUpdate({ custodyType: e.target.value as CustodyType })
            }
          >
            {CUSTODY_TYPES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Custody notes"
          htmlFor={id("custody-notes")}
          hint="Optional details about the custody arrangement."
          className="sm:col-span-2"
        >
          <Textarea
            id={id("custody-notes")}
            value={parent.custodyNotes}
            onChange={(e) => onUpdate({ custodyNotes: e.target.value })}
            rows={2}
          />
        </Field>
      </div>

      {parent.mode === "new" ? (
        <div className="mt-4 flex flex-col gap-4">
          <Field
            label="Home address"
            htmlFor={id("addr-mode")}
            hint="Used for correspondence and emergency contact."
            className="sm:max-w-xs"
          >
            <Select
              id={id("addr-mode")}
              value={parent.addressMode}
              onChange={(e) =>
                onUpdate({
                  addressMode: e.target.value as ParentAddressMode,
                })
              }
            >
              <option value="same">Same as student</option>
              <option value="custom">Enter a different address</option>
            </Select>
          </Field>
          {parent.addressMode === "custom" ? (
            <AddressFields
              value={parent.address}
              onChange={(address) => onUpdate({ address })}
              idPrefix={id("addr")}
              errors={{
                country: errors.country,
                region: errors.region,
                city: errors.city,
                street: errors.street,
              }}
            />
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-col gap-3">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Preferred contact methods{" "}
            <span className="text-rose-600 dark:text-rose-400">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CONTACT_METHODS.map((m) => (
              <Checkbox
                key={m.value}
                label={m.label}
                checked={parent.preferredContactMethods.includes(m.value)}
                onChange={() => toggleContactMethod(m.value)}
              />
            ))}
          </div>
          {errors.preferredContactMethods ? (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">
              {errors.preferredContactMethods}
            </p>
          ) : null}
        </fieldset>
        <Checkbox
          label="Allowed to pick up the student"
          description="Authorize this parent or guardian to pick up the student from school."
          checked={parent.hasPickupPermission}
          onChange={(e) => onUpdate({ hasPickupPermission: e.target.checked })}
        />
        <Checkbox
          label="Financially responsible"
          description="This parent or guardian is responsible for fees and billing."
          checked={parent.hasFinancialResponsibility}
          onChange={(e) =>
            onUpdate({ hasFinancialResponsibility: e.target.checked })
          }
        />
      </div>
    </div>
  );
}
