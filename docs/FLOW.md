# Dashboard flow

End-to-end walkthrough of how the Elim Mission Academy dashboard behaves —
from the moment a school registers, to managing students and staff. Pair this
with [`URLS.md`](./URLS.md) for the route + endpoint reference.

---

## 1. High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser                                                            │
│                                                                    │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐  │
│  │ App Router   │    │ AuthProvider (useSyncExternalStore)      │  │
│  │ (Next.js 16) │◄──►│  └─ reads/writes session to localStorage │  │
│  └──────┬───────┘    └──────────────────────────────────────────┘  │
│         │                                                          │
│         ▼                                                          │
│  ┌──────────────┐    ┌──────────────────────────────────────────┐  │
│  │ Pages /      │    │ apiRequest() wrapper                      │  │
│  │ Components   │───►│  - injects X-School-Code                  │  │
│  │              │    │  - injects Authorization: Bearer <jwt>    │  │
│  │              │    │  - normalizes errors                      │  │
│  └──────────────┘    └──────────────┬───────────────────────────┘  │
└────────────────────────────────────────│───────────────────────────┘
                                         │  HTTPS (JSON)
                                         ▼
                         ┌──────────────────────────────────────┐
                         │ Backend API                          │
                         │ NEXT_PUBLIC_BACKEND_API_BASE_URL/... │
                         └──────────────────────────────────────┘
```

- **Routing**: file-system based, App Router. All pages are static (`○`) until
  they hydrate; data calls happen client-side from `apiRequest`.
- **State**: there is no global Redux/Zustand store. Auth lives in
  `localStorage`, surfaced through `useSyncExternalStore` so all tabs stay in
  sync. Form state is local to each page.
- **Styling**: Tailwind v4 utility classes + a small set of primitives in
  `src/components/ui.tsx`.

---

## 2. The session and how it travels

| Layer                | Where it lives                                    |
| -------------------- | ------------------------------------------------- |
| Token (JWT)          | `localStorage["ema.auth.token"]`                  |
| School code          | `localStorage["ema.auth.schoolCode"]`             |
| User profile / claims| `localStorage["ema.auth.user"]`                   |
| In-memory snapshot   | `useSyncExternalStore` driven by `readSession()`  |

**Read path** — every component that calls `useAuth()` gets a typed
`AuthSession | null`. The store subscribes to:

- `storage` — DOM event raised by other tabs.
- `ema-auth-change` — a custom event we dispatch from `writeSession()` and
  `clearSession()` so the active tab also reacts.

**Outgoing requests** — `apiRequest()` (in `src/lib/api.ts`) auto-injects:

- `X-School-Code: <session.schoolCode>` (multi-tenant routing)
- `Authorization: Bearer <session.token>` (when `auth !== false`)

Pages can override either header (`schoolCode`, `token` options) for the
public flows where the user types the school code in the form before they
have a session.

---

## 3. The user journeys

### 3.1 New school onboarding

```
[Marketing site / direct link]
        │
        ▼
/register-school                  ← public
  ├ user fills school + admin form
  ├ POST /auth/school/register    (AUTH.registerSchool)
  ▼
"Check your email" success card
        │
        │  (admin opens email link)
        ▼
/admin-setup?token=<uuid>&schoolCode=ELI_xxxxx   ← public, link-gated
  ├ token + schoolCode pre-filled from URL
  ├ admin chooses password (validated: ≥ 8 chars, confirm match)
  ├ POST /auth/school/admin/setup  (AUTH.adminAccountSetup)
  ▼
Redirect → /login?school=ELI_xxxxx
```

### 3.2 Returning user sign-in

```
/login
  ├ school code + email/username + password
  ├ validation: required + school-code shape
  ├ POST /auth/login               (AUTH.login, X-School-Code header)
  ├ on success:
  │   ├ decode JWT → roles, userId, schoolId, schoolCode
  │   ├ writeSession({ token, schoolCode, user })
  │   └ navigate to ?from=... or /dashboard
  └ on failure: inline alert, focus stays on the form
```

### 3.3 Forgot / reset password

```
/forgot-password                    ← public
  ├ school code + email
  ├ POST /auth/forgot-password      (AUTH.forgotPassword)
  ▼
