"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { ROUTES } from "@/lib/endpoints";
import { Badge, Card, PageHeader } from "@/components/ui";
import {
  AdminIcon,
  ChevronRightIcon,
  HeadTeacherIcon,
  PlusIcon,
  StudentsIcon,
  TeachersIcon,
} from "@/components/icons";
import { formatRoleLabel } from "@/lib/utils";

const QUICK_ACTIONS = [
  {
    href: ROUTES.newStudent,
    title: "Enroll a student",
    description: "Create a student record and link parents.",
    Icon: StudentsIcon,
    accent: "from-indigo-500 to-violet-500",
  },
  {
    href: ROUTES.newTeacher,
    title: "Add a teacher",
    description: "Onboard a new classroom teacher.",
    Icon: TeachersIcon,
    accent: "from-emerald-500 to-teal-500",
  },
  {
    href: ROUTES.newHeadTeacher,
    title: "Add a head teacher",
    description: "Senior academic leadership.",
    Icon: HeadTeacherIcon,
    accent: "from-amber-500 to-orange-500",
  },
  {
    href: ROUTES.newAdmin,
    title: "Add an administrator",
    description: "Grant another admin access.",
    Icon: AdminIcon,
    accent: "from-sky-500 to-cyan-500",
  },
];

export default function DashboardHome() {
  const { session } = useAuth();
  const user = session?.user;
  const greetingName =
    user?.firstName ||
    user?.email?.split("@")[0] ||
    "there";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={`Welcome back, ${capitalize(greetingName)}`}
        description="A quick overview of your school. Use the shortcuts below to get things done."
        action={
          user?.roles?.length ? (
            <div className="flex flex-wrap gap-2">
              {user.roles.map((r) => (
                <Badge key={r} variant="info">
                  {formatRoleLabel(r)}
                </Badge>
              ))}
            </div>
          ) : null
        }
      />

      <section aria-labelledby="quick-actions-heading">
        <h2
          id="quick-actions-heading"
          className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
        >
          Quick actions
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {QUICK_ACTIONS.map(({ href, title, description, Icon, accent }) => (
            <Link
              key={href}
              href={href}
              className="group relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
            >
              <div
                className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${accent} text-white`}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {description}
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                Get started
                <ChevronRightIcon className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section
        aria-labelledby="resources-heading"
        className="grid grid-cols-1 gap-4 lg:grid-cols-3"
      >
        <Card className="lg:col-span-2">
          <h2
            id="resources-heading"
            className="text-base font-semibold text-zinc-900 dark:text-zinc-100"
          >
            Getting started checklist
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Set up your school in a few simple steps.
          </p>
          <ol className="mt-5 flex flex-col gap-3">
            <ChecklistItem
              n={1}
              title="Add administrators"
              description="Invite trusted staff to help manage the school."
              href={ROUTES.newAdmin}
            />
            <ChecklistItem
              n={2}
              title="Onboard teachers"
              description="Add classroom and head teachers to your roster."
              href={ROUTES.newTeacher}
            />
            <ChecklistItem
              n={3}
              title="Enroll students"
              description="Create student profiles and link parent contacts."
              href={ROUTES.newStudent}
            />
          </ol>
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Account
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Signed in as
          </p>
          <div className="mt-3 space-y-2 text-sm">
            <KeyValue label="Email" value={user?.email ?? "—"} mono />
            <KeyValue label="School code" value={session?.schoolCode ?? "—"} mono />
            {user?.roles?.length ? (
              <KeyValue
                label="Roles"
                value={user.roles.map(formatRoleLabel).join(", ")}
              />
            ) : null}
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-900">
            <Link
              href={ROUTES.school}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
            >
              School profile and subscription
            </Link>
            <Link
              href={ROUTES.directory}
              className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-300"
            >
              Find someone in this school
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
}

function ChecklistItem({
  n,
  title,
  description,
  href,
}: {
  n: number;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <li className="flex items-start gap-4 rounded-lg border border-zinc-100 p-4 transition hover:border-zinc-200 dark:border-zinc-900 dark:hover:border-zinc-800">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {title}
        </p>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1 self-center rounded-lg border border-transparent bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Start
      </Link>
    </li>
  );
}

function KeyValue({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-zinc-100 pb-2 last:border-0 last:pb-0 dark:border-zinc-900">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`min-w-0 truncate text-right text-sm text-zinc-800 dark:text-zinc-200 ${mono ? "font-mono" : ""}`}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
