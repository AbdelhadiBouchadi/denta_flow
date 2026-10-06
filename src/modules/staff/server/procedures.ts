import "server-only";

import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne, or, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

import { db } from "@/database";
import { account, session, user } from "@/database/schema";
import { auth } from "@/lib/auth";
import {
  adminProcedure,
  createTRPCRouter,
  protectedProcedure,
} from "@/trpc/init";
import { STAFF_SERVER_ERRORS } from "../constants";
import { lastAdminError, roleChangeKind, selfChangeError } from "../guards";
import {
  staffIdSchema,
  staffInsertSchema,
  staffUpdateProfileSchema,
  staffUpdateRoleSchema,
} from "../schemas";
import { StaffChange, StaffRole } from "../types";
import { generateTemporaryPassword } from "./temporary-password";

/**
 * Staff are rows of Better Auth's `user` table. Signup is closed
 * (`disableSignUp: true`), and that also refuses the server-side
 * `auth.api.signUpEmail` — verified against better-auth 1.7.5, it throws
 * EMAIL_PASSWORD_SIGN_UP_DISABLED. Accounts are therefore created from
 * Better Auth's server context: its password hasher, and its internal adapter
 * for credentials and sessions. `scripts/bootstrap-admin.ts` makes the same
 * calls. No admin plugin, no schema change, no extra public route.
 *
 * Temporary passwords are returned to the admin once and never logged, and
 * never attached as an error `cause` either.
 */

const staffColumns = {
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  isActive: user.isActive,
  title: user.title,
  inpe: user.inpe,
  color: user.color,
};

const UNIQUE_VIOLATION = "23505";

/** drizzle wraps driver errors, so the Postgres code sits on `cause`. */
const postgresCode = (error: unknown): string | null => {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 5; depth++) {
    const code = (current as Error & { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = current.cause;
  }
  return null;
};

const notFound = () =>
  new TRPCError({ code: "NOT_FOUND", message: STAFF_SERVER_ERRORS.notFound });

/**
 * The number of active admins, with every one of those rows locked FOR UPDATE.
 *
 * The lock is what makes the last-admin guard atomic. Two admins demoting each
 * other at the same moment would otherwise both count 2 from their own
 * snapshot and both succeed. Here the second statement waits on the first
 * one's lock, then re-reads the row it was waiting for. The demoted admin no
 * longer matches, so it counts 1 and refuses. `ORDER BY id` takes the locks in
 * the same order every time, so two guards cannot deadlock. Neon's HTTP driver
 * cannot hold a transaction, so the guard has to fit in this one statement.
 */
const lockedActiveAdminCount = sql`(SELECT count(*) FROM (${db
  .select({ id: user.id })
  .from(user)
  .where(and(eq(user.role, StaffRole.Admin), eq(user.isActive, true)))
  .orderBy(asc(user.id))
  .for("update")}) AS active_admins)`;

/**
 * True unless the row is the last active admin. A target that is not an active
 * admin short-circuits before the count is taken.
 */
const keepsAnActiveAdmin = or(
  ne(user.role, StaffRole.Admin),
  eq(user.isActive, false),
  sql`${lockedActiveAdminCount} > 1`,
);

/**
 * A guarded write matched no row: either the id is unknown, or the row is the
 * last active admin. Telling the two apart afterwards is safe — it only picks
 * the message, never the outcome.
 */
const guardedWriteRefusal = async (id: string, change: StaffChange) => {
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, id));

  return existing
    ? new TRPCError({ code: "CONFLICT", message: lastAdminError(change) })
    : notFound();
};

const assertNotSelf = (
  actorId: string,
  targetId: string,
  change: StaffChange | null,
) => {
  const message = selfChangeError(actorId, targetId, change);
  if (message) throw new TRPCError({ code: "BAD_REQUEST", message });
};