"Check your inbox" success card
        │ (email link)
        ▼
/reset-password?token=<uuid>&schoolCode=ELI_xxxxx
  ├ new password + confirm
  ├ POST /auth/reset-password       (AUTH.resetPassword)
  ▼
toast: "Password reset" → /login?school=ELI_xxxxx
```

### 3.4 Invited user activation

```
Email invite from admin
        │
        ▼
/setup-password?token=<uuid>&schoolCode=ELI_xxxxx
  ├ new password + confirm
  ├ POST /auth/users/setup-password (USERS.setupPassword)
  ▼
toast: "Password set" → /login?school=ELI_xxxxx
```

### 3.5 Admin runtime: managing the school

```
/dashboard
  │   ┌──────────────────────────────────────────────┐
  │   │ DashboardShell                                │
  │   │  - sidebar (Overview, Students, Teachers,     │
  │   │    Head teachers, Admins)                     │
  │   │  - school-code badge                          │
  │   │  - user card + sign-out                       │
  │   │  - mobile drawer                              │
  │   └──────────────────────────────────────────────┘
  │
  ├──► /dashboard/students          (hub + resend-onboarding)
  │      └──► /dashboard/students/new
  │             ├ student details (validated: name, DOB ≤ today, address)
  │             ├ N parents/guardians, exactly one primary contact
  │             ├ each parent can copy the student's address
  │             └ POST /auth/users/students   (USERS.students)
  │
  ├──► /dashboard/teachers          → /dashboard/teachers/new
  │      └ POST /auth/users/teachers          (USERS.teachers)
  │
  ├──► /dashboard/head-teachers     → /dashboard/head-teachers/new
  │      └ POST /auth/users/head-teachers     (USERS.headTeachers)
  │
  └──► /dashboard/admins            → /dashboard/admins/new
         └ POST /auth/users/admins             (USERS.admins)
```

Every staff/student creation triggers a backend onboarding email.
If a teammate doesn't receive it, any of the four hub pages exposes a
**Resend onboarding** card → `POST /auth/users/resend-onboarding?email=...`.

---

## 4. Route protection

`DashboardShell` (rendered by `app/dashboard/layout.tsx`) guards every
authenticated page:

1. On mount, read the session via `useAuth()`.
2. If `loading === false && session === null`:
   `router.replace("/login?from=" + currentPath)`.
3. While `loading`, render a centered spinner — no flash of unauthenticated
   content.

Public pages do **not** force redirects when a session exists, with one
exception: `/login` redirects to the `from` query param (or `/dashboard`) so
already-signed-in users don't re-enter credentials. The root page `/` always
redirects to `/login` or `/dashboard` based on session presence.

---

## 5. Form lifecycle

Every form follows the same shape so the UX feels consistent:

```
1. Local state (one or many useState hooks)
        │
        ▼
2. handleSubmit:
        ├ e.preventDefault()
        ├ validateAll(values, rules)  ← lib/validation.ts
        ├ if errors → setFieldErrors + return (no network call)
        ├ setSubmitting(true)
        ├ apiRequest(endpoint, { method, body, query, schoolCode? })
        │       │
        │       ├ on success → toast.success + redirect / reset / show success card
        │       └ on failure → alert with normalized message
        └ finally: setSubmitting(false)
