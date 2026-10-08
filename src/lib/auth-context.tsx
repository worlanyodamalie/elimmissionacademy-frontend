"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import {
  type AuthSession,
  apiRequest,
  clearSession,
  decodeJwt,
  readSession,
  writeSession,
} from "./api";
import { AUTH } from "./endpoints";
import type { LoginResponse } from "./types";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  login: (input: {
    login: string;
    password: string;
    schoolCode: string;
  }) => Promise<AuthSession>;
  logout: () => void;
  refresh: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function subscribeAuth(callback: () => void): () => void {
  window.addEventListener("ema-auth-change", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("ema-auth-change", callback);
    window.removeEventListener("storage", callback);
  };
}

// Caching the snapshot avoids `useSyncExternalStore` re-render warnings caused
// by `readSession()` returning a fresh object each call.
let cachedSnapshot: AuthSession | null = null;
let cachedSnapshotKey = "";

// `undefined` means "not read yet". The server render and the hydration render
// must return the same thing, and neither can touch localStorage — so they
// report unknown rather than null. Returning null there is what made the app
// think it was signed out for one render on every reload, redirect to /login,
// and bounce back once the real session landed.
function getSnapshot(): AuthSession | null | undefined {
  const next = readSession();
  const key = next ? `${next.token}|${next.schoolCode}` : "";
  if (key !== cachedSnapshotKey) {
    cachedSnapshot = next;
    cachedSnapshotKey = key;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): AuthSession | null | undefined {
  return undefined;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(
    subscribeAuth,
    getSnapshot,
    getServerSnapshot,
  );
  // Until the client has read localStorage the answer is unknown, not "logged
  // out". Callers must gate on `loading` before acting on a null session.
  const loading = snapshot === undefined;
  const session = snapshot ?? null;

  // Expiry is handled in `apiRequest`, not here: it ends the session the first
  // time a call is made with a lapsed token, and the redirect below does the
  // rest. This provider only reflects whatever is in storage.
  //
  // It used to do nothing at all, on the reasoning that signing people out
  // hourly with no way to renew was worse than leaving them be. It wasn't —
  // the app went on looking signed in while every request failed 401 with an
  // empty body, so the UI blamed the server. An hourly sign-out that says why
  // and returns you to the page you were on is the honest version of the same
  // interruption.
  //
  // The real fix is backend-side and half-built: login already returns a
  // `refreshToken` (492 chars, alongside `expiresIn: 3600000`), there is just
  // no endpoint to redeem it — docs/API-GAPS.md §O12.

  const login = useCallback<AuthContextValue["login"]>(
    async ({ login: identifier, password, schoolCode }) => {
      const response = await apiRequest<LoginResponse>(AUTH.login, {
        method: "POST",
        body: { login: identifier, password },
        schoolCode,
        auth: false,
      });

      const token =
        response?.token ??
        response?.accessToken ??
        (typeof response === "string" ? response : undefined);

      if (!token || typeof token !== "string") {
        throw {
          message:
            "Login succeeded but no token was returned. Contact your administrator.",
        };
      }

      const claims = decodeJwt(token) ?? {};
      const next: AuthSession = {
        token,
        schoolCode:
          (claims.schoolCode as string | undefined) ??
          response.schoolCode ??
          schoolCode,
        user: {
          userId: claims.userId as number | undefined,
          email: (claims.sub as string | undefined) ?? response.user?.email,
          roles: (claims.roles as string[] | undefined) ?? response.user?.roles,
          // The token names the school `tenantId` (seen equal to the
          // numeric `schoolId` on WOR_9fe69, 2026-10-08); `useSchoolId` still
          // falls back to reading it off a list if neither claim is there.
          schoolId: (claims.schoolId ?? claims.tenantId) as number | undefined,
          schoolCode:
            (claims.schoolCode as string | undefined) ??
            response.user?.schoolCode,
          firstName: response.user?.firstName,
          lastName: response.user?.lastName,
        },
      };

      writeSession(next);
      return next;
    },
    [],
  );

  const logout = useCallback(() => {
    clearSession();
  }, []);

  const refresh = useCallback(() => {
    // Re-broadcast so subscribers re-read from storage.
    window.dispatchEvent(new Event("ema-auth-change"));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, loading, login, logout, refresh }),
    [session, loading, login, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
