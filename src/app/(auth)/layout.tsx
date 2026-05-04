import Link from "next/link";
import { Logo } from "@/components/logo";
import { ROUTES } from "@/lib/endpoints";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-black">
      <header className="flex items-center justify-between px-6 py-5 sm:px-8">
        <Link
          href={ROUTES.home}
          className="rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          <Logo />
        </Link>
        <Link
          href={ROUTES.registerSchool}
          className="hidden text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 sm:inline"
        >
          New school? Register here
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-12 pt-4 sm:px-6">
        <div className="w-full">
          <div className="mx-auto w-full max-w-md [&:has([data-auth-wide])]:max-w-2xl">
            {children}
          </div>
        </div>
      </main>
      <footer className="px-6 pb-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
        © {new Date().getFullYear()} Elim Mission Academy
      </footer>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-700/20" />
      </div>
    </div>
  );
}
