<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# DENTAFLOW — AGENT RULEBOOK

**This document is imperative, not advisory.** Every rule below is a hard constraint on generated code. When a request conflicts with a rule here, say so in one sentence, then implement the rule-compliant version. Do not silently deviate.

Derived from `prompts/MEETAI_BLUEPRINT.md` (the architectural base) and specialized for DentaFlow. Where this file and the blueprint disagree, **this file wins** — the deviations are deliberate and are marked **DELTA**.

---

## 0. Agent Operating Protocol

Before writing a single line of code, in this order:

1. **Read the Next.js docs for the installed version.** They are on disk at `node_modules/next/dist/docs/`. Your training data about `middleware.ts`, sync `params`, `experimental.ppr`, and the Webpack default is wrong for this repo. Read `01-app/01-getting-started/16-proxy.md`, `01-app/02-guides/upgrading/version-16.md`, and the relevant `03-api-reference/` file for whatever API you are about to touch.
2. **Check `prompt_material/` before building any UI.** It holds the authoritative design references (currently `01-dentaflow-design-system.png`). **Open the image with your image-reading tool and replicate the layout, spacing, type scale, and color tokens exactly.** Do not invent a layout when a reference exists. If the requested screen has no reference in `prompt_material/`, say so explicitly in your reply, then derive it from §11's tokens and the closest existing screen.
3. **Locate the slice.** All work happens inside one `src/modules/<domain>/` directory unless you are adding infrastructure. If you cannot name the slice, you do not yet understand the task — ask.
4. **Follow §14's checklist in order** when adding a module. Each step must typecheck before you start the next.
5. **Never scaffold with placeholders.** No `// TODO: implement`, no `userId: "user_123"`, no mock arrays. Either write the real query or do not write the file.
6. **Never hand-edit `src/components/ui/*`.** Those are shadcn primitives. Extend by composition in `src/components/shared/` or in the slice.
7. **Verify before claiming done.** Run `npx tsc --noEmit` and `npm run lint`. Report failures with their output; never report success you did not observe.

### Non-negotiable prime directives

1. **`src/app/` is a routing shell, nothing else.** A file under `src/app/` may do exactly four things: read the session, `await` `params`/`searchParams`, prefetch queries, and render a component imported from `src/modules/`. No business logic. No data mapping. No JSX beyond the hydration wrapper.
2. **All application code lives in a vertical slice** under `src/modules/<domain>/`.
3. **The only way to read or write data from the client is tRPC.** No `fetch('/api/...')`, no Server Actions for domain data, no `db` import in any file carrying `"use client"`.
4. **Every query a page renders is prefetched on the server and consumed with `useSuspenseQuery` on the client.** Never `useEffect` + `useState` for data. `<Suspense>` owns loading; `<ErrorBoundary>` owns failure.
5. **Authorization is enforced in the procedure.** Never in the UI, never in `proxy.ts`. The network boundary is an optimization, never a security control.
6. **Types flow upward from the database.** `schema.ts` → Drizzle inference → procedure return → `inferRouterOutputs` → component props. You never hand-write a domain interface.
7. **Every Next.js request API is asynchronous.** `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` must be awaited. There is no synchronous fallback in Next.js 16.
8. **The UI is in French. The code is in English.** See §11.1. This is absolute and has no exceptions.

---

## 1. Product & Tenancy Model — read this before §2

DentaFlow is a **white-label, single-tenant, per-clinic deployment**. One clinic = one deployment = one database. There is no cross-clinic data in any database, ever.

**This is the single biggest divergence from the blueprint. Internalize it:**

| Concern | Blueprint (MeetAI, multi-tenant SaaS) | **DentaFlow (DELTA)** |
|---|---|---|
| Tenant boundary | A `userId` column on every table | **The database itself.** No tenancy column exists. |
| `GET` scoping | `where(eq(table.userId, ctx.auth.user.id))` | **Forbidden.** Staff share the clinic's data. A `WHERE` clause on staff identity in a read is a bug. |
| Better Auth `user` row | A tenant | **A clinic staff member** (admin, dentist, assistant, secretary) |
| `staffId` columns | Tenancy enforcement | **Audit only** — who created/modified the record. Never a filter on reads. |
| Tier-3 procedure | `premiumProcedure(entity)` — billing entitlement | **`adminProcedure`** — role gate. See §6.1. |
| Billing | Polar / Stripe, subscription state in `ctx` | **None. Do not add any billing package, table, route, or UI.** No Polar, no Stripe, no `/upgrade` route, no usage counters, no `MAX_FREE_*` constants. |

### The Crucial Data Rule

> A query procedure **must not** filter rows by the calling staff member's id. Every authenticated staff member sees the entire clinic's patients, appointments, treatments, and payments. Isolation is achieved by deployment, not by a `WHERE` clause.

The audit columns are written, never read as a filter:

```ts
// ✅ CORRECT — read: no staff scoping
const [patient] = await db.select().from(patients).where(eq(patients.id, input.id));

// ✅ CORRECT — write: staff id stamped from ctx for the audit trail
await db.insert(patients).values({ ...input, createdByStaffId: ctx.auth.user.id });

// ❌ WRONG — this is the blueprint's multi-tenant pattern. Never write it here.
.where(and(eq(patients.id, input.id), eq(patients.createdByStaffId, ctx.auth.user.id)))
```

**Consequence for deletes:** because there is no ownership filter, destructive mutations are protected by **role**, not by ownership. Every `remove` procedure is an `adminProcedure`. See §6.1.

---

## 2. Stack & Version Matrix

Pinned. Do not swap, do not add alternatives, do not introduce a second library that does the same job.

| Concern | Package | Rules |
|---|---|---|
| Framework | `next@16.3.5` | Turbopack is the default bundler. `proxy.ts`, not `middleware.ts`. |
| Runtime | `react@19` / `react-dom@19` | |
| API layer | `@trpc/server`, `@trpc/client`, `@trpc/tanstack-react-query` (v11) | **Use `@trpc/tanstack-react-query`, never the legacy `@trpc/react-query`.** The style is `useTRPC()` + `.queryOptions()` / `.mutationOptions()`. |
| Data cache | `@tanstack/react-query@5` | Suspense + hydration. |
| ORM | `drizzle-orm`, `drizzle-kit` | Postgres dialect. |
| Driver | `@neondatabase/serverless` | HTTP driver — stateless, **no interactive transactions**. |
| Auth | `better-auth` | Drizzle adapter, `[...all]` catch-all handler, `role` additional field. |
| Validation | `zod` | One schema shared by the procedure input and the `zodResolver`. |
| URL state | `nuqs@2` | Adapter is `nuqs/adapters/next/app`. The **only** store for filter/pagination state. |
| Forms | `react-hook-form` + `@hookform/resolvers` | |
| Tables | `@tanstack/react-table` | Headless; column defs live in the slice. |
| UI | `shadcn/ui` + Tailwind v4 | `components.json` style is `base-nova`, baseColor `neutral`, icons `lucide`. Tailwind v4 = `@tailwindcss/postcss`, **no `tailwind.config.ts`**; tokens live in `src/app/globals.css`. |
| Odontogram | `react-advanced-odontogram` | Client-only. See §12.2. |
| Calendar | `react-day-picker` (installed) for date pickers; the agenda grid is built in-slice with CSS grid. Do not add FullCalendar or similar. |
| Errors | `react-error-boundary` | |
| Toasts | `sonner` | |
| Dates | `date-fns` + `date-fns/locale/fr` | **Always pass `{ locale: fr }`.** |

`.npmrc` must keep `legacy-peer-deps=true`. `tsconfig.json` must keep `"strict": true` and `"paths": { "@/*": ["./src/*"] }`.

**Explicitly forbidden packages:** `@polar-sh/*`, `stripe`, `@stripe/*`, any multi-tenant/organization plugin, `axios`, `swr`, `redux`, `zustand`, `jotai`, `moment`.

---

## 3. Directory Contract

```
src/
├── app/                                    # ROUTING SHELL ONLY
│   ├── layout.tsx                          # html > body > NuqsAdapter > TRPCReactProvider
│   ├── globals.css                         # Tailwind v4 tokens (§11.2)
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── connexion/page.tsx
│   │   └── inscription/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                      # sidebar + navbar shell
│   │   ├── tableau-de-bord/page.tsx
│   │   ├── patients/page.tsx
│   │   ├── patients/[patientId]/page.tsx
│   │   ├── agenda/page.tsx
│   │   ├── actes/page.tsx
│   │   ├── paiements/page.tsx
│   │   ├── charges/page.tsx                # admin-only surface
│   │   └── parametres/page.tsx
│   └── api/
│       ├── trpc/[trpc]/route.ts            # the single data edge
│       └── auth/[...all]/route.ts          # Better Auth edge
│
├── proxy.ts                                # NEXT 16 network boundary (was middleware.ts)
│
├── modules/                                # VERTICAL SLICES — all application code
│   ├── patients/
│   ├── odontogram/
│   ├── appointments/
│   ├── treatments/
│   ├── payments/
│   ├── expenses/
│   ├── staff/
│   ├── chairs/
│   ├── dashboard/
│   └── auth/
│
├── trpc/
│   ├── init.ts                             # context + procedure tiers
│   ├── routers/_app.ts                     # root router composition
│   ├── server.tsx                          # RSC caller ('server-only')
│   ├── client.tsx                          # browser provider ('use client')
│   └── query-client.ts                     # shared QueryClient factory
│
├── database/
│   ├── index.ts                            # the db singleton
│   └── schema.ts                           # ALL tables, one file
│
├── lib/
│   ├── auth.ts                             # Better Auth server instance
│   ├── auth-client.ts                      # Better Auth browser instance
│   ├── format.ts                           # DH / date / phone / FDI formatters (§11.3)
│   └── utils.ts                            # cn()
│
├── components/
│   ├── ui/                                 # shadcn primitives — DO NOT hand-edit
│   └── shared/                             # cross-slice composites (§10.4)
│
├── hooks/                                  # cross-slice hooks only (use-confirm, use-mobile)
└── constants.ts                            # global constants (§13.1)
```

