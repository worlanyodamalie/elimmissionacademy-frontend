"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  Select,
  Textarea,
} from "./ui";
import { AddressFields, EMPTY_ADDRESS } from "./address-fields";
import { apiRequest } from "@/lib/api";
import { useToast } from "./toast";
import {
  ADMIN_LEVELS,
  ADMIN_STATUSES,
  EMPLOYMENT_TYPES,
  HEAD_TEACHER_POSITIONS,
  HEAD_TEACHER_STATUSES,
} from "@/lib/staff-options";
import {
  email as emailValidator,
  ghanaMobile,
  hasErrors,
  normalizeGhanaMobile,
  validateAll,
} from "@/lib/validation";
import type {
  Address,
  AdminLevel,
  AdminStatus,
  ApiError,
  EmploymentType,
  Gender,
  HeadTeacherPosition,
  HeadTeacherStatus,
  StaffPayload,
  StaffProfileDetails,
} from "@/lib/types";

export type StaffRole = "teacher" | "head-teacher" | "admin";

type Props = {
  endpoint: string;
  role: StaffRole;
  roleLabel: string;
  successDescription?: string;
  redirectTo?: string;
};

const DATE_LABELS: Record<StaffRole, string> = {
  teacher: "Date employed",
  "head-teacher": "Date appointed",
  admin: "Date assigned",
};

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  otherNames: "",
  email: "",
  mobileNumber: "",
  gender: "MALE" as Gender,
};

const EMPTY_PROFILE = {
  qualificationsText: "",
  employmentType: "FULL_TIME" as EmploymentType,
  position: "MAIN" as HeadTeacherPosition,
  headTeacherStatus: "ACTIVE" as HeadTeacherStatus,
  adminLevel: "MAIN" as AdminLevel,
  adminStatus: "ACTIVE" as AdminStatus,
  date: "",
};

