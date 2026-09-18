<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

---

# DENTAFLOW — AGENT RULEBOOK

**Imperative, not advisory.** Every rule is a hard constraint. When a request conflicts with a rule here, say so in one sentence, then implement the rule-compliant version. Never silently deviate.

DentaFlow is a dental-practice management system for a Moroccan cabinet. French UI, English code, Next.js 16 + tRPC v11 + Drizzle/Neon + Better Auth + shadcn.

---

## 0. Before you write any code

1. **Read the Next.js docs for the installed version** at `node_modules/next/dist/docs/`. Your training data about `middleware.ts`, sync `params`, `experimental.ppr` and the Webpack default is **wrong for this repo**.
2. **Read the reference doc for your task** (§9). Do not work from this file alone — it is a summary, not the specification.
3. **Read the branch's prompt file** in `prompts/`. It states the scope fence — the only paths you may modify. Do not touch anything outside it; if the task genuinely requires it, stop and say so.
4. **Check `prompt_material/` before building any UI.** Open the PNG with your image tool and read its sibling `.md` spec. If a screen has no reference, say so explicitly, then derive it from the design tokens.
5. **Never scaffold placeholders.** No `// TODO`, no `userId: "user_123"`, no mock arrays. The only sanctioned fake data is `src/database/seed.ts`.
6. **Verify only what you can observe.** Run `npx tsc --noEmit`, `npm run lint`, `npm run test`. Report real output. You have no browser — never claim visual, network or hydration verification. List those under **"requires manual verification"**.
7. **You do not commit.** Leave the tree dirty and summarize. The human reviews the diff.

---

## 1. Prime directives

1. **`src/app/` is a routing shell.** A file there may do exactly four things: read the session, `await` `params`/`searchParams`, prefetch queries, render a component from `src/modules/`. No business logic, no data mapping, no JSX beyond the hydration wrapper.
2. **All application code lives in a vertical slice** under `src/modules/<domain>/`.
3. **The only client data path is tRPC.** No `fetch('/api/...')`, no Server Actions for domain data, no `db` import in any `"use client"` file.
4. **Every query a page renders is prefetched on the server and consumed with `useSuspenseQuery`.** Never `useEffect` + `useState` for data. `<Suspense>` owns loading; `<ErrorBoundary>` owns failure.
5. **Authorization is enforced in the procedure** — never in the UI, never in `proxy.ts`.
6. **Types flow upward from the database.** `schema.ts` → Drizzle inference → procedure return → `inferRouterOutputs` → props. Never hand-write a domain interface.
7. **Every Next.js request API is async.** `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` must be awaited. No synchronous fallback exists in 16.
8. **French UI, English code.** §5. Absolute.

---

## 2. Tenancy — the biggest divergence from the MeetAI blueprint

**Single-tenant, one clinic per deployment per database.** Every user is a staff member. Patients are records, never users.

> **A query procedure must NEVER filter rows by the calling staff member's id.** Every authenticated staff member sees the entire clinic's data. Isolation is by deployment, not by a `WHERE` clause.

```ts
// ✅ read — no staff scoping
await db.select().from(patients).where(eq(patients.id, input.id));

// ✅ write — staff id stamped from ctx, for the audit trail only
await db.insert(patients).values({ ...input, createdByStaffId: ctx.auth.user.id });

// ❌ the blueprint's multi-tenant pattern. Never here.
.where(and(eq(patients.id, input.id), eq(patients.createdByStaffId, ctx.auth.user.id)))
```

`createdByStaffId` / `updatedByStaffId` are **audit only** — written, never read as a filter.

Because there is no ownership filter, **every destructive mutation is protected by role**: every `remove` is an `adminProcedure`, and every procedure in the `expenses` slice is an `adminProcedure` including reads.

**No billing exists.** No Polar, no Stripe, no `/upgrade`, no usage counters, no `MAX_FREE_*`, no `premiumProcedure`.

---

## 3. Stack — pinned

