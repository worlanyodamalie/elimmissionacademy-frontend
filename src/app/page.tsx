"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Logo } from "@/components/logo";
import { ROUTES } from "@/lib/endpoints";

export default function Home() {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(session ? ROUTES.dashboard : ROUTES.login);
  }, [session, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Logo size="lg" />
        <div
          aria-hidden
          className="h-1 w-32 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        >
          <div className="h-full w-1/3 animate-pulse bg-indigo-500" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Preparing your workspace…
        </p>
      </div>
    </div>
  );
}
