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

function getSnapshot(): AuthSession | null {
  const next = readSession();
  const key = next ? `${next.token}|${next.schoolCode}` : "";
  if (key !== cachedSnapshotKey) {
    cachedSnapshot = next;
    cachedSnapshotKey = key;
  }
  return cachedSnapshot;
}

function getServerSnapshot(): AuthSession | null {
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useSyncExternalStore(
    subscribeAuth,
    getSnapshot,
    getServerSnapshot,
  );
  // After hydration, useSyncExternalStore has already read from localStorage,
  // so we never sit in a "loading" state — any null session means logged out.
  const loading = false;

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
          schoolId: claims.schoolId as number | undefined,
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
