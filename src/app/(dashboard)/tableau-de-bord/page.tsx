import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Tableau de bord",
};

/**
 * Placeholder for branch 09: the shell is the deliverable, the dashboard's
 * cards are not. No query is prefetched because no dashboard procedure exists
 * yet — an empty <HydrationBoundary> would only be scaffolding.
 */
const TableauDeBordPage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  return (
    <h1 className="font-heading text-h1 text-foreground">Tableau de bord</h1>
  );
};

export default TableauDeBordPage;
