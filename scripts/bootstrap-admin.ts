// scripts/bootstrap-admin.ts   —   npm run bootstrap:admin
//
// Promotes BOOTSTRAP_ADMIN_EMAIL to role "admin" with a direct Drizzle update.
// `role` is an input: false additionalField, so the first signup is always an
// "assistant". This script is the only sanctioned way to create the first admin —
// never edit the database by hand.
//
// Idempotent: re-running on an account that is already an admin is a no-op.
// Exits non-zero if the environment variable is missing or the user does not exist.
import "dotenv/config";

import { eq } from "drizzle-orm";

import { db } from "../src/database/index";
import { user } from "../src/database/schema";

async function main() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim();

  if (!email) {
    console.error(
      "BOOTSTRAP_ADMIN_EMAIL n'est pas définie. Renseignez-la dans .env puis relancez.",
    );
    process.exit(1);
  }

  const [existing] = await db
    .select({ id: user.id, name: user.name, role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.email, email));

  if (!existing) {
    console.error(
      `Aucun compte ne correspond à « ${email} ». Créez d'abord le compte via /connexion, puis relancez ce script.`,
    );
    process.exit(1);
  }

  if (existing.role === "admin") {
    console.log(`« ${existing.name} » (${email}) est déjà administrateur. Aucune modification.`);
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