### Slice layout — identical for every domain, no deviation

```
src/modules/<domain>/
├── server/procedures.ts                    # tRPC router  (server only)
├── schemas.ts                              # Zod contracts (isomorphic)
├── types.ts                                # inferRouterOutputs + TS enums (isomorphic)
├── constants.ts                            # French label maps, slice constants
├── params.ts                               # nuqs SSR loader (server)
├── hooks/use-<domain>-filters.ts           # nuqs client hook — MIRRORS params.ts
└── ui/
    ├── views/<domain>-view.tsx             # Suspense-consuming client view
    ├── views/<domain>-id-view.tsx
    ├── <domain>-form.tsx
    ├── columns.tsx
    ├── list-header.tsx
    └── new-/update-<domain>-dialog.tsx
```

> **Naming note.** The billable clinical act («acte») is modelled by the **`treatments`** slice, not `procedures`, because `procedures.ts` already means "tRPC router" in this architecture. French UI says «Acte»; code says `treatment`.

### Placement rules

- A component used by **one** slice lives in that slice's `ui/`. A component used by **two or more** slices moves to `src/components/shared/`. Never the reverse. Do not pre-emptively generalize.
- `src/lib/` holds clients and pure functions. It never holds React components.
- Anything touching a secret starts with `import "server-only";`.
- **`ui/views/` holds views; `ui/` holds parts.** This is the only accepted layout. Never `views/ui/`, never views at the slice root.

---

## 4. Layer 1 — Database (Drizzle + Neon HTTP)

### 4.1 Connection

```ts
// src/database/index.ts
import { drizzle } from "drizzle-orm/neon-http";

export const db = drizzle(process.env.DATABASE_URL!);
```

- `db` is imported **only** from `src/trpc/init.ts`, `src/modules/*/server/procedures.ts`, `src/lib/auth.ts`, and route handlers. Nowhere else. Never in a `"use client"` file.
- The HTTP driver has **no interactive transactions**. Design multi-statement operations to be idempotent and retry-safe, or use `db.batch()` where the shape allows. Never assume atomicity across two `await db...` calls. **Where a money write would span two statements, derive the second value in SQL instead of writing it.**
- Each statement is one HTTP round trip. Prefer one query with a join or a correlated subquery over N queries in a loop. `db.$count(table, predicate)` and `sql<number>` subqueries are the tools.

### 4.2 Drizzle Kit

```ts
// drizzle.config.ts
import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/database/schema.ts",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

Scripts: `"db:push": "drizzle-kit push"`, `"db:studio": "drizzle-kit studio"`. Use `push` pre-production; switch to `generate` + `migrate` with committed SQL the moment a real clinic is live. **A live clinic is a medical record system — never `push` against it.**

### 4.3 Schema conventions

All tables in **one file**, `src/database/schema.ts`. Better Auth tables first (it owns their shape), domain tables after.

| Rule | Why |
|---|---|
| IDs are `text` + `$defaultFn(() => nanoid())` | URL-safe, non-enumerable, known before the insert returns. **Never `serial`** — patient counts and record volume must not leak from a URL. |
| Every table carries `createdAt` + `updatedAt`, `notNull().defaultNow()` | Required for the stable-ordering rule in §9.5. |
| Lifecycle states use `pgEnum`, never free `text` | The DB rejects invalid states, and the enum feeds the Zod input, the nuqs parser, and the TS enum. |
| **Enum values are English snake_case identifiers** | They are stable keys. French is a presentation concern — §11.1. |
| **No table carries a tenancy `userId`** | §1. Single-tenant. |
| Audit columns are `createdByStaffId` / `updatedByStaffId`: `text`, **nullable**, referencing `user.id` with `onDelete: "set null"` | **DELTA from the blueprint's `cascade`.** Deleting a staff member must never delete a patient record. Medical and financial history outlives employment. |
| **Money is stored as `integer` centimes**; column names end in `Cents` | Postgres `numeric` arrives as a JS string in Drizzle, and `real`/`double` silently drift. Integer centimes is exact and sums correctly in SQL. Format at the UI edge only (§11.3). |
| Odontogram state is `jsonb(...).$type<OdontogramChart>()` | §12.2. |
| Nullable columns model "not yet known" | Never sentinel values, never `""`, never `0` for "unknown money". |
| FKs that model containment (`payments.treatmentId`, `treatments.patientId`) use `onDelete: "cascade"`; FKs that model reference (`appointments.chairId`) use `onDelete: "restrict"` | Deleting a chair must not silently delete appointments. |

### 4.4 The canonical DentaFlow schema

This is the shape to generate. Extend it; do not restructure it.

```ts
// src/database/schema.ts
import {
  pgTable, text, timestamp, boolean, integer, date, jsonb, pgEnum, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { nanoid } from "nanoid";
import type { OdontogramChart } from "@/modules/odontogram/types";

// ── Better Auth owns these four tables ────────────────────────────────────────
export const staffRole = pgEnum("staff_role", ["admin", "dentist", "assistant", "secretary"]);

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").$defaultFn(() => false).notNull(),
  image: text("image"),
  // Better Auth `additionalFields` — server-owned, input: false. See §5.1.
  role: staffRole("role").notNull().default("assistant"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").$defaultFn(() => new Date()).notNull(),
  updatedAt: timestamp("updated_at").$defaultFn(() => new Date()).notNull(),
});
// session, account, verification — generated by the Better Auth CLI, copied verbatim.

// ── Domain enums (English identifiers; French labels live in slice constants) ──
export const insuranceType     = pgEnum("insurance_type", ["cnss", "cnops", "mutuelle", "none"]);
export const genderType        = pgEnum("gender", ["male", "female"]);
export const dentitionType     = pgEnum("dentition", ["adult", "child"]);
export const treatmentStatus   = pgEnum("treatment_status", ["planned", "in_progress", "completed", "canceled"]);
export const appointmentStatus = pgEnum("appointment_status", ["pending", "confirmed", "completed", "canceled", "no_show"]);
export const paymentMethod     = pgEnum("payment_method", ["cash", "check", "card", "transfer", "insurance"]);
export const expenseCategory   = pgEnum("expense_category", [
  "supplies", "lab", "rent", "utilities", "salaries", "equipment", "maintenance", "taxes", "other",
]);

// ── Patients ──────────────────────────────────────────────────────────────────
export const patients = pgTable("patients", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),                       // E.164: +212XXXXXXXXX
  secondaryPhone: text("secondary_phone"),
  email: text("email"),
  birthDate: date("birth_date", { mode: "string" }),    // date-only, no timezone
  gender: genderType("gender"),
  address: text("address"),
  city: text("city"),
  cin: text("cin"),                                     // Moroccan national ID
  insurance: insuranceType("insurance").notNull().default("none"),
  insuranceNumber: text("insurance_number"),
  allergies: text("allergies"),
  medicalNotes: text("medical_notes"),
  createdByStaffId: text("created_by_staff_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("patients_last_name_idx").on(t.lastName),
  index("patients_phone_idx").on(t.phone),
]);

// ── Odontogram: one chart row per patient per dentition ───────────────────────
export const odontogramCharts = pgTable("odontogram_charts", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  dentition: dentitionType("dentition").notNull().default("adult"),
  // Opaque payload owned by react-advanced-odontogram's exportStatus(). §12.2
  chart: jsonb("chart").$type<OdontogramChart>().notNull().default({} as OdontogramChart),
  updatedByStaffId: text("updated_by_staff_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("odontogram_patient_dentition_idx").on(t.patientId, t.dentition)]);

// ── Chairs («fauteuils») ──────────────────────────────────────────────────────
export const chairs = pgTable("chairs", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  name: text("name").notNull(),
  color: text("color").notNull().default("#0D9488"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ── Appointments («rendez-vous») ──────────────────────────────────────────────
export const appointments = pgTable("appointments", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  chairId: text("chair_id").notNull().references(() => chairs.id, { onDelete: "restrict" }),
  practitionerId: text("practitioner_id").references(() => user.id, { onDelete: "set null" }),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: appointmentStatus("status").notNull().default("pending"),
  reason: text("reason"),
  notes: text("notes"),
  createdByStaffId: text("created_by_staff_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("appointments_starts_at_idx").on(t.startsAt),
  index("appointments_chair_starts_at_idx").on(t.chairId, t.startsAt),
]);

// ── Treatments («actes») — the billable clinical act ──────────────────────────
export const treatments = pgTable("treatments", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  appointmentId: text("appointment_id").references(() => appointments.id, { onDelete: "set null" }),
  practitionerId: text("practitioner_id").references(() => user.id, { onDelete: "set null" }),
  label: text("label").notNull(),                                 // e.g. "Composite 2 faces"
  teeth: jsonb("teeth").$type<string[]>().notNull().default([]),  // FDI codes, §12.1
  totalAmountCents: integer("total_amount_cents").notNull().default(0),
  status: treatmentStatus("status").notNull().default("planned"),
  performedAt: timestamp("performed_at", { withTimezone: true }),
  notes: text("notes"),
  createdByStaffId: text("created_by_staff_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("treatments_patient_idx").on(t.patientId)]);

// ── Payments («paiements») — individual transactions ──────────────────────────
export const payments = pgTable("payments", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  patientId: text("patient_id").notNull().references(() => patients.id, { onDelete: "cascade" }),
  treatmentId: text("treatment_id").references(() => treatments.id, { onDelete: "cascade" }),
  amountCents: integer("amount_cents").notNull(),
  method: paymentMethod("method").notNull().default("cash"),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
  reference: text("reference"),                          // cheque number, transaction id
  notes: text("notes"),
  createdByStaffId: text("created_by_staff_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("payments_patient_idx").on(t.patientId),
  index("payments_treatment_idx").on(t.treatmentId),
  index("payments_paid_at_idx").on(t.paidAt),
]);

// ── Expenses («charges du cabinet») — ADMIN ONLY ──────────────────────────────
export const expenses = pgTable("expenses", {
  id: text("id").primaryKey().$defaultFn(() => nanoid()),
  label: text("label").notNull(),
  category: expenseCategory("category").notNull().default("other"),
  amountCents: integer("amount_cents").notNull(),
  spentAt: timestamp("spent_at", { withTimezone: true }).notNull().defaultNow(),
  supplier: text("supplier"),
  notes: text("notes"),
  createdByStaffId: text("created_by_staff_id").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [index("expenses_spent_at_idx").on(t.spentAt)]);
```

---

## 5. Layer 2 — Auth (Better Auth, staff accounts)

### 5.1 Server instance

```ts
// src/lib/auth.ts
import { db } from "@/database";
import * as schema from "@/database/schema";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  emailAndPassword: { enabled: true },
  database: drizzleAdapter(db, { provider: "pg", schema: { ...schema } }),
  user: {
    additionalFields: {
      // input: false ⇒ a staff member can NEVER set their own role over the wire.
      role:     { type: "string",  required: true, defaultValue: "assistant", input: false },
      isActive: { type: "boolean", required: true, defaultValue: true,        input: false },
    },
  },
  plugins: [nextCookies()], // nextCookies() MUST be last in the array
});
```

**Rules:**
- **No social providers** unless the clinic explicitly asks for one. Staff accounts are email + password, created by an admin.
- **No organization / multi-session / billing plugins.** The deployment is the tenant.
- `role` and `isActive` are `input: false`. Role changes go through an `adminProcedure` in the `staff` slice that writes the column directly with Drizzle.
- If you add an `additionalField`, you must also add the matching column to `user` in `schema.ts` and run `db:push`. Better Auth does not own columns it did not generate.

### 5.2 The HTTP edge

```ts
// src/app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { POST, GET } = toNextJsHandler(auth);
```

### 5.3 Browser instance

```ts
// src/lib/auth-client.ts
import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>()],
});
```

`authClient` is used for **sign-in, sign-up, sign-out, and the session hook in the navbar — and nothing else.** All clinical and financial data goes through tRPC.

### 5.4 Where the session is read (three tiers)

| Tier | Location | Trust | Purpose |
|---|---|---|---|
| 1 | `proxy.ts` | **Untrusted** — cookie presence only | Skip a wasted SSR render for logged-out visitors |
| 2 | Server Component (page) | Trusted | Redirect, and decide what to prefetch |
| 3 | `protectedProcedure` / `adminProcedure` | **Authoritative** | Every read and write is gated here |

Tiers 1 and 2 are UX. **Tier 3 is security.** Deleting `proxy.ts` entirely must not open a single hole. If it would, the procedures are wrong.

---

## 6. Layer 3 — tRPC v11 + TanStack Query v5

Five files. Their responsibilities do not overlap and must not be merged.

### 6.1 `src/trpc/init.ts` — context and procedure tiers

```ts
// src/trpc/init.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Built once per request. cache() dedupes it across the RSC render
 * AND the HTTP handler. NEXT 16: headers() is async and must be awaited.
 */
export const createTRPCContext = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  return { session };
});

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