export const staffRouter = createTRPCRouter({
  /**
   * Every staff member reads the list: the agenda's practitioner filter and
   * every «créé par» need it. A clinic has a handful of staff, so there is no
   * pagination and no filter. Active first, then by name.
   */
  getMany: protectedProcedure.query(async () => {
    const items = await db
      .select(staffColumns)
      .from(user)
      .orderBy(desc(user.isActive), asc(user.name), asc(user.id));

    return { items, total: items.length, totalPages: 1 };
  }),

  create: adminProcedure
    .input(staffInsertSchema)
    .mutation(async ({ input }) => {
      const authContext = await auth.$context;

      const [taken] = await db
        .select({ id: user.id })
        .from(user)
        .where(eq(user.email, input.email));

      if (taken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: STAFF_SERVER_ERRORS.duplicateEmail,
        });
      }

      const id = nanoid();
      const temporaryPassword = generateTemporaryPassword();

      // Both rows written with Drizzle, in one Neon HTTP batch, which runs as
      // one transaction: the user never exists without a password. The
      // internal adapter's `createUser` is not used here, because it silently
      // drops every column Better Auth was not told about (`title`, `inpe`,
      // `color`). Only the hash comes from Better Auth, from its own scrypt,
      // so the password verifies at sign-in. The credential has the shape
      // sign-in looks up: providerId "credential", accountId = userId. The
      // role is in the same INSERT, so it cannot be lost to a second write.
      try {
        await db.batch([
          db.insert(user).values({
            id,
            name: input.name,
            email: input.email,
            emailVerified: false,
            role: input.role,
            isActive: true,
            title: input.title,
            inpe: input.inpe,
            color: input.color,
          }),
          db.insert(account).values({
            id: nanoid(),
            userId: id,
            providerId: "credential",
            accountId: id,
            password: await authContext.password.hash(temporaryPassword),
          }),
        ]);
      } catch (error) {
        // Lost the race with another create on the same address.
        if (postgresCode(error) === UNIQUE_VIOLATION) {
          throw new TRPCError({
            code: "CONFLICT",
            message: STAFF_SERVER_ERRORS.duplicateEmail,
          });
        }
        // No `cause`: a failed query's text carries its parameters, the
        // password hash among them.
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: STAFF_SERVER_ERRORS.createFailed,
        });
      }

      return {
        user: { id, name: input.name, email: input.email },
        temporaryPassword,
      };
    }),

  updateProfile: adminProcedure
    .input(staffUpdateProfileSchema)
    .mutation(async ({ input }) => {
      // `id` is destructured out: it must never reach .set().
      const { id, ...values } = input;

      const [updated] = await db
        .update(user)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(user.id, id))
        .returning(staffColumns);

      if (!updated) throw notFound();
      return updated;
    }),

  updateRole: adminProcedure
    .input(staffUpdateRoleSchema)
    .mutation(async ({ input, ctx }) => {
      const change = roleChangeKind(input.role);
      assertNotSelf(ctx.auth.user.id, input.id, change);

      const [updated] = await db
        .update(user)
        .set({ role: input.role, updatedAt: new Date() })
        .where(
          and(eq(user.id, input.id), change ? keepsAnActiveAdmin : undefined),
        )
        .returning(staffColumns);

      if (!updated) {
        throw change ? await guardedWriteRefusal(input.id, change) : notFound();
      }
      return updated;
    }),

  /**
   * `isActive: false`, never a row delete: the audit columns across the schema
   * keep resolving to this name. The person's sessions are then revoked, so the
   * next request is rejected even before `protectedProcedure` re-reads
   * `isActive`.
   */
  deactivate: adminProcedure
    .input(staffIdSchema)
    .mutation(async ({ input, ctx }) => {
      assertNotSelf(ctx.auth.user.id, input.id, StaffChange.Deactivate);

      const [updated] = await db
        .update(user)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(user.id, input.id), keepsAnActiveAdmin))
        .returning(staffColumns);

      if (!updated) {
        throw await guardedWriteRefusal(input.id, StaffChange.Deactivate);
      }

      const authContext = await auth.$context;
      await authContext.internalAdapter.deleteUserSessions(input.id);

      return updated;
    }),

  reactivate: adminProcedure
    .input(staffIdSchema)
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(user)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(user.id, input.id))
        .returning(staffColumns);

      if (!updated) throw notFound();
      return updated;
    }),

  /**
   * A new temporary password, returned once. Every session the account holds
   * is closed, except the caller's own when an admin resets their own password.
   * A user with no credential at all, such as a seeded row (`seed.ts` never
   * writes `account`), gets one.
   */
  resetPassword: adminProcedure
    .input(staffIdSchema)
    .mutation(async ({ input, ctx }) => {
      const [target] = await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, input.id));

      if (!target) throw notFound();

      await db
        .delete(session)
        .where(
          and(
            eq(session.userId, target.id),
            ne(session.token, ctx.auth.session.token),
          ),
        );

      const authContext = await auth.$context;
      const temporaryPassword = generateTemporaryPassword();
      const hashed = await authContext.password.hash(temporaryPassword);

      const credential =
        await authContext.internalAdapter.findCredentialAccount(target.id);

      if (credential) {
        await authContext.internalAdapter.updatePassword(target.id, hashed);
      } else {
        await authContext.internalAdapter.createAccount({
          userId: target.id,
          providerId: "credential",
          accountId: target.id,
          password: hashed,
        });
      }

      return { user: target, temporaryPassword };
    }),
});
