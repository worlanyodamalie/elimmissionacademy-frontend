import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { StaffForm } from "@/components/staff-form";
import { ChevronRightIcon } from "@/components/icons";
import { ROUTES, USERS } from "@/lib/endpoints";

export default function NewAdminPage() {
  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <ol className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <li>
            <Link
              href={ROUTES.admins}
              className="hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              Administrators
            </Link>
          </li>
          <ChevronRightIcon className="h-3.5 w-3.5" />
          <li className="font-medium text-zinc-900 dark:text-zinc-100">
            New administrator
          </li>
        </ol>
      </nav>
      <PageHeader
        title="Add an administrator"
        description="Grant another person admin access. They'll receive an onboarding link by email."
      />
      <StaffForm
        endpoint={USERS.admins}
        roleLabel="Administrator"
        redirectTo={ROUTES.admins}
      />
    </div>
  );
}
