// Dropdown options for the staff profile enums, shared by the "add staff"
// forms and the role-change form so the two never drift apart. Values mirror
// the backend enums exactly; only the labels are ours.

import type {
  AdminLevel,
  AdminStatus,
  EmploymentType,
  HeadTeacherPosition,
  HeadTeacherStatus,
  RoleChangeType,
  TargetRole,
} from "./types";

export const EMPLOYMENT_TYPES: { value: EmploymentType; label: string }[] = [
  { value: "FULL_TIME", label: "Full-time" },
  { value: "PART_TIME", label: "Part-time" },
  { value: "CONTRACT", label: "Contract" },
];

export const HEAD_TEACHER_POSITIONS: {
  value: HeadTeacherPosition;
  label: string;
}[] = [
  { value: "MAIN", label: "Main" },
  { value: "ASSISTANT", label: "Assistant" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "DOMESTIC", label: "Domestic" },
];

export const HEAD_TEACHER_STATUSES: {
  value: HeadTeacherStatus;
  label: string;
}[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "RETIRED", label: "Retired" },
  { value: "ON_LEAVE", label: "On leave" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "TERMINATED", label: "Terminated" },
];

export const ADMIN_LEVELS: { value: AdminLevel; label: string }[] = [
  { value: "MAIN", label: "Main" },
  { value: "ACADEMIC", label: "Academic" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "FEEDING", label: "Feeding" },
  { value: "FINANCIAL", label: "Financial" },
];

export const ADMIN_STATUSES: { value: AdminStatus; label: string }[] = [
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REVOKED", label: "Revoked" },
];

// Note the backend spells it HEADTEACHER (no underscore) here, unlike the
// ROLE_HEAD_TEACHER authority in the JWT.
export const TARGET_ROLES: { value: TargetRole; label: string }[] = [
  { value: "TEACHER", label: "Teacher" },
  { value: "HEADTEACHER", label: "Head teacher" },
  { value: "ADMIN", label: "Administrator" },
  { value: "PARENT", label: "Parent" },
  { value: "STUDENT", label: "Student" },
];

export const ROLE_CHANGE_TYPES: {
  value: RoleChangeType;
  label: string;
  description: string;
}[] = [
  {
    value: "ADD",
    label: "Add this role",
    description:
      "Keeps everything the person can do today and grants the new role alongside it.",
  },
  {
    value: "TRANSFER",
    label: "Transfer to this role",
    description:
      "Replaces the current role. Use when someone moves job rather than takes on extra duties.",
  },
];

// STUDENT and PARENT have no employment profile to fill in.
export function roleNeedsProfile(role: TargetRole): boolean {
  return role === "TEACHER" || role === "HEADTEACHER" || role === "ADMIN";
}
