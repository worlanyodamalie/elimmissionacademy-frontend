
import type { ApiError } from "./types";

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL;

if (!RAW_API_BASE_URL) {
  // Fail fast at module load so a misconfigured deploy is obvious.
  throw new Error(
    "NEXT_PUBLIC_BACKEND_API_BASE_URL is not set. Copy .env.example to .env.local and configure it.",
  );
}

export const API_BASE_URL: string = RAW_API_BASE_URL.replace(/\/$/, "");

const TOKEN_KEY = "ema.auth.token";
const SCHOOL_CODE_KEY = "ema.auth.schoolCode";
const USER_KEY = "ema.auth.user";
// Remembered separately from the session: survives logout so the user
// doesn't have to memorize/retype the school code at the next sign-in.
const LAST_SCHOOL_CODE_KEY = "ema.last.schoolCode";

export function rememberSchoolCode(code: string) {
  if (typeof window === "undefined" || !code) return;
  window.localStorage.setItem(LAST_SCHOOL_CODE_KEY, code);
}

export function readLastSchoolCode(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SCHOOL_CODE_KEY);
}

export type AuthSession = {
  token: string;
  schoolCode: string;
  user?: {
    userId?: number;
    email?: string;
    firstName?: string;
    lastName?: string;
    roles?: string[];
    schoolId?: number;
    schoolCode?: string;
  };
};

export function readSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const schoolCode = window.localStorage.getItem(SCHOOL_CODE_KEY);
  if (!token || !schoolCode) return null;
  const userRaw = window.localStorage.getItem(USER_KEY);
  return {
    token,
    schoolCode,
    user: userRaw ? safeJson(userRaw) : undefined,
  };
}

export function writeSession(session: AuthSession) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(SCHOOL_CODE_KEY, session.schoolCode);
  // Always remember the most recent school code so login can pre-fill it.
  window.localStorage.setItem(LAST_SCHOOL_CODE_KEY, session.schoolCode);
  if (session.user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }
  window.dispatchEvent(new Event("ema-auth-change"));
}

export function clearSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(SCHOOL_CODE_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event("ema-auth-change"));
}

function safeJson<T = unknown>(raw: string): T | undefined {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded =
      typeof atob === "function"
        ? atob(normalized)
        : Buffer.from(normalized, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  body?: unknown;
  query?: Record<string, string | undefined>;
  schoolCode?: string;
  token?: string;
  auth?: boolean;
  signal?: AbortSignal;
};

export async function apiRequest<T = unknown>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const session = options.auth !== false ? readSession() : null;
  const token = options.token ?? session?.token;
  const schoolCode = options.schoolCode ?? session?.schoolCode;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const fullPath = `${API_BASE_URL}${cleanPath}`;
  const base =
    typeof window !== "undefined" ? window.location.origin : "http://localhost";
  const url = new URL(fullPath, base);
  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (schoolCode) headers["X-School-Code"] = schoolCode;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url.toString(), {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? safeJson(text) ?? text : null;

  if (!res.ok) {
    const message = extractErrorMessage(data) ?? `Request failed (${res.status})`;
    const err: ApiError = {
      message,
      status: res.status,
      details: data,
    };
    throw err;
  }

  return data as T;
}

function extractErrorMessage(data: unknown): string | undefined {
  if (!data) return undefined;
  if (typeof data === "string") return data;
  if (typeof data === "object" && data !== null) {
    const obj = data as Record<string, unknown>;
    const candidates = [
      obj.message,
      obj.error,
      obj.detail,
      obj.errorMessage,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c;
    }
    if (Array.isArray(obj.errors) && obj.errors.length > 0) {
      const first = obj.errors[0];
      if (typeof first === "string") return first;
      if (first && typeof first === "object" && "message" in first) {
        const m = (first as Record<string, unknown>).message;
        if (typeof m === "string") return m;
      }
    }
  }
  return undefined;
}