export function StaffForm({
  endpoint,
  role,
  roleLabel,
  successDescription,
  redirectTo,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [fieldErrors, setFieldErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    mobileNumber?: string;
    region?: string;
    city?: string;
    street?: string;
    qualifications?: string;
    date?: string;
  }>({});

  const needsQualifications = role === "teacher" || role === "head-teacher";
  const dateLabel = DATE_LABELS[role];

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function updateProfile<K extends keyof typeof profile>(
    key: K,
    value: (typeof profile)[K],
  ) {
    setProfile((p) => ({ ...p, [key]: value }));
  }

  function parseQualifications(): string[] {
    return profile.qualificationsText
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
  }

  function buildProfileDetails(): StaffProfileDetails {
    if (role === "teacher") {
      return {
        qualifications: parseQualifications(),
        employmentType: profile.employmentType,
        dateEmployed: profile.date,
      };
    }
    if (role === "head-teacher") {
      return {
        position: profile.position,
        qualifications: parseQualifications(),
        status: profile.headTeacherStatus,
        dateAppointed: profile.date,
      };
    }
    return {
      adminLevel: profile.adminLevel,
      profileStatus: profile.adminStatus,
      dateAssigned: profile.date,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const requiredText = (label: string) => (v: string) =>
      v.trim() ? undefined : `${label} is required.`;

    const errors: typeof fieldErrors = validateAll(
      {
        email: form.email,
        mobileNumber: form.mobileNumber,
        date: profile.date,
      },
      {
        email: (v) => (!v.trim() ? "Email is required." : emailValidator(v)),
        mobileNumber: (v) =>
          !v.trim() ? "Mobile number is required." : ghanaMobile(v),
        date: requiredText(dateLabel),
      },
    );

    if (!isExistingUser) {
      Object.assign(
        errors,
        validateAll(
          {
            firstName: form.firstName,
            lastName: form.lastName,
            region: address.region,
            city: address.city,
            street: address.street,
          },
          {
            firstName: requiredText("First name"),
            lastName: requiredText("Last name"),
            region: requiredText("Region"),
            city: requiredText("City"),
            street: requiredText("Street"),
          },
        ),
      );
    }

    if (needsQualifications && parseQualifications().length === 0) {
      errors.qualifications = "Add at least one qualification.";
    }

    setFieldErrors(errors);
    if (hasErrors(errors)) {
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: StaffPayload = {
        email: form.email.trim(),
        mobileNumber: normalizeGhanaMobile(form.mobileNumber),
        isExistingUser,
        personalDetails: isExistingUser
          ? undefined
          : {
              firstName: form.firstName.trim(),
              lastName: form.lastName.trim(),
              otherNames: form.otherNames.trim() || undefined,
              gender: form.gender,
              address,
            },
        profileDetails: buildProfileDetails(),
      };
      await apiRequest(endpoint, {
        method: "POST",
        body: payload,
      });
      toast({
        title: `${roleLabel} added`,
        description:
          successDescription ??
          (isExistingUser
            ? `The ${roleLabel.toLowerCase()} role has been added to the existing account.`
            : `${form.firstName} ${form.lastName} will receive an onboarding email.`),
        variant: "success",
      });
      setFieldErrors({});
      if (redirectTo) router.push(redirectTo);
      else {
        setForm(EMPTY_FORM);
        setProfile(EMPTY_PROFILE);
        setAddress(EMPTY_ADDRESS);
        setIsExistingUser(false);
      }
    } catch (err) {
      const apiErr = err as ApiError;
      setError(apiErr.message ?? `Could not add ${roleLabel.toLowerCase()}.`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      {error ? (
        <div className="mb-4">
          <Alert variant="error" title="Could not save">
            {error}
          </Alert>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
        <section className="flex flex-col gap-4">
          <header>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              Account
            </h2>
          </header>
          <Checkbox
            label="This person already has an account"
            description="Link the new role to an existing user by email instead of creating a new account."
            checked={isExistingUser}
            onChange={(e) => setIsExistingUser(e.target.checked)}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="Email"
              htmlFor="email"
              required
              hint={
                fieldErrors.email
                  ? undefined
                  : isExistingUser
                    ? "The email of the existing account."
                    : "Used to send the onboarding link."
              }
              error={fieldErrors.email}
            >
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                autoComplete="email"
                required
                invalid={!!fieldErrors.email}
              />
            </Field>
            <Field
              label="Mobile number"
              htmlFor="mobile"
              required
              hint={
                fieldErrors.mobileNumber
                  ? undefined
                  : "Ghanaian number, e.g. +233241234567 or 0241234567."
              }
              error={fieldErrors.mobileNumber}
            >
              <Input
                id="mobile"
                type="tel"
                value={form.mobileNumber}
                onChange={(e) => update("mobileNumber", e.target.value)}
                autoComplete="tel"
                required
                placeholder="+233241234890"
                invalid={!!fieldErrors.mobileNumber}
              />
            </Field>
          </div>
        </section>

        {!isExistingUser ? (
          <>
            <section className="flex flex-col gap-4">
              <header>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Personal details
                </h2>
              </header>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="First name"
                  htmlFor="firstName"
                  required
                  error={fieldErrors.firstName}
                >
                  <Input
                    id="firstName"
                    value={form.firstName}
                    onChange={(e) => update("firstName", e.target.value)}
                    autoComplete="given-name"
                    required
                    invalid={!!fieldErrors.firstName}
                  />
                </Field>
                <Field
                  label="Last name"
                  htmlFor="lastName"
                  required
                  error={fieldErrors.lastName}
                >
                  <Input
                    id="lastName"
                    value={form.lastName}
                    onChange={(e) => update("lastName", e.target.value)}
                    autoComplete="family-name"
                    required
                    invalid={!!fieldErrors.lastName}
                  />
                </Field>
                <Field
                  label="Other names"
                  htmlFor="otherNames"
                  className="sm:col-span-2"
                >
                  <Input
                    id="otherNames"
                    value={form.otherNames}
                    onChange={(e) => update("otherNames", e.target.value)}
                  />
                </Field>
                <Field label="Gender" htmlFor="gender" required>
                  <Select
                    id="gender"
                    value={form.gender}
                    onChange={(e) => update("gender", e.target.value as Gender)}
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                  </Select>
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <header>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Address
                </h2>
              </header>
              <AddressFields
                value={address}
                onChange={setAddress}
                errors={{
                  region: fieldErrors.region,
                  city: fieldErrors.city,
                  street: fieldErrors.street,
                }}
              />
            </section>
          </>
        ) : null}

        <section className="flex flex-col gap-4">
          <header>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {roleLabel} profile
            </h2>
          </header>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {role === "teacher" ? (
              <Field label="Employment type" htmlFor="employmentType" required>
                <Select
                  id="employmentType"
                  value={profile.employmentType}
                  onChange={(e) =>
                    updateProfile(
                      "employmentType",
                      e.target.value as EmploymentType,
                    )
                  }
                >
                  {EMPLOYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            {role === "head-teacher" ? (
              <>
                <Field label="Position" htmlFor="position" required>
                  <Select
                    id="position"
                    value={profile.position}
                    onChange={(e) =>
                      updateProfile(
                        "position",
                        e.target.value as HeadTeacherPosition,
                      )
                    }
                  >
                    {HEAD_TEACHER_POSITIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status" htmlFor="htStatus" required>
                  <Select
                    id="htStatus"
                    value={profile.headTeacherStatus}
                    onChange={(e) =>
                      updateProfile(
                        "headTeacherStatus",
                        e.target.value as HeadTeacherStatus,
                      )
                    }
                  >
                    {HEAD_TEACHER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            {role === "admin" ? (
              <>
                <Field label="Admin level" htmlFor="adminLevel" required>
                  <Select
                    id="adminLevel"
                    value={profile.adminLevel}
                    onChange={(e) =>
                      updateProfile("adminLevel", e.target.value as AdminLevel)
                    }
                  >
                    {ADMIN_LEVELS.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Status" htmlFor="adminStatus" required>
                  <Select
                    id="adminStatus"
                    value={profile.adminStatus}
                    onChange={(e) =>
                      updateProfile(
                        "adminStatus",
                        e.target.value as AdminStatus,
                      )
                    }
                  >
                    {ADMIN_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : null}
            <Field
              label={dateLabel}
              htmlFor="profileDate"
              required
              error={fieldErrors.date}
            >
              <Input
                id="profileDate"
                type="date"
                value={profile.date}
                onChange={(e) => updateProfile("date", e.target.value)}
                required
                invalid={!!fieldErrors.date}
              />
            </Field>
            {needsQualifications ? (
              <Field
                label="Qualifications"
                htmlFor="qualifications"
                required
                hint="One per line, e.g. BSc Mathematics."
                error={fieldErrors.qualifications}
                className="sm:col-span-2"
              >
                <Textarea
                  id="qualifications"
                  value={profile.qualificationsText}
                  onChange={(e) =>
                    updateProfile("qualificationsText", e.target.value)
                  }
                  rows={3}
                />
              </Field>
            ) : null}
          </div>
        </section>

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
            {submitting ? "Saving…" : `Add ${roleLabel.toLowerCase()}`}
          </Button>
        </div>
      </form>
    </Card>
  );
}
