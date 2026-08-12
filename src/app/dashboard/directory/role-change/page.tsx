"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui";
import { DateInput } from "@/components/date-input";
import { ChevronRightIcon } from "@/components/icons";
import { useToast } from "@/components/toast";
import { apiRequest } from "@/lib/api";
import { ROUTES, USERS } from "@/lib/endpoints";
import {
  ADMIN_LEVELS,
  ADMIN_STATUSES,
  EMPLOYMENT_TYPES,
  HEAD_TEACHER_POSITIONS,
  HEAD_TEACHER_STATUSES,
  ROLE_CHANGE_TYPES,
  TARGET_ROLES,
  roleNeedsProfile,
} from "@/lib/staff-options";
import {
  email as emailValidator,
  ghanaMobile,
  hasErrors,
  normalizeGhanaMobile,
  validateAll,
} from "@/lib/validation";
import type {
  AdminLevel,
  AdminStatus,
  ApiError,
  EmploymentProfileDetails,
  EmploymentType,
  HeadTeacherPosition,
  HeadTeacherStatus,
  RoleChangePayload,
  RoleChangeType,
  TargetRole,
} from "@/lib/types";

export default function RoleChangePage() {
  return (
    <Suspense fallback={null}>
      <RoleChangeForm />
    </Suspense>
  );
}

function RoleChangeForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();

  // Prefilled when arriving from a directory row.
  const [form, setForm] = useState({
    email: params.get("email") ?? "",
    mobileNumber: params.get("mobileNumber") ?? "",
    targetRole: "TEACHER" as TargetRole,
    changeType: "ADD" as RoleChangeType,
  });
  const [profile, setProfile] = useState({
    qualificationsText: "",
    employmentType: "FULL_TIME" as EmploymentType,
    dateEmployed: "",
    position: "MAIN" as HeadTeacherPosition,
    headTeacherStatus: "ACTIVE" as HeadTeacherStatus,
    dateAppointed: "",
    adminLevel: "MAIN" as AdminLevel,
    adminStatus: "ACTIVE" as AdminStatus,
    dateAssigned: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    mobileNumber?: string;
    date?: string;
    qualifications?: string;
  }>({});

  const needsProfile = roleNeedsProfile(form.targetRole);
  const changeTypeInfo = ROLE_CHANGE_TYPES.find(
    (t) => t.value === form.changeType,
  );

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

  // The date field the selected role actually requires.
  function profileDate(): string {
    if (form.targetRole === "TEACHER") return profile.dateEmployed;
    if (form.targetRole === "HEADTEACHER") return profile.dateAppointed;
    return profile.dateAssigned;
  }

  function buildProfileDetails(): EmploymentProfileDetails {
    if (form.targetRole === "TEACHER") {
      return {
        teacherProfile: {
          qualifications: parseQualifications(),
          employmentType: profile.employmentType,
          dateEmployed: profile.dateEmployed,
        },
      };
    }
    if (form.targetRole === "HEADTEACHER") {
      return {
        headTeacherProfile: {
          position: profile.position,
          qualifications: parseQualifications(),
          status: profile.headTeacherStatus,
          dateAppointed: profile.dateAppointed,
        },
      };
    }
    if (form.targetRole === "ADMIN") {
      return {
        adminProfile: {
          adminLevel: profile.adminLevel,
          profileStatus: profile.adminStatus,
          dateAssigned: profile.dateAssigned,
        },
      };
    }
    // STUDENT and PARENT carry no employment profile.
    return {};
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errors: typeof fieldErrors = validateAll(
      { email: form.email, mobileNumber: form.mobileNumber },
      {
        email: (v) => (!v.trim() ? "Email is required." : emailValidator(v)),
        mobileNumber: (v) =>
          !v.trim() ? "Mobile number is required." : ghanaMobile(v),
      },
    );

    if (needsProfile) {
      if (!profileDate()) errors.date = "This date is required.";
      if (
        (form.targetRole === "TEACHER" ||
          form.targetRole === "HEADTEACHER") &&
        parseQualifications().length === 0
      ) {
        errors.qualifications = "Add at least one qualification.";
      }
    }

    setFieldErrors(errors);
    if (hasErrors(errors)) {
      setError("Please fix the highlighted fields and try again.");
      return;
    }

    setSubmitting(true);
    try {
      const payload: RoleChangePayload = {
        email: form.email.trim(),
        mobileNumber: normalizeGhanaMobile(form.mobileNumber),
        targetRole: form.targetRole,
        changeType: form.changeType,
        profileDetails: buildProfileDetails(),
      };
      await apiRequest(USERS.roleChange, { method: "PATCH", body: payload });
      toast({
        title: "Role updated",
        description:
          form.changeType === "ADD"
            ? `${form.email} now also has the ${roleLabel(form.targetRole)} role.`
            : `${form.email} has been moved to the ${roleLabel(
                form.targetRole,
              )} role.`,
        variant: "success",
      });
      router.push(ROUTES.directory);
    } catch (err) {
      const apiErr = err as ApiError;
      setError(
        apiErr.status === 404
          ? "No user in this school has that email address."
          : (apiErr.message ?? "Could not change the role."),
      );
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
              href={ROUTES.directory}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              People
            </Link>
          </li>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <li className="font-medium text-zinc-900 dark:text-zinc-100">
            Change a role
          </li>
        </ol>
      </nav>

      <PageHeader
        title="Change someone's role"
        description="Move a person to a different role, or give them a second one — the account, email and password stay the same."
      />

      <Card>
        {error ? (
          <div className="mb-4">
            <Alert variant="error" title="Could not change the role">
              {error}
            </Alert>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8" noValidate>
          <section className="flex flex-col gap-4">
            <header>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Who
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                The person is matched on both fields, so they must be the ones
                already on the account.
              </p>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                htmlFor="rc-email"
                required
                error={fieldErrors.email}
              >
                <Input
                  id="rc-email"
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  autoComplete="off"
                  required
                  invalid={!!fieldErrors.email}
                />
              </Field>
              <Field
                label="Mobile number"
                htmlFor="rc-mobile"
                required
                hint={
                  fieldErrors.mobileNumber
                    ? undefined
                    : "Ghanaian number, e.g. +233241234567 or 0241234567."
                }
                error={fieldErrors.mobileNumber}
              >
                <Input
                  id="rc-mobile"
                  type="tel"
                  value={form.mobileNumber}
                  onChange={(e) =>
                    setForm({ ...form, mobileNumber: e.target.value })
                  }
                  required
                  invalid={!!fieldErrors.mobileNumber}
                />
              </Field>
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <header>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                New role
              </h2>
            </header>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Role" htmlFor="rc-role" required>
                <Select
                  id="rc-role"
                  value={form.targetRole}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      targetRole: e.target.value as TargetRole,
                    })
                  }
                >
                  {TARGET_ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Change type"
                htmlFor="rc-type"
                required
                hint={changeTypeInfo?.description}
              >
                <Select
                  id="rc-type"
                  value={form.changeType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      changeType: e.target.value as RoleChangeType,
                    })
                  }
                >
                  {ROLE_CHANGE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </section>

          {needsProfile ? (
            <section className="flex flex-col gap-4">
              <header>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  {roleLabel(form.targetRole)} profile
                </h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Details for the role being granted.
                </p>
              </header>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {form.targetRole === "TEACHER" ? (
                  <>
                    <Field
                      label="Employment type"
                      htmlFor="rc-employmentType"
                      required
                    >
                      <Select
                        id="rc-employmentType"
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
                    <Field
                      label="Date employed"
                      htmlFor="rc-dateEmployed"
                      required
                      error={fieldErrors.date}
                    >
                      <DateInput
                        id="rc-dateEmployed"
                        value={profile.dateEmployed}
                        onChange={(value) =>
                          updateProfile("dateEmployed", value)
                        }
                        required
                        invalid={!!fieldErrors.date}
                      />
                    </Field>
                  </>
                ) : null}

                {form.targetRole === "HEADTEACHER" ? (
                  <>
                    <Field label="Position" htmlFor="rc-position" required>
                      <Select
                        id="rc-position"
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
                    <Field label="Status" htmlFor="rc-htStatus" required>
                      <Select
                        id="rc-htStatus"
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
                    <Field
                      label="Date appointed"
                      htmlFor="rc-dateAppointed"
                      required
                      error={fieldErrors.date}
                    >
                      <DateInput
                        id="rc-dateAppointed"
                        value={profile.dateAppointed}
                        onChange={(value) =>
                          updateProfile("dateAppointed", value)
                        }
                        required
                        invalid={!!fieldErrors.date}
                      />
                    </Field>
                  </>
                ) : null}

                {form.targetRole === "ADMIN" ? (
                  <>
                    <Field label="Admin level" htmlFor="rc-adminLevel" required>
                      <Select
                        id="rc-adminLevel"
                        value={profile.adminLevel}
                        onChange={(e) =>
                          updateProfile(
                            "adminLevel",
                            e.target.value as AdminLevel,
                          )
                        }
                      >
                        {ADMIN_LEVELS.map((l) => (
                          <option key={l.value} value={l.value}>
                            {l.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Status" htmlFor="rc-adminStatus" required>
                      <Select
                        id="rc-adminStatus"
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
                    <Field
                      label="Date assigned"
                      htmlFor="rc-dateAssigned"
                      required
                      error={fieldErrors.date}
                    >
                      <DateInput
                        id="rc-dateAssigned"
                        value={profile.dateAssigned}
                        onChange={(value) =>
                          updateProfile("dateAssigned", value)
                        }
                        required
                        invalid={!!fieldErrors.date}
                      />
                    </Field>
                  </>
                ) : null}

                {form.targetRole === "TEACHER" ||
                form.targetRole === "HEADTEACHER" ? (
                  <Field
                    label="Qualifications"
                    htmlFor="rc-qualifications"
                    required
                    hint="One per line, e.g. BSc Mathematics."
                    error={fieldErrors.qualifications}
                    className="sm:col-span-2"
                  >
                    <Textarea
                      id="rc-qualifications"
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
          ) : (
            <Alert variant="info" title="No profile needed">
              {roleLabel(form.targetRole)} accounts carry no employment
              profile, so there is nothing else to fill in.
            </Alert>
          )}

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
              {submitting ? "Saving…" : "Change role"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function roleLabel(role: TargetRole): string {
  return TARGET_ROLES.find((r) => r.value === role)?.label ?? role;
}
