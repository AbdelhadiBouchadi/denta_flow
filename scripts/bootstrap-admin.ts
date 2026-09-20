// scripts/bootstrap-admin.ts   —   npm run bootstrap:admin
//
// Creates or promotes BOOTSTRAP_ADMIN_EMAIL to role "admin". Signup is closed to the
// public (disableSignUp: true), so this script calls auth.api.signUpEmail directly —
// that bypasses the HTTP route, not the auth system itself. This is the only
// sanctioned way to create the first admin — never edit the database by hand.
//
// Idempotent: re-running on an account that already exists and is already an admin
// is a no-op. Exits non-zero if a required environment variable is missing.
import "dotenv/config";

import { eq } from "drizzle-orm";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { auth } from "../src/lib/auth";
import { db } from "../src/database/index";
import * as schema from "../src/database/schema";
import { user } from "../src/database/schema";

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

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();
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
