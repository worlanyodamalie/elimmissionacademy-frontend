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
  ├ user fills three blocks: school, primary admin, subscription
  │   ├ school     — name, email, +233 mobile, address
  │   ├ admin      — name, email, mobile (gets the setup link)
  │   └ subscription — plan (BASIC|PREMIUM|ENTERPRISE),
  │                    cycle (MONTHLY|TERMLY|YEARLY),
  │                    currency (GHS|USD|EURO|GBP), optional trial
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
  │    body { password }; token in the query, school in the header
  ▼
Redirect → /login?school=ELI_xxxxx
```

### 3.2 Returning user sign-in

```
/login
  ├ school code + email/username + password
  ├ validation: required + school-code shape
  ├ POST /auth/users/login         (AUTH.login, X-School-Code header)
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
  │   │    Head teachers, Admins, People, Academics,  │
  │   │    Classes, Billing, Collections, School)     │
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
  │             ├ POST /auth/users/students   (USERS.students)
  │             └──► /dashboard/academics/enrolments?student=<name>
  │                    onboarding hands straight over — see 3.6
  │
  ├──► /dashboard/teachers          → /dashboard/teachers/new
  │      └ POST /auth/users/teachers          (USERS.teachers)
  │
  ├──► /dashboard/head-teachers     → /dashboard/head-teachers/new
  │      └ POST /auth/users/head-teachers     (USERS.headTeachers)
  │
  ├──► /dashboard/admins            → /dashboard/admins/new
  │      └ POST /auth/users/admins             (USERS.admins)
  │
  ├──► /dashboard/directory         (search everyone in the school)
  │      ├ GET /auth/users/lookup             (USERS.lookup, debounced)
  │      ├ POST /auth/users/resend-onboarding (USERS.resendOnboarding)
  │      └──► /dashboard/directory/role-change
  │             ├ email + mobile identify the person
  │             ├ ADD (extra role) or TRANSFER (replace)
  │             ├ profile block only for TEACHER/HEADTEACHER/ADMIN
  │             └ PATCH /auth/users/role-change (USERS.roleChange)
  │
  └──► /dashboard/school            (registration + subscription, read-only)
         └ GET /auth/school/{schoolId}/profile (AUTH.schoolProfile)
              school UUID is read from the JWT — see docs/API-GAPS.md §O1
```

### 3.6 Classes and enrolment: giving a student a place

Onboarding creates the *person*. Enrolment creates their *place* in the school,
and until it exists there is no class roster entry and nothing to bill against.
So `/dashboard/students/new` doesn't return to the students hub on success — it
routes to the enrolment form with the new student's name in the query string.

```
/dashboard/academics/classes            ← set up once, before anyone enrols
  ├ GET  /school/academics/class_levels        (CLASSES.classLevels)
  │    + one GET …/class_levels/lookup per class name, to recover each
  │      class's UUID — the list doesn't return it (API-GAPS §A1). Only this
  │      hub pays that cost: it needs the streams the list carries *and* the
  │      UUID it doesn't. Forms that merely name a class use the lookup alone.
  └ POST /school/academics/class_levels        (CLASSES.classLevels)
        ├ a GES level (Nursery 1 … Basic 9), optionally renamed locally
        ├ places per stream
        └ one "Main" stream, or named streams with a fill rank
        │
        ▼
/dashboard/academics/classes/[classLevelId]   ← the roster, by stream
  ├ GET …/class_levels/{uuid}                  (CLASSES.classLevel)
  └ GET …/class_levels/{uuid}/students         (CLASSES.classLevelStudents)
        │
        ▼
/dashboard/academics/enrolments?student=<name>
  ├ GET  /auth/users/students/lookup           (re-finds the student by name;
  │        selected outright when exactly one row comes back — API-GAPS §A3)
  ├ GET  …/class_levels/lookup?query=          (ClassLevelLookup: the class
  │        picker searches this endpoint directly — one request, and the row
  │        carries the numeric classLevelId the POST below needs)
  ├ GET  …/enrolments/student/{uuid}/enrolment (warns if already enrolled;
  │        a 404 here means "not enrolled", which is an ordinary state)
  └ POST /school/academics/enrolments          (CLASSES.enrolments)
        the backend picks the stream — first one with room, in fill order —
        and resolves which term inside the year the placement lands in
```

The class picker searches `…/class_levels/lookup` as you type rather than
loading every class up front. That endpoint is the only one returning the
numeric `classLevelId` *and* the UUID together, so a form needing the numeric
id gets it in a single request — where building the same picker from the list
would mean the hub's fan-out to recover ids the form never even uses.

The year picker is built from the **terms** call, not the years call: an
enrolment body takes a numeric `academicYearId` and only `AcademicTermResponse`
carries one (`academicYearOptions` in `src/lib/academics.ts`, API-GAPS §A2). A
year with no terms therefore can't be offered at all, and the form says so
rather than presenting a choice that would 400.

Streams are created with the class and can't be changed afterwards, and an
enrolment can't be withdrawn, transferred or promoted — no endpoint exists for
any of it. See [`API-GAPS.md`](./API-GAPS.md) §A4.

### 3.7 Money in: billing then collecting

```
/dashboard/billing/service-costs        ← set up once per fee schedule
  └ POST /school/payments/service-costs        (BILLING.serviceCosts)
        │  mandatory entries auto-apply to new bills
        ▼
/dashboard/billing                      ← per student, per term
  ├ POST /school/payments/student-bills        (BILLING.studentBills)
  ├ GET  /school/payments/student-bills        (paginated table)
  └ POST …/student-bills/arrears/carry-forward (moves an unpaid balance)
        │
        ▼
