"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "./logo";
import { ROUTES } from "@/lib/endpoints";
import { cn, formatRoleLabel, getInitials } from "@/lib/utils";
import {
  AdminIcon,
  CalendarIcon,
  CloseIcon,
  HeadTeacherIcon,
  HomeIcon,
  LogoutIcon,
  MenuIcon,
  StudentsIcon,
  TeachersIcon,
} from "./icons";

type NavItem = {
  href: string;
  label: string;
  description?: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

const NAV: NavItem[] = [
  {
    href: ROUTES.dashboard,
    label: "Overview",
    description: "Quick stats and shortcuts",
    icon: HomeIcon,
  },
  {
    href: ROUTES.students,
    label: "Students",
    description: "Enroll students with parents",
    icon: StudentsIcon,
  },
  {
    href: ROUTES.teachers,
    label: "Teachers",
    description: "Add classroom teachers",
    icon: TeachersIcon,
  },
  {
    href: ROUTES.headTeachers,
    label: "Head teachers",
    description: "Senior academic staff",
    icon: HeadTeacherIcon,
  },
  {
    href: ROUTES.admins,
    label: "Administrators",
    description: "Other admin accounts",
    icon: AdminIcon,
  },
  {
    href: ROUTES.academics,
    label: "Academics",
    description: "Academic years and terms",
    icon: CalendarIcon,
  },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !session) {
      const target = `${ROUTES.login}?from=${encodeURIComponent(
        pathname || ROUTES.dashboard,
      )}`;
      router.replace(target);
    }
  }, [session, loading, router, pathname]);

  const closeSidebar = () => setSidebarOpen(false);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div
          aria-hidden
          className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-indigo-600 dark:border-zinc-800 dark:border-t-indigo-400"
        />
      </div>
    );
  }

  const user = session.user;
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Account";
  const primaryRole = user?.roles?.[0];

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-[#0a0a0b] lg:flex-row">
      {/* Mobile overlay */}
      {sidebarOpen ? (
        <div
          aria-hidden
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-zinc-900/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 transform flex-col border-r border-zinc-200 bg-white transition-transform duration-200 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <Link href={ROUTES.dashboard} onClick={closeSidebar}>
            <Logo />
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100 lg:hidden"
            aria-label="Close menu"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 pb-1 pt-3">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              School code
            </p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {session.schoolCode}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Primary">
          <ul className="flex flex-col gap-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === ROUTES.dashboard
                  ? pathname === ROUTES.dashboard
                  : pathname?.startsWith(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={closeSidebar}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-start gap-3 rounded-lg px-3 py-2.5 text-sm transition",
                      active
                        ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100"
                        : "text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 shrink-0",
                        active
                          ? "text-indigo-600 dark:text-indigo-300"
                          : "text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300",
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium leading-5">
                        {item.label}
                      </span>
                      {item.description ? (
                        <span
                          className={cn(
                            "block truncate text-xs",
                            active
                              ? "text-indigo-700/80 dark:text-indigo-200/80"
                              : "text-zinc-500 dark:text-zinc-400",
                          )}
                        >
                          {item.description}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">
              {getInitials(user?.firstName, user?.lastName, "U")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {displayName}
              </p>
              <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                {formatRoleLabel(primaryRole)}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-md p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogoutIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/80 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            aria-label="Open menu"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <Logo size="sm" showWordmark={false} />
          <p className="ml-1 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Elim Mission Academy
          </p>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
