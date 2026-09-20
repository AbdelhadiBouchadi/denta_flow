// scripts/bootstrap-admin.ts   —   npm run bootstrap:admin
//
// Creates or promotes BOOTSTRAP_ADMIN_EMAIL to role "admin". Signup is closed to the
// public (disableSignUp: true), so this script calls auth.api.signUpEmail directly —
// that bypasses the HTTP route, not the auth system itself. This is the only
// sanctioned way to create the first admin — never edit the database by hand.
//
// A `user` row is NOT proof that the account can sign in. `seed.ts` upserts the
// staff rows — including this one, on the same email — and never writes to
// `account`, so on a seeded database the user exists with no credential and no
// password. The credential is therefore checked and repaired separately from the
// user row; see ensureCredentialAccount below.
//
// Idempotent: re-running on an account that already exists, already holds a
// password and is already an admin is a no-op. Exits non-zero if a required
// environment variable is missing.
import "dotenv/config";

import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "../src/database/index";
import * as schema from "../src/database/schema";
import { user } from "../src/database/schema";

// A local instance rather than the one from src/lib/auth.ts, for two reasons:
// it opens signup, which the app's instance closes; and the app's instance
// starts with `import "server-only"`, whose package resolves to a module that
// throws under plain Node — the `react-server` export condition that turns it
// into a no-op only exists inside the Next bundler. Importing it here would
// crash tsx before main() ever runs.
//
// Keep the options below mirroring src/lib/auth.ts. The two that matter for
// this script are `database` (same rows) and the password hasher: both
// instances leave `emailAndPassword.password.hash` unset and therefore share
// Better Auth's stateless scrypt, so a hash written here verifies at sign-in.
// Setting a custom hasher in src/lib/auth.ts without mirroring it here would
// silently produce an unusable password.
const bootstrapAuth = betterAuth({
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
  },
  database: drizzleAdapter(db, { provider: "pg", schema: { ...schema } }),
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "assistant",
        input: false,
      },
      isActive: {
        type: "boolean",
        required: true,
        defaultValue: true,
        input: false,
      },
    },
  },
});

/**
 * Guarantees the user can actually sign in with BOOTSTRAP_ADMIN_PASSWORD.
 *
 * Sign-in matches on providerId "credential" AND accountId === user.id, so the
 * row is created with exactly that shape. Deliberately NOT signUpEmail: that
 * creates a new user and would collide on the unique email of the row we just
 * found.
 *
 * No-ops when a credential with a password is already present.
 */
async function ensureCredentialAccount(userId: string, password?: string) {
  const ctx = await bootstrapAuth.$context;
  const credential = await ctx.internalAdapter.findCredentialAccount(userId);

  if (credential?.password) return false;

  if (!password) {
    console.error(
      `Le compte « ${userId} » existe mais n'a aucun mot de passe, et ` +
        `BOOTSTRAP_ADMIN_PASSWORD n'est pas définie pour en créer un. ` +
        `Renseignez-la dans .env puis relancez.`,
    );
    process.exit(1);
  }

  // env.ts only requires 6 characters; Better Auth's own minimum is 8. Checking
  // here turns a hash that can never be used into an actionable error.
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength) {
    console.error(
      `BOOTSTRAP_ADMIN_PASSWORD doit contenir au moins ${minPasswordLength} caractères.`,
    );
    process.exit(1);
  }
  if (password.length > maxPasswordLength) {
    console.error(
      `BOOTSTRAP_ADMIN_PASSWORD ne doit pas dépasser ${maxPasswordLength} caractères.`,
    );
    process.exit(1);
  }

  const hashedPassword = await ctx.password.hash(password);

  if (credential) {
    // A credential row exists but carries no password.
    await ctx.internalAdapter.updatePassword(userId, hashedPassword);
  } else {
    await ctx.internalAdapter.createAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: hashedPassword,
    });
  }

  return true;
}

async function main() {
  // Lowercased to match seed.ts and Better Auth's sign-in lookup, both of which
  // normalise the address. Without this, a capitalised .env value misses the
  // seeded row and the script would create a duplicate user.
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email) {
    console.error(
      "BOOTSTRAP_ADMIN_EMAIL n'est pas définie. Renseignez-la dans .env puis relancez.",
    );
    process.exit(1);
  }

  let [existing] = await db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
    })
    .from(user)
    .where(eq(user.email, email));

  if (!existing) {
    if (!password) {
      console.error(
        `Aucun compte ne correspond à « ${email} », et BOOTSTRAP_ADMIN_PASSWORD n'est pas ` +
          `définie pour en créer un. Renseignez-la dans .env puis relancez.`,
      );
      process.exit(1);
    }

    await bootstrapAuth.api.signUpEmail({
      body: { email, password, name: "Administrateur" },
    });

    [existing] = await db
      .select({
        id: user.id,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      })
      .from(user)
      .where(eq(user.email, email));

    if (!existing) {
      console.error(
        `La création du compte « ${email} » a échoué de façon inattendue.`,
      );
      process.exit(1);
    }

    console.log(`Compte créé pour « ${email} ».`);
  }

  // Runs on both paths: a freshly created account already has its credential and
  // this no-ops, while a seeded user row gets the password it never had.
  if (await ensureCredentialAccount(existing.id, password)) {
    console.log(
      `Mot de passe défini pour « ${email} » (le compte n'en avait aucun).`,
    );
  }

  if (existing.role === "admin") {
    console.log(
      `« ${existing.name} » (${email}) est déjà administrateur. Aucune modification.`,
    );
  } else {
    await db
      .update(user)
      .set({ role: "admin", updatedAt: new Date() })
      .where(eq(user.id, existing.id));

    console.log(
      `« ${existing.name} » (${email}) est passé de « ${existing.role} » à « admin ».`,
    );
  }

  if (!existing.isActive) {
    console.warn(
      `Attention : ce compte est désactivé (isActive: false). Réactivez-le pour qu'il puisse se connecter.`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