/dashboard/billing/bills/[publicId]     ← the bill itself
  ├ GET  …/student-bills/{publicId}            (bill + line items)
  ├ add a charge, two ways:
  │    ├ POST …/bill-line-items/service-cost   (priced from the list)
  │    └ POST …/bill-line-items/manual         (ad-hoc, reason required)
  └ POST /school/payments                      (record money received)
        │
        ▼
/dashboard/collections                  ← the cash office
  ├ POST /school/cash-sessions                 (open a till + float)
  ├ POST /school/payments                      (cash carries the session id)
  ├ POST /school/cash-sessions/{id}/close      (count → variance)
  └ POST /school/cash-sessions/{id}/approve    (supervisor sign-off)
```

Supporting screens: `/dashboard/billing/charges` lists every line item with the
backend's filter object (status, category, source, student, due-date window),
`/dashboard/billing/overdue` is the fee-chasing worklist (same endpoint, pinned
to `paymentStatus` + `dueDateTo` and sorted `dueDate,asc`), and
`/dashboard/billing/discounts` creates discounts plus the rules that award them
automatically.

There is deliberately **no finance dashboard** yet: the API exposes no summary
endpoint and `Page` returns counts but never sums, so every headline figure would
have to be computed by paging the whole ledger client-side. The overdue page
shows aging as *counts* (one `size=1` request per bucket, reading
`totalElements`) and never totals money across pages, for the same reason. See
[`API-GAPS.md`](./API-GAPS.md) §1c and §7.

Two constraints shape these screens, both from the API:

- **Numeric ids in bodies, UUIDs in paths.** Where no list response exposes the
  numeric id a form needs, the field is a plain number input with an explanatory
  hint (`NumericIdField`). Every instance is logged in
  [`API-GAPS.md`](./API-GAPS.md) §1.
- **No endpoint lists cash sessions.** `/dashboard/collections` remembers session
  UUIDs per device in `localStorage` via `src/lib/cash-session-store.ts`, read
  through `useSyncExternalStore` like the auth session. A "look up a session"
  card pulls in sessions opened elsewhere.

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
        ├ if errors → setFieldErrors + focusFirstError + return (no network call)
        ├ setSubmitting(true)
        ├ apiRequest(endpoint, { method, body, query, schoolCode? })
        │       │
        │       ├ on success → toast.success + redirect / reset / show success card
        │       └ on failure → setError → <FormError> beside the submit button
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

**Where an error appears** (`src/components/form-error.tsx`). The top of a long
form is the one place we know the user isn't looking, having just clicked submit
at the bottom, so nothing is reported there:

- **Validation** — `focusFirstError` scrolls to the offending field and puts the
  cursor in it. The field's own inline message is the explanation; there is no
  banner, which would only be a second thing to scroll back to. "First" is
  decided by document order, and `idsByKey` maps a validation key to its input
  id where the two differ (they usually do — `dateOfBirth` → `s-dob`, and each
  parent card on `students/new` prefixes its ids with `p{index}-`).
- **Server** — nothing in the form is identifiably at fault, so `<FormError>`
  renders beside the submit button, where the user already is. It scrolls itself
  into view only if it isn't already visible, and takes focus so screen readers
  catch it.

Neither auto-dismisses; both are things the user has to act on. This is also why
errors don't go through the toast system — toasts here mean "it worked", are
`role="status"` rather than `role="alert"`, and vanish after five seconds.

`useFormError()` replaces a plain `useState<string | null>` and carries a nonce,
so resubmitting and getting the same message back re-announces it instead of
looking like nothing happened.

Adopted on the four forms long enough for it to matter — registration,
`students/new`, the staff form and the enrolment form. Short forms that never
scroll still render their `<Alert variant="error">` inline.

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
│   │   ├── admins/{page,new/page}.tsx
│   │   ├── directory/{page,role-change/page}.tsx
│   │   ├── school/page.tsx      ← school profile + subscription
│   │   ├── academics/              ← page (years + terms), classes,
│   │   │                              classes/[classLevelId], enrolments
│   │   ├── billing/                 ← page, bills/[publicId], service-costs,
│   │   │                              charges, overdue, discounts
│   │   └── collections/page.tsx
│   ├── globals.css
│   ├── layout.tsx               ← root <html>, providers
│   └── page.tsx                 ← /, redirects based on session
├── components/
│   ├── ui.tsx                   ← Button, Field, Input, Select, Card, Alert, …
│   ├── billing-ui.tsx           ← status badges, StatTile, Pagination, term hooks
│   ├── payment-form.tsx         ← shared "record a payment" form
│   ├── form-error.tsx           ← submit errors: jump to field / show at button
│   ├── class-level-lookup.tsx   ← debounced class search (numeric id + UUID)
│   ├── enrolment-form.tsx       ← place a student in a class for a year
│   ├── student-lookup.tsx       ← debounced student search (pre-fillable)
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
│   ├── academics.ts             ← years + terms, joined across both endpoints
│   ├── classes.ts               ← class levels, streams and enrolments
│   ├── use-academic-terms.ts    ← hook over academics.ts
│   ├── use-class-levels.ts      ← hook over classes.ts
│   ├── billing.ts               ← typed wrappers for billing/collections
│   ├── billing-options.ts       ← select options for the billing enums
│   ├── staff-options.ts         ← select options for the staff/role enums
│   ├── cash-session-store.ts    ← per-device index of cash sessions
│   ├── endpoints.ts             ← AUTH, USERS, ACADEMICS, CLASSES, BILLING,
│   │                              … , ROUTES
│   ├── types.ts                 ← all payload + domain types
│   ├── utils.ts                 ← cn, getInitials, formatRoleLabel
│   └── validation.ts            ← email, phone, password, …
└── ...
docs/
├── URLS.md                      ← full URL & endpoint reference
├── API-GAPS.md                  ← what the backend doesn't offer yet
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