// Never export the raw `t` object — export named helpers.
const t = initTRPC.context<TRPCContext>().create({
  // transformer: superjson,  // add ONLY per §6.2's all-or-nothing rule
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/** TIER 1 — public, unauthenticated. Almost nothing in DentaFlow qualifies. */
export const baseProcedure = t.procedure;

/** TIER 2 — authenticated clinic staff. ctx.auth is non-null below this line. */
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session expirée. Veuillez vous reconnecter." });
  }
  if (!ctx.session.user.isActive) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Ce compte a été désactivé." });
  }
  return next({ ctx: { ...ctx, auth: ctx.session } });
});

/**
 * TIER 3 — administrative. DELTA: replaces the blueprint's premiumProcedure.
 * Gate for destructive operations and clinic-wide financials.
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.auth.user.role !== "admin") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Action réservée à l'administrateur du cabinet.",
    });
  }
  return next({ ctx });
});
```

**Tier rules — which procedure to use, by operation:**

| Operation | Tier |
|---|---|
| Any `getOne` / `getMany` of clinical data | `protectedProcedure` |
| `create` / `update` on patients, appointments, treatments, payments, odontogram | `protectedProcedure` |
| **Every `remove` / hard delete, on any table** | **`adminProcedure`** |
| **Every procedure in the `expenses` slice — including reads** | **`adminProcedure`** («charges du cabinet» is admin-confidential) |
| Clinic-wide revenue / profit reporting on the dashboard | `adminProcedure` |
| Staff management: create staff, change role, deactivate | `adminProcedure` |

- Middleware only ever *adds* to `ctx` via `next({ ctx: { ...ctx, ... } })`. Never replaces it.
- Middleware throws `TRPCError` with a real `code`. The code drives client behavior (§10.3).
- **`premiumProcedure` must not exist in this codebase.** If you see it, delete it and replace it with the correct tier.

### 6.2 `src/trpc/query-client.ts`

```ts
// src/trpc/query-client.ts
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Prevents an immediate client refetch of data the server just sent.
        staleTime: 30 * 1000,
      },
      dehydrate: {
        // Dehydrate PENDING queries too — this is what lets a `void` prefetch
        // that has not resolved yet stream to the client instead of blocking SSR.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
      hydrate: {},
    },
  });
}
```

- **Never set `staleTime: 0`.** Every prefetched query would refetch the instant it hydrates, and you would have paid for SSR twice.
- **A transformer is all-or-nothing.** Procedures return `Date` objects the moment they return a row with `createdAt`. Either register `superjson` in **both** `init.ts` and `client.tsx`, or serialize dates inside the procedure. A transformer configured on one side only silently corrupts data. Pick one and apply it project-wide.

### 6.3 `src/trpc/server.tsx` — the RSC caller

```tsx
// src/trpc/server.tsx
import "server-only";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { createTRPCContext } from "./init";
import { makeQueryClient } from "./query-client";
import { appRouter } from "./routers/_app";

// Stable per-request getter: the same QueryClient for the whole render pass.
export const getQueryClient = cache(makeQueryClient);

export const trpc = createTRPCOptionsProxy({
  ctx: createTRPCContext,
  router: appRouter,
  queryClient: getQueryClient,
});
```

`cache()` is what makes hydration work: every `getQueryClient()` inside one request returns the same instance, so a prefetch in a page and the `dehydrate()` at the end of that page see the same cache. This proxy calls procedures **in-process** — no HTTP hop.

### 6.4 `src/trpc/client.tsx` — the browser provider

```tsx
// src/trpc/client.tsx
"use client";

import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { useState } from "react";
import { makeQueryClient } from "./query-client";
import type { AppRouter } from "./routers/_app";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let browserQueryClient: QueryClient;

function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();     // Server: always fresh
  if (!browserQueryClient) browserQueryClient = makeQueryClient(); // Browser: singleton
  return browserQueryClient;
}

function getUrl() {
  const base = typeof window !== "undefined" ? "" : process.env.NEXT_PUBLIC_APP_URL;
  return `${base}/api/trpc`;
}

export function TRPCReactProvider(props: Readonly<{ children: React.ReactNode }>) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({ links: [httpBatchLink({ url: getUrl() })] }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
        {props.children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
```

The browser singleton is load-bearing. `useState(() => makeQueryClient())` is **not** equivalent: if the tree suspends on first render with no boundary above, React discards the state and you get a second, empty client.

`httpBatchLink` collapses every query fired in the same tick into one HTTP request — which is why a patient detail page with six independent queries still makes one network call.

### 6.5 `src/trpc/routers/_app.ts`

```ts
// src/trpc/routers/_app.ts
import { createTRPCRouter } from "../init";
import { patientsRouter } from "@/modules/patients/server/procedures";
import { odontogramRouter } from "@/modules/odontogram/server/procedures";
import { appointmentsRouter } from "@/modules/appointments/server/procedures";
import { treatmentsRouter } from "@/modules/treatments/server/procedures";
import { paymentsRouter } from "@/modules/payments/server/procedures";
import { expensesRouter } from "@/modules/expenses/server/procedures";
import { chairsRouter } from "@/modules/chairs/server/procedures";
import { staffRouter } from "@/modules/staff/server/procedures";
import { dashboardRouter } from "@/modules/dashboard/server/procedures";

export const appRouter = createTRPCRouter({
  patients: patientsRouter,
  odontogram: odontogramRouter,
  appointments: appointmentsRouter,
  treatments: treatmentsRouter,
  payments: paymentsRouter,
  expenses: expensesRouter,
  chairs: chairsRouter,
  staff: staffRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
```

The **only** place slices are registered. Adding a slice adds exactly one line. **If this file ever contains an inline procedure definition, the rule has been broken.**

### 6.6 The HTTP edge

```ts
// src/app/api/trpc/[trpc]/route.ts
import { createTRPCContext } from "@/trpc/init";
import { appRouter } from "@/trpc/routers/_app";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });

export { handler as GET, handler as POST };
```

The `[trpc]` segment is never read — `fetchRequestHandler` parses the path itself. Any **other** route handler that does read its params must await them:

```ts
// NEXT 16 — params in route.ts is a Promise
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
}
```

---

## 7. Layer 4 — App Router & Next.js 16 Conventions

### 7.1 Root layout

```tsx
// src/app/layout.tsx
import type { Metadata } from "next";
import { Poppins, Inter } from "next/font/google";
import "./globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { TRPCReactProvider } from "@/trpc/client";
import { Toaster } from "@/components/ui/sonner";

const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-heading" });
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "DentaFlow — Gestion de cabinet dentaire",
  description: "Logiciel de gestion pour cabinet dentaire : patients, agenda, actes et finances.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className={`${poppins.variable} ${inter.variable} font-sans antialiased`}>
        <NuqsAdapter>
          <TRPCReactProvider>
            {children}
            <Toaster />
          </TRPCReactProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}
```

- `<html lang="fr">` — **always**. Never `en`.
- `<html>` and `<body>` are the outermost elements the root layout returns. **Providers go inside `<body>`**, never wrapping `<html>`.
- The root layout is **not** `async` and reads **no** session. Session reads belong to pages.
- Never ship the default `"Create Next App"` metadata.

### 7.2 Route groups & layouts

- `(auth)` — centered card, no chrome.
- `(dashboard)` — `SidebarProvider` + sidebar + navbar shell.
- **Layouts are structural only.** A layout does not fetch domain data and does not gate auth. Layouts do not re-render on client navigation between their children, so a session check in a layout goes stale. **Put the check in the page.**
- Any surface that must escape the dashboard chrome gets its own top-level route with its own `layout.tsx` — not a group.

### 7.3 Async request APIs — the Next.js 16 breaking change

In Next.js 15 these were async with a synchronous fallback. **In Next.js 16 the fallback is gone.**

| API | Next 16 |
|---|---|
| `params` in page / layout / route / metadata | `Promise` — **must await** |
| `searchParams` in `page.tsx` | `Promise` — **must await** |
| `cookies()` / `headers()` / `draftMode()` | **must await** |

```tsx
// ✅ NEXT 16 — either hand-written Promise types…
interface Props {
  params: Promise<{ patientId: string }>;
  searchParams: Promise<SearchParams>;
}

// …or the globally-available typed helpers (preferred when typed routes are on):
export default async function Page({ params }: PageProps<"/patients/[patientId]">) {
  const { patientId } = await params;
}
```

Codemod for legacy code: `npx @next/codemod@canary next-async-request-api .`

### 7.4 `proxy.ts` — NOT `middleware.ts`

`middleware.ts` is gone. The file is `src/proxy.ts` and the export is `proxy`.

| | Next 16 |
|---|---|
| Filename | `src/proxy.ts` (root or `src/`, beside `app/`) |
| Export | `export function proxy()` — named or default |
| Runtime | **`nodejs`, not configurable.** Edge is unsupported. |
| Config flag | `skipProxyUrlNormalize` |
| `config.matcher` | supported, unchanged |

```ts
// src/proxy.ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/connexion" || pathname === "/inscription";

  // OPTIMISTIC ONLY — cookie presence, not validity. Never a security control.
  if (!sessionCookie && !isAuthRoute) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  if (sessionCookie && isAuthRoute) {
    return NextResponse.redirect(new URL("/tableau-de-bord", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/tableau-de-bord/:path*", "/patients/:path*", "/agenda/:path*",
    "/actes/:path*", "/paiements/:path*", "/charges/:path*",
    "/parametres/:path*", "/connexion", "/inscription",
  ],
};
```

**Rules:**
1. It checks the **presence** of a cookie. It does not validate it, does not hit the database, does not call `auth.api.getSession`. Even though `proxy` now runs on Node and technically could, this file is on the hot path of every matched request.
2. **`proxy.ts` never gates the admin role.** Role is a tier-3 concern (§6.1). A non-admin who types `/charges` must be met by a `FORBIDDEN` from the procedure and an explicit error state — not by a redirect that pretends the page does not exist.
3. Keep `matcher` narrow. An unmatched route costs nothing; a matched route costs a Node invocation.
4. If you customize the session cookie name or prefix in `auth.ts`, pass the matching config to `getSessionCookie()` — it does not read your Better Auth config automatically.

Codemod for legacy code: `npx @next/codemod@canary middleware-to-proxy .`

### 7.5 `next.config.ts`

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [{ source: "/", destination: "/tableau-de-bord", permanent: false }];
  },
};

export default nextConfig;
```

**Do not enable `cacheComponents`.** It changes how dynamic request APIs interact with prerendering, and this architecture calls `headers()` at the top of nearly every page. `experimental.ppr` and the `experimental_ppr` segment config are **removed** in 16 — do not reintroduce them.

---

## 8. Layer 5 — The Hydration Flow (the critical pattern)

```
┌─ SERVER ──────────────────────────────────────────────────────────┐
│ page.tsx (async Server Component)                                 │
│   1. await searchParams  → loadSearchParams()  (THIS slice's)     │
│   2. await headers()     → auth.api.getSession() → redirect?      │
│   3. getQueryClient()    (React cache: stable for this request)   │
│   4. void queryClient.prefetchQuery(trpc.x.y.queryOptions(input)) │
│   5. <HydrationBoundary state={dehydrate(queryClient)}>           │
│        <Suspense fallback={<XLoading />}>                         │
│          <ErrorBoundary fallback={<XError />}>                    │
│            <XView />   ← client component, receives NO data props │
└───────────────────────────────────────────────────────────────────┘
                 ↓ dehydrated cache travels in the RSC payload
┌─ CLIENT ──────────────────────────────────────────────────────────┐
│ x-view.tsx ("use client")                                         │
│   const trpc = useTRPC();                                         │
│   const [filters] = useXFilters();        ← nuqs, same input      │
│   const { data } = useSuspenseQuery(                              │
│     trpc.x.y.queryOptions({ ...filters }) ← SAME KEY = cache hit  │
│   );                                       → renders immediately  │
└───────────────────────────────────────────────────────────────────┘
```

### 8.1 Canonical list page

```tsx
// src/app/(dashboard)/patients/page.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { getQueryClient, trpc } from "@/trpc/server";
import { loadSearchParams } from "@/modules/patients/params";
import PatientsListHeader from "@/modules/patients/ui/list-header";
import PatientsView, {
  PatientsViewError,
  PatientsViewLoading,
} from "@/modules/patients/ui/views/patients-view";

interface Props {
  searchParams: Promise<SearchParams>; // NEXT 16: always a Promise
}

const PatientsPage = async ({ searchParams }: Props) => {
  const filters = await loadSearchParams(searchParams);

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.patients.getMany.queryOptions({ ...filters }));

  return (
    <>
      <PatientsListHeader />
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense fallback={<PatientsViewLoading />}>
          <ErrorBoundary fallback={<PatientsViewError />}>
            <PatientsView />
          </ErrorBoundary>
        </Suspense>
      </HydrationBoundary>
    </>
  );
};

export default PatientsPage;
```

### 8.2 Canonical detail page — prefetch every query the subtree will call

```tsx
// src/app/(dashboard)/patients/[patientId]/page.tsx
interface Props {
  params: Promise<{ patientId: string }>; // NEXT 16: always a Promise
}

const PatientIdPage = async ({ params }: Props) => {
  const { patientId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(trpc.patients.getOne.queryOptions({ id: patientId }));
  void queryClient.prefetchQuery(trpc.treatments.getManyByPatient.queryOptions({ patientId }));
  void queryClient.prefetchQuery(trpc.payments.getManyByPatient.queryOptions({ patientId }));
  void queryClient.prefetchQuery(
    trpc.odontogram.getOne.queryOptions({ patientId, dentition: "adult" }),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense fallback={<PatientIdViewLoading />}>
        <ErrorBoundary fallback={<PatientIdViewError />}>
          <PatientIdView patientId={patientId} />
        </ErrorBoundary>
      </Suspense>
    </HydrationBoundary>
  );
};
```

The detail view receives `patientId` — an **identifier, not data**. That is the only kind of prop a view may take from a page.

### 8.3 The matching client view

```tsx
// src/modules/patients/ui/views/patients-view.tsx
"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/trpc/client";
import { usePatientsFilters } from "../../hooks/use-patients-filters";
import { columns } from "../columns";
import { DataTable } from "@/components/shared/data-table";
import DataPagination from "@/components/shared/data-pagination";
import EmptyState from "@/components/shared/empty-state";
import LoadingState from "@/components/shared/loading-state";
import ErrorState from "@/components/shared/error-state";

const PatientsView = () => {
  const trpc = useTRPC();
  const router = useRouter();
  const [filters, setFilters] = usePatientsFilters();

  // Resolves synchronously from the dehydrated cache on first paint.
  const { data } = useSuspenseQuery(trpc.patients.getMany.queryOptions({ ...filters }));

  return (
    <div className="flex flex-1 flex-col gap-y-4 px-4 pb-4 md:px-8">
      <DataTable
        columns={columns}
        data={data.items}
        onRowClick={(row) => router.push(`/patients/${row.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({ page })}
      />
      {data.items.length === 0 && (
        <EmptyState
          title="Aucun patient"
          description="Créez votre premier dossier patient pour commencer."
        />
      )}
    </div>
  );
};

// Loading and Error states are NAMED EXPORTS from the same file as the view.
export const PatientsViewLoading = () => (
  <LoadingState title="Chargement des patients" description="Merci de patienter quelques instants…" />
);

export const PatientsViewError = () => (
  <ErrorState title="Erreur de chargement" description="Une erreur est survenue. Veuillez réessayer." />
);

export default PatientsView;
```

### 8.4 Hydration rules — violations break SSR silently

| # | Rule |
|---|---|
| 1 | **`void queryClient.prefetchQuery(...)`, never `await`.** `void` fires the query and returns immediately; the pending query is dehydrated (§6.2) and streams. `await` blocks the whole page on the slowest query. |
| 2 | **The server's `queryOptions()` input must be byte-identical to the client's.** The input *is* the query key. One extra field on either side = cache miss = double fetch = the user sees the fallback. |
| 3 | **Always `getQueryClient()` from `@/trpc/server`**, never `makeQueryClient()` directly in a page. The `cache()` wrapper is what ties the prefetch and the `dehydrate()` together. |
| 4 | **`<Suspense>` inside `<HydrationBoundary>`, `<ErrorBoundary>` inside `<Suspense>`.** Any other nesting either loses the cache or swallows the boundary. |
| 5 | **`useSuspenseQuery` for prefetched data, never `useQuery`.** `useQuery` returns `data: undefined` on first render and forces a null check that will never be true — dead code that hides real bugs. |
| 6 | **Views take identifiers, not data.** Passing `data` down from the page defeats the pattern and makes the component un-refetchable after a mutation. |
| 7 | **Prefetch every query the view will call, including nested views.** A missed prefetch is not an error — it silently degrades to a client fetch and a spinner. Audit by reading the view's `useSuspenseQuery` calls. |
| 8 | Data that is **not** prefetched — typeahead inside a dialog, a combobox's options — uses plain `useQuery` and handles `data === undefined`. This is the only legitimate `useQuery`. |
| 9 | **Each page imports `loadSearchParams` from its own slice's `params.ts`.** Importing another slice's loader drops filters from the prefetch input and guarantees a double fetch. |

---

## 9. Layer 6 — Vertical Slicing

A slice is **closed**: everything a feature needs is inside it, and the outside world touches it through exactly two doors — its router (registered in `_app.ts`) and its exported view components (imported by a page).

```
  schema.ts (DB)
       │  getTableColumns(), db.$count(), sql<number>
       ▼
  server/procedures.ts ──uses──► schemas.ts (Zod input)
       │                              │
       │ return type                  │ same schema
       ▼                              ▼
  types.ts  (inferRouterOutputs)   ui/<domain>-form.tsx (zodResolver)
       │
       ▼
  ui/columns.tsx · ui/views/*.tsx · constants.ts (French labels)
       ▲
       │ same parsers, two implementations
  params.ts (server) ◄──mirror──► hooks/use-<domain>-filters.ts (client)
       │                                   │
       └──► page.tsx prefetch input ───────┴──► view query input  (SAME KEY)
```

### 9.1 `schemas.ts` — Zod contracts

```ts
// src/modules/patients/schemas.ts
import { z } from "zod";

// Moroccan mobile/landline, normalized to E.164.
const moroccanPhone = z
  .string()
  .trim()
  .regex(/^(?:\+212|0)[5-7]\d{8}$/, { message: "Numéro de téléphone marocain invalide" })
  .transform((v) => (v.startsWith("0") ? `+212${v.slice(1)}` : v));

export const patientInsertSchema = z.object({
  firstName: z.string().trim().min(1, { message: "Le prénom est obligatoire" }),
  lastName: z.string().trim().min(1, { message: "Le nom est obligatoire" }),
  phone: moroccanPhone,
  secondaryPhone: moroccanPhone.nullish(),
  email: z.string().email({ message: "Adresse e-mail invalide" }).nullish(),
  birthDate: z.string().date({ message: "Date de naissance invalide" }).nullish(),
  gender: z.enum(["male", "female"]).nullish(),
  address: z.string().trim().nullish(),
  city: z.string().trim().nullish(),
  cin: z.string().trim().nullish(),
  insurance: z.enum(["cnss", "cnops", "mutuelle", "none"]).default("none"),
  insuranceNumber: z.string().trim().nullish(),
  allergies: z.string().trim().nullish(),
  medicalNotes: z.string().trim().nullish(),
});

// Update = insert + id. NEVER redeclare the fields.
export const patientUpdateSchema = patientInsertSchema.extend({
  id: z.string().min(1, { message: "Identifiant requis" }),
});
```

**Rules:**
- One schema, two consumers: the procedure's `.input()` and the form's `zodResolver`. This is why validation messages are identical on client and server, for free.
- **All Zod `message` strings are French user-facing copy.** Review them as copy, not as debug text.
- `updateSchema` is **always** `insertSchema.extend({ id })`. Never hand-written.
- Schemas describe **what the user may send**. `createdByStaffId`, timestamps, and derived money are never in an insert schema — the procedure supplies them from `ctx`.
- Money fields in a schema are `z.number().int().nonnegative()` **centimes**, never a formatted string.
- Invariants the DB cannot express go in `.refine()` with a French message (e.g. `endsAt > startsAt` → "L'heure de fin doit être postérieure à l'heure de début").

### 9.2 `types.ts` — inference, never declaration

```ts
// src/modules/patients/types.ts
import { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@/trpc/routers/_app";

export type PatientGetOne = inferRouterOutputs<AppRouter>["patients"]["getOne"];
export type PatientGetMany = inferRouterOutputs<AppRouter>["patients"]["getMany"]["items"];

// TS enums mirroring a pgEnum, kept in lockstep. Feeds nuqs parsers,
// filter options, and badge variants.
export enum InsuranceType {
  Cnss = "cnss",
  Cnops = "cnops",
  Mutuelle = "mutuelle",
  None = "none",
}
```

For a list, export the **item array** (`["getMany"]["items"]`), not the envelope — columns and cards want `PatientGetMany[number]`.

**This is the payoff of the whole architecture.** Add a column to `patients` in `schema.ts` → `getTableColumns()` picks it up → the procedure's return type widens → `PatientGetOne` widens → every consumer sees it. Zero hand-written interfaces, zero drift. **`git grep` for a hand-written `interface Patient { ... }` and delete it on sight.**

### 9.3 `constants.ts` — the French label maps

**Every `pgEnum` gets a label map in its slice's `constants.ts`. This is the only place French enum copy exists.**

```ts
// src/modules/patients/constants.ts
import { InsuranceType } from "./types";

export const INSURANCE_LABELS: Record<InsuranceType, string> = {
  [InsuranceType.Cnss]: "CNSS",
  [InsuranceType.Cnops]: "CNOPS",
  [InsuranceType.Mutuelle]: "Mutuelle",
  [InsuranceType.None]: "Sans couverture",
};

export const INSURANCE_OPTIONS = Object.entries(INSURANCE_LABELS).map(
  ([value, label]) => ({ value, label }),
);
```

Never inline a French string for an enum value in a column def, a badge, or a `<SelectItem>`. Read it from the map.

### 9.4 `params.ts` + `hooks/use-<domain>-filters.ts` — URL as the state store

These two files **must declare the same parsers with the same defaults** — their outputs are the two halves of one query key (§8.4 rule 2).

```ts
// src/modules/patients/params.ts — SERVER (page.tsx)
import { createLoader, parseAsInteger, parseAsString, parseAsStringEnum } from "nuqs/server";
import { DEFAULT_PAGE } from "@/constants";
import { InsuranceType } from "./types";

export const filterSearchParams = {
  search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
  insurance: parseAsStringEnum(Object.values(InsuranceType)),
  page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({ clearOnDefault: true }),
};

export const loadSearchParams = createLoader(filterSearchParams);
```

```ts
// src/modules/patients/hooks/use-patients-filters.ts — CLIENT (views)
"use client";

import { parseAsInteger, parseAsString, parseAsStringEnum, useQueryStates } from "nuqs";
import { DEFAULT_PAGE } from "@/constants";
import { InsuranceType } from "../types";

export const usePatientsFilters = () =>
  useQueryStates({
    search: parseAsString.withDefault("").withOptions({ clearOnDefault: true }),
    insurance: parseAsStringEnum(Object.values(InsuranceType)),
    page: parseAsInteger.withDefault(DEFAULT_PAGE).withOptions({ clearOnDefault: true }),
  });
```

**Rules:**
- `clearOnDefault: true` on every parser. A filter at its default value must not appear in the URL — clean URLs, and stable query keys.
- **Filter and pagination state never live in `useState`.** URL state is what makes the SSR prefetch possible at all: the server can only prefetch what it can read from the request.
- Changing a filter calls `setFilters({ ... })`; TanStack Query sees a new key and refetches. **You never write a refetch call by hand.**
- **Any filter change that narrows results must also reset `page` to `DEFAULT_PAGE`**, or the user lands on an empty page 7 of a 2-page result set.
- URL query keys are **English** (`search`, `page`, `insurance`) even though route segments are French. Keys are code.

### 9.5 `server/procedures.ts` — the slice's router

```ts
// src/modules/patients/server/procedures.ts
import { z } from "zod";
import { and, count, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "@/database";
import { patients, treatments, payments, appointments } from "@/database/schema";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "@/trpc/init";
import { patientInsertSchema, patientUpdateSchema } from "../schemas";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";

export const patientsRouter = createTRPCRouter({
  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      // NO staff scoping — §1. Staff share the clinic's data.
      const [existing] = await db
        .select({
          ...getTableColumns(patients),
          // Derived money, computed in SQL. Never fetched-and-summed in JS.
          totalAmountCents: sql<number>`COALESCE((
            SELECT SUM(${treatments.totalAmountCents})
            FROM ${treatments} WHERE ${treatments.patientId} = ${patients.id}
          ), 0)::int`,
          amountPaidCents: sql<number>`COALESCE((
            SELECT SUM(${payments.amountCents})
            FROM ${payments} WHERE ${payments.patientId} = ${patients.id}
          ), 0)::int`,
          appointmentCount: db.$count(appointments, eq(appointments.patientId, patients.id)),
        })
        .from(patients)
        .where(eq(patients.id, input.id));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" });
      }
      // «Reste à payer» is derived, never stored.
      return { ...existing, remainingCents: existing.totalAmountCents - existing.amountPaidCents };
    }),

  getMany: protectedProcedure
    .input(z.object({
      page: z.number().default(DEFAULT_PAGE),
      pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
      search: z.string().nullish(),
      insurance: z.enum(["cnss", "cnops", "mutuelle", "none"]).nullish(),
    }))
    .query(async ({ input }) => {
      const { search, insurance, page, pageSize } = input;

      // ONE predicate, used by BOTH queries — they can never drift.
      const where = and(
        search
          ? or(
              ilike(patients.lastName, `%${search}%`),
              ilike(patients.firstName, `%${search}%`),
              ilike(patients.phone, `%${search}%`),
            )
          : undefined,                                  // undefined = clause omitted
        insurance ? eq(patients.insurance, insurance) : undefined,
      );

      const data = await db
        .select({ ...getTableColumns(patients) })
        .from(patients)
        .where(where)
        .orderBy(desc(patients.createdAt), desc(patients.id))  // id tiebreaker → stable paging
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await db.select({ count: count() }).from(patients).where(where);

      return { items: data, total: total.count, totalPages: Math.ceil(total.count / pageSize) };
    }),

  create: protectedProcedure
    .input(patientInsertSchema)
    .mutation(async ({ input, ctx }) => {
      const [created] = await db
        .insert(patients)
        .values({ ...input, createdByStaffId: ctx.auth.user.id })  // audit, from ctx
        .returning();
      return created;
    }),

  update: protectedProcedure
    .input(patientUpdateSchema)
    .mutation(async ({ input }) => {
      const { id, ...values } = input;                  // never spread `id` into .set()
      const [updated] = await db
        .update(patients)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(patients.id, id))
        .returning();

      if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" });
      return updated;
    }),

  // DESTRUCTIVE ⇒ adminProcedure. §6.1.
  remove: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const [removed] = await db.delete(patients).where(eq(patients.id, input.id)).returning();
      if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "Patient introuvable" });
      return removed;
    }),
});
```

**Procedure rules:**

| # | Rule |
|---|---|
| 1 | **No `WHERE` clause ever filters by the calling staff member.** §1. This inverts the blueprint. |
| 2 | **Every `remove` is an `adminProcedure`.** Every procedure in `expenses` is an `adminProcedure`. |
| 3 | `getMany` **always** returns `{ items, total, totalPages }`. Never a bare array — the client needs the envelope for pagination, and adding it later breaks every consumer. |
| 4 | `orderBy(desc(createdAt), desc(id))` — the `id` tiebreaker prevents rows shuffling between pages. The agenda orders by `startsAt` ascending, with an `id` tiebreaker. |
| 5 | Conditional filters use the ternary-to-`undefined` idiom inside `and(...)`. Drizzle drops `undefined` clauses. **Never build SQL by string concatenation** — interpolate through the `sql` tag only. |
| 6 | The list `where` and the count `where` **must be identical** — extract to one `const where`. |
| 7 | **Derived scalars are computed in SQL** (`db.$count`, correlated `sql<number>` subqueries), never by fetching rows and reducing in JS. Cast money subqueries with `::int` so they arrive as numbers, not strings. |
| 8 | `pageSize` is bounded by `MIN_PAGE_SIZE`/`MAX_PAGE_SIZE` in the Zod schema. Unbounded page sizes are a denial-of-service vector. |
| 9 | Fields the user must not set (`createdByStaffId`, timestamps, derived money) come from `ctx` or defaults — **never spread in from `input`**. |
| 10 | Every `TRPCError` `message` is **French user-facing copy** — it is rendered verbatim by `toast.error`. |
| 11 | A mutation returns the affected row via `.returning()`; an empty result is `NOT_FOUND`, never a silent success. |
| 12 | `ilike` is accent-*sensitive*. If the clinic needs "Benali" to match "Bénali", enable the Postgres `unaccent` extension and wrap both sides — do not fake it in JS after fetching. |

**Joins and computed columns** follow the same shape — nest the whole related row under a key so it is typed with no manual mapping:

```ts
const data = await db
  .select({
    ...getTableColumns(treatments),
    patient: patients,                       // whole related row, nested and fully typed
    amountPaidCents: sql<number>`COALESCE((
      SELECT SUM(${payments.amountCents})
      FROM ${payments} WHERE ${payments.treatmentId} = ${treatments.id}
    ), 0)::int`,
  })
  .from(treatments)
  .innerJoin(patients, eq(treatments.patientId, patients.id));
```

### 9.6 Cross-slice dependencies

**Allowed, one direction only:**
- A slice's **UI** may import another slice's UI component (the appointment form opens `NewPatientDialog`).
- A slice's **view** may call another slice's **procedure** via `trpc.<other>.<proc>`.
- A slice's `procedures.ts` may import another slice's **table** from `schema.ts`.

**Forbidden:**
- Importing another slice's `procedures.ts` directly. Go through the router.
- Circular slice imports. If two slices need each other's internals, the shared part belongs in `src/components/shared/` or `src/lib/`.

---

## 10. Layer 7 — Client UI Conventions

### 10.1 The mutation + invalidation contract

Every mutation follows this exact shape. **There is no optimistic updating in this architecture** — invalidate, and let the refetch be the source of truth.

```tsx
const trpc = useTRPC();
const queryClient = useQueryClient();

const createPayment = useMutation(
  trpc.payments.create.mutationOptions({
    onSuccess: async () => {
      // Invalidate EVERY query this mutation could have changed — across slices.
      await queryClient.invalidateQueries(trpc.payments.getManyByPatient.queryOptions({ patientId }));
      await queryClient.invalidateQueries(trpc.patients.getOne.queryOptions({ id: patientId }));
      await queryClient.invalidateQueries(trpc.treatments.getManyByPatient.queryOptions({ patientId }));
      await queryClient.invalidateQueries(trpc.dashboard.getStats.queryOptions());
      toast.success("Paiement enregistré");
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message);   // procedure messages are French copy — §9.5/10
    },
  }),
);
```

**Rules:**
1. `onSuccess` invalidates **every** query whose result the mutation could have changed — including derived balances and dashboard counters owned by other slices. A payment changes the patient's «reste à payer», the treatment's balance, and the dashboard revenue. Under-invalidating produces stale UI that users read as a bug — **and in a financial context, as a wrong number.**
2. `onError` always calls `toast.error(error.message)`.
3. `error.data?.code` drives behavior. **Never parse the message string.**
4. **Never `setQueryData` by hand.** Invalidate.
5. Success toasts are short French sentences: "Patient enregistré", "Rendez-vous annulé", "Charge supprimée".

### 10.2 One form, two modes

A slice has **one** form component handling create and update, keyed off `initialValues`:

```tsx
interface PatientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  initialValues?: PatientGetOne;   // present ⇒ edit mode
}

const form = useForm<z.infer<typeof patientInsertSchema>>({
  resolver: zodResolver(patientInsertSchema),   // the SAME schema the procedure validates
  defaultValues: {
    firstName: initialValues?.firstName ?? "",
    lastName: initialValues?.lastName ?? "",
    insurance: initialValues?.insurance ?? "none",
  },
});

const isEdit = !!initialValues?.id;
const isPending = createPatient.isPending || updatePatient.isPending;

const onSubmit = (values: z.infer<typeof patientInsertSchema>) => {
  if (isEdit) updatePatient.mutate({ ...values, id: initialValues.id });
  else createPatient.mutate(values);
};
```

Two dialogs wrap the one form: `new-<domain>-dialog.tsx` and `update-<domain>-dialog.tsx`, both through `ResponsiveDialog`. `isPending` disables **both** submit and cancel. Never let a user cancel out of an in-flight mutation.

### 10.3 Error code → UI behavior

| `TRPCError` code | Thrown by | Client behavior |
|---|---|---|
| `UNAUTHORIZED` | `protectedProcedure` | `ErrorBoundary` fallback; `proxy.ts` + page redirect normally prevent it |
| `FORBIDDEN` | `adminProcedure`, deactivated account | `toast.error(message)`. **Do not redirect.** Render an explicit "Action réservée à l'administrateur" state — the user must understand *why*, not be bounced. |
| `NOT_FOUND` | any procedure | `ErrorBoundary` fallback for queries; toast for mutations |
| `CONFLICT` | appointment double-booking a chair | toast + inline field error on the time field |
| `BAD_REQUEST` | Zod `.input()` | Should be unreachable — the form validates with the same schema first |

### 10.4 Shared composites (`src/components/shared/`)

Build these before the second module, not after the fourth.

| Component | Contract |
|---|---|
| `responsive-dialog.tsx` | `Dialog` on desktop, `Drawer` on mobile via `useIsMobile()`. **Every modal in the app goes through it** — never import `Dialog` directly in a slice. |
| `data-table.tsx` | Generic over `<TData, TValue>`, wraps `useReactTable` with `getCoreRowModel`. Takes `columns`, `data`, `onRowClick`. Renders its own "Aucun résultat" row. |
| `data-pagination.tsx` | `page`, `totalPages`, `onPageChange`. Stateless — the URL is the state. |
| `command-select.tsx` | Searchable select on `cmdk`. `onSearch` present ⇒ server-side filtering (`shouldFilter={!onSearch}`). This is the patient picker. |
| `empty-state.tsx` / `loading-state.tsx` / `error-state.tsx` | `{ title, description }`, French. The only three ways the app expresses those states. |
| `money-input.tsx` | Renders the `1 250,00 | DH` split field from the design system. **Value in and out is integer centimes.** Parsing happens here, once. |
| `status-badge.tsx` | Takes a variant key, reads the label from the slice's label map, applies the §11.4 badge palette. |
| `generated-avatar.tsx` | Deterministic avatar from a seed (patient name). |

One hook, exactly one copy, at `src/hooks/use-confirm.tsx`, typed `Promise<boolean>`, named `useConfirm` (lowercase — it is a hook, not a component):

```tsx
const [RemoveConfirmation, confirmRemove] = useConfirm(
  "Êtes-vous sûr ?",
  "Cette action supprimera définitivement le dossier du patient ainsi que ses actes et paiements.",
  "destructive",
);

const handleRemove = async () => {
  const ok = await confirmRemove();   // resolves when the user clicks
  if (!ok) return;
  await removePatient.mutateAsync({ id: patientId });
};
```

**Every destructive action is behind `useConfirm`, and the confirmation copy names the cascade in French.**

### 10.5 Client boundary hygiene

- **Every file that uses a hook carries `"use client"` at the top.** Do not rely on a parent's boundary.
- A `"use client"` file may never import `@/database`, `@/lib/auth`, or anything marked `server-only`.
- Push the `"use client"` boundary as deep as possible: a page's static chrome stays a Server Component; only the interactive view is a client component.

---

## 11. UI, Design System & French Localization

### 11.1 The language rule — absolute

| Layer | Language |
|---|---|
| Variable names, functions, types, files, folders under `src/modules/` | **English** |
| DB table names, column names, **`pgEnum` values** | **English** snake_case |
| URL query keys (`search`, `page`) | **English** |
| **Route segments** (`/patients`, `/agenda`, `/actes`, `/charges`) | **French** |
| **Every string a user can see**: labels, placeholders, buttons, table headers, toasts, empty states, error messages, Zod messages, `TRPCError` messages, page `<title>` | **French** |
| Code comments | English |

No i18n library. No translation files. French strings are written inline in the UI, and enum copy lives in the slice's `constants.ts` label maps (§9.3). **Never leave an English string in a rendered component.**

French typography: `«  »` guillemets when quoting, `’` for apostrophes in copy, and a non-breaking space before `:` `?` `!` in prose.

### 11.2 Design tokens — from `prompt_material/01-dentaflow-design-system.png`

Declared once in `src/app/globals.css` as Tailwind v4 `@theme` tokens. **Never hardcode a hex value in a component.**

| Token | Hex | Use |
|---|---|---|
| Teal primaire | `#0D9488` | primary actions, active nav, logo mark |
| Teal foncé | `#0F766E` | hover / pressed on primary |
| Teal clair | `#CCFBF1` | tints, selected rows, badge backgrounds |
| Bleu ardoise | `#1E293B` | headings, `--foreground` |
| Succès | `#16A34A` | "Payé", "Confirmé" |
| Avertissement | `#D97706` | "Reste à payer", "En attente" |
| Danger | `#DC2626` | "Impayé", "Annulé", destructive |
| Information | `#2563EB` | "En cours", informational |
| Texte / 1 | `#1E293B` | body text |
| Texte / 2 | `#475569` | secondary text |
| Discret | `#94A3B8` | muted, placeholders, meta |
| Bordure | `#E2E8F0` | borders, dividers |
| Fond | `#F8FAFC` | app background |

**Spacing base is 4px.** **Radius is 8–9px** (`--radius: 0.5rem`). Button heights: `sm 32px`, `md 38px`, `lg 44px`. The logo slot is a 40×40 Lucide mark on teal, replaced per deployment (§13.3).

### 11.3 Typography & formats

Fonts: **Poppins** for headings (`--font-heading`), **Inter** for interface and all numeric data (`--font-sans`). **Tabular figures (`font-variant-numeric: tabular-nums`) are mandatory anywhere amounts are stacked in a column.**

| Role | Size | Weight | Line height |
|---|---|---|---|
| H1 — titre de page | 32px | Bold | 1.2 |
| H2 — titre de section | 24px | SemiBold | 1.3 |
| H3 — titre de carte | 20px | SemiBold | 1.3 |
| H4 — sous-titre | 16px | Medium | 1.4 |
| Corps large | 16px | Regular | 1.6 |
| Corps | 14px | Regular | 1.6 |
| Interface — boutons, champs | 13px | Medium | 1.4 |
| Étiquette — libellés, méta | 11px | SemiBold | 1.4 |

**All formatting lives in `src/lib/format.ts`. Never format inline.**

```ts
// src/lib/format.ts
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/** 125000 → "1 250,00 DH" */
export const formatDH = (cents: number) =>
  `${new Intl.NumberFormat("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(cents / 100)} DH`;