| Concern         | Package                                                            | Note                                                                                                                                                                                                         |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Framework       | `next@16`                                                          | Turbopack default. `proxy.ts`, not `middleware.ts`.                                                                                                                                                          |
| Runtime         | `react@19`                                                         |                                                                                                                                                                                                              |
| API             | `@trpc/server` + `@trpc/client` + `@trpc/tanstack-react-query` v11 | **Never** legacy `@trpc/react-query`. Style is `useTRPC()` + `.queryOptions()`.                                                                                                                              |
| Cache           | `@tanstack/react-query@5`                                          |                                                                                                                                                                                                              |
| Serialization   | `superjson`                                                        | **Mandatory, three places.** `init.ts`, `client.tsx`, `query-client.ts`. All or nothing.                                                                                                                     |
| ORM             | `drizzle-orm` + `drizzle-kit`                                      | **`generate` + `migrate` only. `push` is forbidden.**                                                                                                                                                        |
| Driver          | `@neondatabase/serverless`                                         | HTTP — **no interactive transactions**.                                                                                                                                                                      |
| Auth            | `better-auth`                                                      | Drizzle adapter, `role` + `isActive` additional fields.                                                                                                                                                      |
| Validation      | `zod`                                                              | One schema for the procedure input and the `zodResolver`.                                                                                                                                                    |
| URL state       | `nuqs@2`                                                           | `nuqs/adapters/next/app`. The **only** store for filter/pagination state.                                                                                                                                    |
| Forms           | `react-hook-form` + `@hookform/resolvers`                          | Always inside shadcn `<Form>`.                                                                                                                                                                               |
| Tables          | `@tanstack/react-table`                                            |                                                                                                                                                                                                              |
| UI              | `shadcn/ui` + Tailwind v4                                          | `base-nova`, neutral, lucide. No `tailwind.config.ts`; tokens in `globals.css`.                                                                                                                              |
| Agenda          | Origin UI event calendar in `src/components/event-calendar/`       | Installed from a shadcn registry (`npx shadcn@latest add https://coss.com/origin/r/comp-542.json`), then patched. MIT, alpha. Ours once installed — every edit logged in `PATCHES.md`. See `07-calendar.md`. |
| Dates           | `date-fns` + `date-fns/locale/fr` + `@date-fns/tz`                 | Always `{ locale: fr }`.                                                                                                                                                                                     |
| PDF             | `@react-pdf/renderer`                                              | Overlaid on the clinic's uploaded letterhead.                                                                                                                                                                |
| Errors / toasts | `react-error-boundary`, `sonner`                                   |                                                                                                                                                                                                              |
| Tests           | `vitest`                                                           | Pure logic only: formatters, transitions, filter parity.                                                                                                                                                     |

**Forbidden:** `@polar-sh/*`, `stripe`, any organization/multi-tenant plugin, `axios`, `swr`, `redux`, `zustand`, `jotai`, `moment`, any **npm** calendar library, any SMS/OTP package.

`.npmrc` keeps `legacy-peer-deps=true`. `tsconfig.json` keeps `"strict": true` and `"paths": { "@/*": ["./src/*"] }`.

---

## 4. Directory contract

```
src/
├── app/                        # ROUTING SHELL ONLY
│   ├── layout.tsx              # html > body > NuqsAdapter > TRPCReactProvider
│   ├── globals.css             # Tailwind v4 tokens
│   ├── (auth)/connexion/
│   ├── (dashboard)/            # tableau-de-bord · patients · calendrier · rendez-vous
│   │                           # actes · paiements · charges · documents · activite
│   │                           # taches · statistiques · parametres
│   ├── impression/             # print routes, own layout, escapes the shell
│   └── api/trpc/[trpc]/ · api/auth/[...all]/
├── proxy.ts                    # NEXT 16 network boundary
├── modules/<domain>/           # ALL application code
├── trpc/                       # init · routers/_app · server · client · query-client
├── database/                   # index · schema (one file) · seed
├── lib/                        # auth · auth-client · format · time · pdf · utils
├── components/
│   ├── ui/                     # shadcn — DO NOT hand-edit
│   ├── calendar/               # vendored — edits logged in PATCHES.md
│   └── shared/                 # cross-slice composites
├── hooks/                      # use-confirm, use-mobile
└── constants.ts
```

**Slice layout — identical for every domain:**

```
src/modules/<domain>/
├── server/procedures.ts        # tRPC router (server only)
├── schemas.ts                  # Zod contracts (isomorphic)
├── types.ts                    # inferRouterOutputs + TS enums
├── constants.ts                # French label maps
├── params.ts                   # nuqs SSR loader
├── hooks/use-<domain>-filters.ts   # MIRRORS params.ts exactly
└── ui/
    ├── views/<domain>-view.tsx     # default export + named Loading/Error
    ├── views/<domain>-id-view.tsx
    ├── <domain>-form.tsx           # named export
    ├── columns.tsx                 # named export `columns`
    ├── list-header.tsx
    └── new-/update-<domain>-dialog.tsx
```

- One slice uses it → slice `ui/`. Two or more → `src/components/shared/`. Never the reverse; never pre-emptively generalize.
- `src/lib/` holds clients and pure functions, never React components.
- Anything touching a secret starts with `import "server-only";`.
- **`ui/views/` holds views, `ui/` holds parts.** Never `views/ui/`, never views at the slice root.
- The patient dossier's tabs are **nuqs state on one route**, not nested routes.

