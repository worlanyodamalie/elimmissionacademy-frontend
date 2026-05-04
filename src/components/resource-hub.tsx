import Link from "next/link";
import { Card, PageHeader } from "./ui";
import { ResendOnboardingCard } from "./resend-onboarding-card";
import { ChevronRightIcon, PlusIcon } from "./icons";

type Props = {
  title: string;
  description: string;
  newHref: string;
  newLabel: string;
  highlights?: { label: string; description: string }[];
};

export function ResourceHub({
  title,
  description,
  newHref,
  newLabel,
  highlights,
}: Props) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        description={description}
        action={
          <Link
            href={newHref}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <PlusIcon className="h-4 w-4" />
            {newLabel}
          </Link>
        }
      />

      {highlights && highlights.length > 0 ? (
        <Card>
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {highlights.map((h) => (
              <li key={h.label} className="flex items-start gap-4 py-4 first:pt-0 last:pb-0">
                <ChevronRightIcon className="mt-1 h-4 w-4 shrink-0 text-indigo-500" />
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {h.label}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                    {h.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <ResendOnboardingCard />
    </div>
  );
}