/** "1 250,00" | "1250.5" → 125000. The single parse point for money input. */
export const parseDH = (input: string) =>
  Math.round(Number(input.replace(/[\s  ]/g, "").replace(",", ".")) * 100);

export const formatDate = (d: Date | string) => format(new Date(d), "dd/MM/yyyy", { locale: fr });
export const formatTime = (d: Date | string) => format(new Date(d), "HH' h 'mm", { locale: fr });
export const formatDateTime = (d: Date | string) => `${formatDate(d)} à ${formatTime(d)}`;

/** "+212661234567" → "+212 6 61 23 45 67" */
export const formatPhone = (e164: string) =>
  e164.replace(/^(\+212)(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4 $5 $6");

/** "26" → "Dent 26" */
export const formatTooth = (fdi: string) => `Dent ${fdi}`;
```

| Format | Rendering |
|---|---|
| Montant | `1 250,00 DH` — **always two decimals, always the `DH` suffix, never `MAD`, never `€`, never `$`** |
| Date | `12/03/2026` (`dd/MM/yyyy`) |
| Heure | `14 h 30` |
| Téléphone | `+212 6 61 23 45 67` |
| Dent | `FDI — 11 à 48` |

**Money is never rendered from a raw number. It always goes through `formatDH`.** A bare `{amount}` in JSX is a bug.

### 11.4 Status badges

Three badge families, exactly as drawn in the design system. Labels come from the slice's label map; colors from the tokens.

| Family | Values (label ← condition/enum) |
|---|---|
| **Paiement** (computed, never stored) | **Payé** ← `remainingCents <= 0 && totalAmountCents > 0` (succès) · **Reste à payer** ← `0 < amountPaidCents < totalAmountCents` (avertissement) · **Impayé** ← `amountPaidCents === 0 && totalAmountCents > 0` (danger) · **En cours** ← treatment `in_progress` (information) |
| **Rendez-vous** | **Confirmé** ← `confirmed` (succès) · **En attente** ← `pending` (avertissement) · **Annulé** ← `canceled` / `no_show` (danger) · **Terminé** ← `completed` (neutre) |
| **Couverture** | **CNSS** ← `cnss` · **CNOPS** ← `cnops` · **Mutuelle** ← `mutuelle` (teal clair) · **Sans couverture** ← `none` (neutre) |

Badge shape: pill, tinted background, a colored dot on the payment family, 11px SemiBold label.

### 11.5 Component sourcing

- **Every primitive comes from shadcn.** If one is missing, add it with `npx shadcn@latest add <component>`. Never hand-roll a `Select`, `Dialog`, `Popover`, or `Table`.
- `src/components/ui/*` is generated code. **Do not hand-edit it.** Compose or wrap instead.
- Icons come from `lucide-react` only.
- The configured style is `base-nova` with baseColor `neutral` — do not change `components.json`.
- **Before building any screen: open the matching image in `prompt_material/` and match it.** Spacing, card boundaries, column order, and label wording are specified there, not by your taste.

---

## 12. Clinical Domain Rules

### 12.1 FDI tooth numbering — the only accepted system

Never Universal (1–32), never Palmer. FDI two-digit codes, stored as `string[]` in `treatments.teeth`.

| Dentition | Quadrants | Valid codes |
|---|---|---|
| **Adulte** (permanent) | 1 = haut droit, 2 = haut gauche, 3 = bas gauche, 4 = bas droit | `11–18`, `21–28`, `31–38`, `41–48` |
| **Enfant** (temporaire) | 5 = haut droit, 6 = haut gauche, 7 = bas gauche, 8 = bas droit | `51–55`, `61–65`, `71–75`, `81–85` |

Validation lives in `src/modules/odontogram/constants.ts` and is reused by every Zod schema that accepts a tooth:

```ts
// src/modules/odontogram/constants.ts
const quadrant = (q: number, n: number) => Array.from({ length: n }, (_, i) => `${q}${i + 1}`);

export const ADULT_TEETH = [...quadrant(1, 8), ...quadrant(2, 8), ...quadrant(3, 8), ...quadrant(4, 8)];
export const CHILD_TEETH = [...quadrant(5, 5), ...quadrant(6, 5), ...quadrant(7, 5), ...quadrant(8, 5)];
export const ALL_TEETH = [...ADULT_TEETH, ...CHILD_TEETH] as const;
```

```ts
// in a slice schema
teeth: z.array(z.enum(ALL_TEETH))
  .min(1, { message: "Sélectionnez au moins une dent" }),
```

**A free `z.string()` for a tooth code is a bug.** Display always goes through `formatTooth` → `"Dent 26"`, never a raw index.

### 12.2 Odontogram — `react-advanced-odontogram`

The package is **client-only**: it reads the DOM, ships its own stylesheet, and holds module-level engine state (**one instance per page**).

**Mandatory integration shape:**

```tsx
// src/modules/odontogram/ui/odontogram-canvas.tsx
"use client";                              // ssr:false is ONLY legal inside a Client Component
import dynamic from "next/dynamic";
import "react-advanced-odontogram/style.css";
import { Skeleton } from "@/components/ui/skeleton";

const OdontogramCanvas = dynamic(
  () => import("react-advanced-odontogram").then((m) => m.OdontogramShell),
  { ssr: false, loading: () => <Skeleton className="h-130 w-full rounded-lg" /> },
);

export default OdontogramCanvas;
```

```tsx
// src/modules/odontogram/ui/views/odontogram-view.tsx
"use client";
// 1. useSuspenseQuery(trpc.odontogram.getOne.queryOptions({ patientId, dentition }))
// 2. importStatus(data.chart) on mount
// 3. debounced (>= 800ms) exportStatus() → trpc.odontogram.save.mutate({ patientId, dentition, chart })
// 4. <OdontogramCanvas language="FR" numberingSystem="FDI" />
```

**Rules:**
1. **Never import `react-advanced-odontogram` from a Server Component, a page, or any file without `"use client"`.** `ssr: false` in a Server Component is a hard Next.js error: *"`ssr: false` is not allowed with `next/dynamic` in Server Components."*
2. `language="FR"` and `numberingSystem="FDI"` are fixed props. Never expose them as user settings.
3. Exactly **one** `OdontogramCanvas` per page — the library holds module-level state.
4. Persistence goes through `exportStatus()` / `importStatus()` into the `jsonb` column. **The payload is opaque to us**: type it as an `OdontogramChart` alias in `src/modules/odontogram/types.ts`, never destructure its internals, never write a migration that rewrites its shape.
5. Saves are **debounced and idempotent** — `save` is an upsert on `(patientId, dentition)` via `onConflictDoUpdate`, not one mutation per click.
6. The chart is prefetched by the patient detail page like any other query (§8.2). The dynamic import handles the *component*; the *data* still follows the hydration flow.
7. `exportFhir`, `exportSvg`, `exportImage` exist for record export — call them client-side, never on the server.

### 12.3 Finances

- **Every money value in the database is `integer` centimes.** Every money value crossing the tRPC boundary is `integer` centimes. Conversion happens exactly twice: `parseDH` on input, `formatDH` on output.
- `treatments.totalAmountCents` is **stored**.
- `amountPaidCents` is **derived in SQL** as `SUM(payments.amountCents)` scoped to the treatment (or the patient). **It is never stored.** A stored copy drifts the first time a payment is edited or deleted, and a drifted balance in a clinic is a billing dispute. The read procedure still *returns* it, so the API surface matches the spec — the storage does not.
- `remainingCents` («reste à payer») `= totalAmountCents - amountPaidCents`, computed in the procedure. **Never stored, never computed in a component.**
- Every read procedure returning a treatment or a patient balance returns all three: `totalAmountCents`, `amountPaidCents`, `remainingCents`. Components never subtract.
- A payment may exceed the treatment total (advance / «avance»); `remainingCents` may be negative and is rendered as a credit. **Do not clamp it to zero silently.**
- `expenses` («charges du cabinet») are **admin-only end to end** — router, page, and sidebar entry. A non-admin must not see the sidebar link, **and** the procedure must still reject them if they type the URL.
- Dashboard revenue = `SUM(payments.amountCents)` over the period. Dashboard profit = revenue − `SUM(expenses.amountCents)`. Both are `adminProcedure`.
- Insurance coverage (`cnss` / `cnops` / `mutuelle`) is recorded on the patient and shown as a badge. It does **not** alter amounts automatically — a reimbursement is entered as a `payment` with `method: "insurance"`.

### 12.4 Appointments & the agenda

- `startsAt` / `endsAt` are `timestamp with time zone`. The clinic operates in `Africa/Casablanca`; **store UTC, render local**. Never store a naive local time.
- A `create`/`update` procedure **must reject an overlap on the same chair**: `TRPCError({ code: "CONFLICT", message: "Ce fauteuil est déjà occupé sur ce créneau." })`. The predicate is `startsAt < :end AND endsAt > :start` on the same `chairId`, excluding the row being updated.
- Chair allocation (`chairId`) is **required**. An appointment with no chair cannot be scheduled.
- The agenda's day/week selection lives in the URL via nuqs (`date`, `view`, `chairId`) — it is filter state like any other, and it is what makes the agenda SSR-prefetchable.
- The agenda grid is built in-slice with CSS grid (columns = chairs, rows = time slots). Do not add a calendar library.
- Statuses transition `pending → confirmed → completed`, with `canceled` / `no_show` terminal. Enforce legal transitions in the procedure, not in the UI.

---

## 13. Cross-Cutting Concerns

### 13.1 Global constants

```ts
// src/constants.ts
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 100;
export const MIN_PAGE_SIZE = 1;

export const CLINIC_TIMEZONE = "Africa/Casablanca";
export const CURRENCY_SUFFIX = "DH";
```

Consumed by three layers at once: the Zod input bounds, the nuqs defaults, and the pagination UI. **A magic number in any of those three is a bug waiting to happen.** Per-slice constants live in the slice.

### 13.2 Third-party server clients

One file per vendor in `src/lib/`, each starting with `import "server-only";`. Secrets never leave `src/lib/*` and the procedures that import them. Public values use `NEXT_PUBLIC_*`. **Never hardcode an environment** — drive it from `process.env`.

### 13.3 White-label configuration

Clinic name, logo, and accent color are **deployment configuration**, not a database feature and not a settings-panel afterthought:

- `NEXT_PUBLIC_CLINIC_NAME` — renders in the sidebar, the `<title>`, and printed documents.
- `public/logo.svg` — swapped per deployment. The fallback is the 40×40 Lucide mark on teal, exactly as in the design system.
- The accent token may be overridden per clinic in `globals.css`. **All other tokens stay fixed.**

**Do not build a tenant-configuration table or an admin theming UI.** A new clinic is a new deployment.

### 13.4 Medical-data handling

- Never log a patient name, phone, CIN, or medical note. Log ids.
- Never send patient data to a third-party service without an explicit instruction in the task.
- No analytics or error-reporting SDK that captures request bodies.
- Deletes of clinical records are `adminProcedure` + `useConfirm` + confirmation copy naming the cascade.

---

## 14. Checklist — Adding a New Module

Follow in order. Each step typechecks before the next.

**Database**
1. Add the table to `src/database/schema.ts`: `text` id + `nanoid()`, **no tenancy `userId`**, `createdByStaffId` nullable with `set null`, `createdAt`/`updatedAt` `defaultNow()`, `pgEnum` for lifecycle state, money as `integer` `*Cents`, an index on every column you filter or sort by.
2. `npm run db:push`.

**Slice contracts**
3. `schemas.ts` — `<domain>InsertSchema`, then `<domain>UpdateSchema = insert.extend({ id })`. French messages.
4. `server/procedures.ts` — `getOne`, `getMany`, `create`, `update`, `remove`. **No staff scoping on reads. `remove` is `adminProcedure`.** `getMany` returns `{ items, total, totalPages }`. Derived money in SQL.
5. Register the router in `src/trpc/routers/_app.ts` — one line.
6. `types.ts` — `<Domain>GetOne`, `<Domain>GetMany`, plus a TS enum mirroring each `pgEnum`.
7. `constants.ts` — French label maps + options arrays for every enum.

**URL state**
8. `params.ts` — parsers + `createLoader`.
9. `hooks/use-<domain>-filters.ts` — **the same parsers, the same defaults**.

**UI**
10. **Open `prompt_material/` and match the reference.**
11. `ui/columns.tsx` — `ColumnDef<<Domain>GetMany[number]>[]`, French headers, `formatDH` / `formatDate` in cells.
12. `ui/views/<domain>-view.tsx` — `"use client"`, `useSuspenseQuery`, named `<Domain>ViewLoading` / `<Domain>ViewError` exports.
13. `ui/views/<domain>-id-view.tsx` — id prop, `useSuspenseQuery` on `getOne`, its own loading/error exports.
14. `ui/<domain>-form.tsx` — one form, `initialValues` toggles edit mode, `zodResolver(<domain>InsertSchema)`.
15. `ui/new-<domain>-dialog.tsx` + `ui/update-<domain>-dialog.tsx` — both through `ResponsiveDialog`.
16. `ui/list-header.tsx` — French title, "Nouveau …" button, filters, "Effacer les filtres".

**Routes (Next 16)**
17. `src/app/(dashboard)/<french-segment>/page.tsx` — `await searchParams` → **this slice's** `loadSearchParams`, `await headers()` → session → `redirect("/connexion")`, `getQueryClient()`, `void prefetchQuery`, `HydrationBoundary > Suspense > ErrorBoundary > View`.
18. `src/app/(dashboard)/<french-segment>/[<domain>Id]/page.tsx` — `await params`, same flow with `getOne`.
19. Extend `proxy.ts`'s `matcher`, and add the sidebar entry (hidden for non-admins where the slice is admin-only).

**Verify**
20. `npx tsc --noEmit` and `npm run lint` both clean.
21. Load the list page with filters in the URL and confirm **no client refetch on hydration** — zero `/api/trpc` calls in the Network tab on first paint. A request here means the server and client query keys diverged; go back to §8.4.
22. Confirm every mutation's `onSuccess` invalidates the list, the detail, **and every derived balance or dashboard counter it touched**.
23. Sign in as a non-admin and attempt every `remove` and every `expenses` route. All must return `FORBIDDEN` with the French message **from the procedure** — not from the UI hiding a button.
24. Confirm every visible string is French and every amount renders as `1 250,00 DH`.

---

## 15. Anti-Patterns — reject these on sight

| # | Anti-pattern | Correct form |
|---|---|---|
| 1 | `where(eq(table.userId, ctx.auth.user.id))` on a read | **No staff scoping.** Single-tenant. §1 |
| 2 | `premiumProcedure`, a billing table, `/upgrade`, `MAX_FREE_*` | `adminProcedure`. No billing exists. §6.1 |
| 3 | `createTRPCContext` returning a placeholder `{ userId: "user_123" }`, or re-fetching the session per procedure | Build the real session once in the cached context; `protectedProcedure` narrows it. §6.1 |
| 4 | Providers wrapping `<html>` in the root layout | `<html><body>` outermost, providers inside `<body>`. §7.1 |
| 5 | A page importing another slice's `loadSearchParams` | Each page imports its own slice's loader. §8.4/9 |
| 6 | `middleware.ts` / `export function middleware` | `src/proxy.ts` / `export function proxy`. §7.4 |
| 7 | Sync `params`, `searchParams`, `cookies()`, `headers()` | Await all of them. §7.3 |
| 8 | `useEffect` + `useState` + `fetch` for data | Prefetch + `useSuspenseQuery`. §8 |
| 9 | `await queryClient.prefetchQuery(...)` in a page | `void queryClient.prefetchQuery(...)`. §8.4/1 |
| 10 | A view receiving `data` as a prop from the page | Views take identifiers. §8.4/6 |
| 11 | Money as `numeric`, `real`, or a JS float; `amount / 100` inline in JSX | `integer` centimes + `formatDH`. §12.3 |
| 12 | `amountPaid` stored as a column | Derived in SQL from `payments`. §12.3 |
| 13 | `react-advanced-odontogram` imported in a Server Component, or `ssr: false` outside a Client Component | The shape in §12.2 |
| 14 | Universal or Palmer tooth numbering; `z.string()` for a tooth | FDI, validated against `ALL_TEETH`. §12.1 |
| 15 | An English string in a rendered component; `MAD` / `€` / `$`; `<html lang="en">` | French UI, `DH`, `lang="fr"`. §11.1 |
| 16 | A hardcoded hex color, or a French enum label inlined in a component | `globals.css` tokens + the slice's label map. §11.2 / §9.3 |
| 17 | A hand-written `interface Patient { ... }` | `inferRouterOutputs`. §9.2 |
| 18 | Filter or pagination state in `useState` | nuqs. §9.4 |
| 19 | `setQueryData` after a mutation | `invalidateQueries`. §10.1 |
| 20 | A destructive action with no `useConfirm` | Confirm, naming the cascade in French. §10.4 |
| 21 | `Dialog` imported directly in a slice | `ResponsiveDialog`. §10.4 |
| 22 | A hook used in a file with no `"use client"` | Every such file carries the directive. §10.5 |
| 23 | Hand-editing `src/components/ui/*` | Compose or wrap. §11.5 |
| 24 | A bare array returned from `getMany` | `{ items, total, totalPages }`. §9.5/3 |
| 25 | A procedure defined inline in `_app.ts` | Slices only. §6.5 |
| 26 | `use-confirm` duplicated per slice, or returning `Promise<unknown>` | One copy at `src/hooks/use-confirm.tsx`, `Promise<boolean>`. §10.4 |
| 27 | Default `"Create Next App"` metadata, or typos reaching users | Procedure and UI strings are French copy — review them as copy. §7.1 / §9.5/10 |
| 28 | Building UI without checking `prompt_material/` | Read the reference first. §0/2 |
