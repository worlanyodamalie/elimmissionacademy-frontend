import { cn } from "@/lib/utils";

export function Logo({
  size = "md",
  showWordmark = true,
  className,
}: {
  size?: "sm" | "md" | "lg";
  showWordmark?: boolean;
  className?: string;
}) {
  const dim = size === "sm" ? 28 : size === "lg" ? 44 : 36;
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 text-white shadow-sm"
        style={{ width: dim, height: dim }}
        aria-hidden
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          className="h-[60%] w-[60%]"
        >
          <path
            d="M12 3 2 8l10 5 10-5-10-5Z"
            fill="currentColor"
            opacity="0.95"
          />
          <path
            d="M6 10.5v4.2c0 .9.5 1.7 1.3 2.1l3.7 1.9c.6.3 1.4.3 2 0l3.7-1.9c.8-.4 1.3-1.2 1.3-2.1v-4.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M22 8v6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {showWordmark ? (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            Elim Mission
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            Academy
          </span>
        </div>
      ) : null}
    </div>
  );
}