```

**Validation rules** centralized in `lib/validation.ts` cover:
- `required`, `minLength`, `maxLength`
- `email` (RFC-ish), `phone` (E.164-ish, 8–15 digits w/ optional `+`)
- `schoolCode` (3–32 chars, letters/digits/_/-)
- `password` (8–128 chars)
- `dateNotInFuture(label)`

**Field UX**:
- `<Field>` wraps every input with label, hint, and red error text.
- Inputs accept `invalid` to switch to the error border.
- `aria-invalid` is set when a field is in error.
- A summary `<Alert variant="error">` appears at the top of the form when
  the API rejects the submission, so screen readers hear it once.

---

## 6. Errors and resilience

`apiRequest` normalizes everything to:

```ts
type ApiError = {
  message: string;
  status?: number;
  details?: unknown;
};
```

It walks the response body looking for `message`, `error`, `detail`,
`errorMessage`, or `errors[0].message` so backend variations don't leak into
the UI. Pages render `apiErr.message ?? "Generic message"` inside an
`<Alert variant="error">`.

Network failures throw a regular `TypeError`; pages display a generic
"Could not …" message. We never auto-retry — the user is in control.

---

## 7. Configuration

| Variable                            | Scope   | Required | Purpose                                                                |
| ----------------------------------- | ------- | -------- | ---------------------------------------------------------------------- |
| `NEXT_PUBLIC_BACKEND_API_BASE_URL`  | browser | yes      | Backend API base URL. Throws at module load if missing.                |
| `NEXT_PUBLIC_APP_NAME`              | browser | no       | Display name for the UI.                                               |

`.env.example` is committed; `.env.local` is gitignored. No tokens, no school
codes, no test credentials are checked in.

### CORS

The browser calls the backend directly. The backend must allow each origin
the dashboard is served from (`http://localhost:3000` for local dev, plus
the production and Vercel preview URLs) in its
`Access-Control-Allow-Origin` allowlist, allow the headers we send
(`Authorization`, `Content-Type`, `X-School-Code`), and respond `2xx` to
`OPTIONS` preflight.

---

## 8. Folder map

```
src/
├── app/
│   ├── (auth)/                  ← unauthenticated layout
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── register-school/page.tsx
│   │   ├── admin-setup/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   └── setup-password/page.tsx
│   ├── dashboard/               ← authenticated layout (DashboardShell)
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← Overview
│   │   ├── students/{page,new/page}.tsx
│   │   ├── teachers/{page,new/page}.tsx
│   │   ├── head-teachers/{page,new/page}.tsx
│   │   └── admins/{page,new/page}.tsx
│   ├── globals.css
│   ├── layout.tsx               ← root <html>, providers
│   └── page.tsx                 ← /, redirects based on session
├── components/
│   ├── ui.tsx                   ← Button, Field, Input, Select, Card, Alert, …
│   ├── toast.tsx                ← ToastProvider + useToast()
│   ├── address-fields.tsx
│   ├── dashboard-shell.tsx      ← sidebar, topbar, route guard
│   ├── icons.tsx
│   ├── logo.tsx
│   ├── resend-onboarding-card.tsx
│   ├── resource-hub.tsx         ← shared "hub" UI for staff sections
│   └── staff-form.tsx           ← shared add-staff form
├── lib/
│   ├── api.ts                   ← apiRequest, session helpers, decodeJwt
│   ├── auth-context.tsx         ← useAuth + AuthProvider
│   ├── endpoints.ts             ← AUTH, USERS, ROUTES constants
│   ├── types.ts                 ← all payload + domain types
│   ├── utils.ts                 ← cn, getInitials, formatRoleLabel
│   └── validation.ts            ← email, phone, password, …
└── ...
docs/
├── URLS.md                      ← full URL & endpoint reference
└── FLOW.md                      ← (this file)
```

---

## 9. What runs on the server vs. the client?

Next.js 16 App Router renders Server Components by default. In this dashboard
**every page is a Client Component** because:

- All pages depend on `useAuth()` for route protection or greeting.
- All forms need browser-only APIs (`localStorage`, `useState`, event
  handlers).

Pure presentational helpers (`PageHeader`, `Logo`, `Card`, breadcrumbs in
`/new` pages, the resource hub) are Server Components — they have no
`"use client"` directive and never touch browser APIs. They're rendered to
HTML at build time and shipped as static markup.

If/when we add server-side data fetching (e.g. a real student roster), it
should live in a Server Component that calls `apiRequest` from `cookies()`
instead of `localStorage`, behind a `<Suspense>` boundary.

---

## 10. Extending the dashboard

Adding a new resource (e.g. classes) in three steps:

1. Add the endpoint and route to `src/lib/endpoints.ts` and document it in
   `docs/URLS.md`.
2. Create the route folder under `src/app/dashboard/<resource>/` with a hub
   page (`<ResourceHub>`) and a `new/page.tsx` for the create form. Reuse
   `<StaffForm>` if the body matches; otherwise model it on the student form.
3. Add a sidebar entry in `NAV` inside `dashboard-shell.tsx`.

Validation, toasts, route protection, error normalization, and the layout
are inherited automatically.