> **`src/modules/patients` is the reference implementation.** Every new slice is a structural copy of it. Deviating requires a stated reason in your reply.

---

## 5. Language — absolute

| Layer                                                                                                                           | Language    |
| ------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Variables, types, files, folders, DB tables and columns, **`pgEnum` values**, URL query keys                                    | **English** |
| **Route segments** (`/patients`, `/actes`, `/charges`)                                                                          | **French**  |
| **Every string a user can see** — labels, buttons, headers, toasts, empty states, Zod messages, `TRPCError` messages, `<title>` | **French**  |
| Code comments                                                                                                                   | English     |

No i18n library, no translation files. Enum copy lives in the slice's `constants.ts` label map — **never inline a French enum label in a component**. French typography: `«  »`, `’`, non-breaking space before `:` `?` `!`.

---

## 6. Money, time, identity — the three rules that cause silent bugs

**Money.** Stored as `integer` centimes, column names end in `Cents`. Crosses the tRPC boundary as centimes. Converted exactly twice: `parseDH` in, `formatDH` out. `amountPaidCents` and `remainingCents` are **derived in SQL, never stored** — a stored balance drifts and a drifted balance in a clinic is a billing dispute. `remainingCents` may be negative («Avance») and is never clamped. A bare `{amount}` in JSX is a bug.

**Time.** `timestamp with time zone`, store UTC, render clinic-local. All day/week arithmetic goes through `TZDate` with `CLINIC_TIMEZONE` in `src/lib/time.ts`. **A hardcoded `+01:00` is a bug** — Morocco reverts to UTC+0 during Ramadan every year. Week starts Monday (`WEEK_STARTS_ON = 1`), ISO weekday 1 = lundi.

**Identity.** IDs are `text` + `nanoid()`, never `serial`. Patients additionally carry a 4-character `shortCode` shown in the UI. Every table carries `createdAt` + `updatedAt`.

---

## 7. Scope — what exists, and what does not

| Tier     | Contents                                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| **V1**   | auth · shell · patients + tags · calendrier/RDV · catalogue d'actes · actes · paiements · facture PDF · paramètres |
| **V1.1** | odontogramme · ordonnances · documents générés · activité du jour · charges · salle d'attente                      |
| **V1.2** | feuilles de soins CNSS/CNOPS · statistiques · rappels WhatsApp · certificat médical                                |
| **V2**   | stock · prothèses + labos · page publique + RDV en ligne · avis · imagerie · parrainage                            |

**Out of scope entirely — do not create, reference, import, stub, or prepare for:**

- Any public or unauthenticated route; any `(public)` route group
- Patient accounts, patient sessions, patient portal, online booking by patients
- Any availability / slot-computation procedure
- **Fauteuils / chairs.** There is no chair entity, no chair column, no resource axis. The agenda filters by practitioner and colours by appointment type.
- OTP, SMS, WhatsApp or any messaging gateway
- Rate limiting (nothing is publicly reachable)
- Billing, subscriptions, multi-clinic, `clinicId`, organizations
- Inngest or any background-job runner
- Any i18n library

If a task appears to need one of these, **stop and say so in one sentence** rather than building a partial version. A half-built stub is worse than an absence — it gets mistaken for a contract.

---

## 8. Anti-patterns — reject on sight

| #   | Anti-pattern                                                          | Correct form                                                 | Ref |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------------ | --- |
| 1   | `where(eq(table.<staff>Id, ctx.auth.user.id))` on a read              | No staff scoping                                             | §2  |
| 2   | `premiumProcedure`, billing table, `/upgrade`, `MAX_FREE_*`           | `adminProcedure`; no billing                                 | §2  |
| 3   | A chair / fauteuil entity or column                                   | Does not exist                                               | §7  |
| 4   | `drizzle-kit push`                                                    | `generate` + `migrate`, committed SQL                        | 01  |
| 5   | An overlap check in TS with no DB constraint                          | Exclusion constraint + `23P01` → `CONFLICT`                  | 01  |
| 6   | Money as `numeric`/`real`/float; `amount / 100` in JSX                | `integer` centimes + `formatDH`                              | §6  |
| 7   | `amountPaid` stored as a column                                       | Derived in SQL                                               | §6  |
| 8   | Hardcoded `+01:00`, or `new Date()` for a clinic day boundary         | `TZDate` + `CLINIC_TIMEZONE`                                 | §6  |
| 9   | `superjson` in one place but not all three                            | All three, always                                            | 03  |
| 10  | `middleware.ts` / `export function middleware`                        | `src/proxy.ts` / `export function proxy`                     | 02  |
| 11  | Sync `params`, `searchParams`, `cookies()`, `headers()`               | Await all                                                    | §1  |
| 12  | `useEffect` + `useState` + `fetch` for data                           | Prefetch + `useSuspenseQuery`                                | 04  |
| 13  | `await queryClient.prefetchQuery(...)` in a page                      | `void queryClient.prefetchQuery(...)`                        | 04  |
| 14  | A view receiving `data` as a prop from the page                       | Views take identifiers only                                  | 04  |
| 15  | A page importing another slice's `loadSearchParams`                   | Its own slice's loader                                       | 04  |
| 16  | Computing the agenda's date range separately in page and view         | One shared `getRangeForView`                                 | 07  |
| 17  | Importing the vendored calendar's types outside `calendar-adapter.ts` | The adapter is the only boundary                             | 07  |
| 18  | A bare `<input>` + `useState`, or a manual error `<p>`, in a form     | shadcn `<Form>` + `<FormField>` + `<FormMessage>`            | 06  |
| 19  | `update.onSuccess` invalidating less than `create.onSuccess`          | One shared invalidation block                                | 06  |
| 20  | A `DataTable` with no `<TableHeader>`, or copied into a slice         | Header via `flexRender`; one copy in `shared/`               | 06  |
| 21  | `setQueryData` after a mutation                                       | `invalidateQueries`                                          | 06  |
| 22  | Filter, pagination or agenda date/view state in `useState`            | nuqs                                                         | 05  |
| 23  | A destructive action with no `useConfirm`                             | Confirm, naming the cascade in French                        | 06  |
| 24  | `Dialog` imported directly in a slice                                 | `ResponsiveDialog` (the agenda `Sheet` is the one exception) | 06  |
| 25  | A hook used in a file with no `"use client"`                          | Every such file carries the directive                        | 06  |
| 26  | Hand-editing `src/components/ui/*`                                    | Compose or wrap                                              | 06  |
| 27  | Editing `src/components/calendar/*` without logging it                | Log every edit in `PATCHES.md`                               | 07  |
| 28  | A hand-written `interface Patient { ... }`                            | `inferRouterOutputs`                                         | 05  |
| 29  | A bare array from `getMany`                                           | `{ items, total, totalPages }`                               | 05  |
| 30  | A procedure defined inline in `_app.ts`                               | Slices only                                                  | 03  |
| 31  | An English string in a rendered component; `MAD`/`€`/`$`; `lang="en"` | French, `DH`, `lang="fr"`                                    | §5  |
| 32  | A hardcoded hex colour, or a French enum label inline                 | `globals.css` tokens + slice label map                       | 06  |
| 33  | Deleting a referenced service, tag or staff member                    | Deactivate (`isActive: false`)                               | 01  |
| 34  | Building UI without opening `prompt_material/`                        | Read the reference first                                     | §0  |
| 35  | Claiming a verification you could not perform                         | "requires manual verification: …"                            | §0  |
| 36  | Anything from §7's out-of-scope list                                  | It does not exist                                            | §7  |

---

## 9. Reference docs — read the one your task needs

| File                                | Read it when you are touching                             |
| ----------------------------------- | --------------------------------------------------------- |
| `docs/architecture/01-database.md`  | `schema.ts`, migrations, exclusion constraints, seed      |
| `docs/architecture/02-auth.md`      | Better Auth, procedure tiers, `proxy.ts`, staff lifecycle |
| `docs/architecture/03-trpc.md`      | any of the five `src/trpc/` files, a new router           |
| `docs/architecture/04-hydration.md` | any `page.tsx` or any `ui/views/*`                        |
| `docs/architecture/05-slice.md`     | schemas, types, constants, params, filters, procedures    |
| `docs/architecture/06-ui.md`        | design tokens, formats, badges, forms, tables, mutations  |
| `docs/architecture/07-calendar.md`  | anything under `components/calendar/` or the agenda       |
| `docs/architecture/08-clinical.md`  | FDI teeth, odontogram, finances, appointment rules        |

`docs/architecture/00-checklist.md` is the ordered checklist for adding a new module. Follow it step by step; each step typechecks before the next.

---

## 10. Git

- One branch = one prompt file in `prompts/` = one reviewable unit. Branches are numbered: `feat/10-patients`.
- Branch off `main`, never off another feature branch.
- Commits go bottom-up, each one typechecking: schema → contracts → procedures → URL state → views → forms → routes. Never one monolithic commit.
- **You never run `git commit`, `push`, `merge` or `rebase`.** Leave the tree dirty; the human commits.
- Every reply ending a unit of work states: files changed, commands run with real output, and the explicit **"requires manual verification"** list.
