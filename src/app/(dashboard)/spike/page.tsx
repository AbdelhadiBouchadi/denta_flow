import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";

import { SpikeCalendar } from "./spike-calendar";

// THROWAWAY — branch 17 spike. Delete this folder before the last commit.

export const metadata: Metadata = {
  title: "Spike agenda",
};

// Session gate like every dashboard page; it also makes the route dynamic,
// so the layout's `clinic.get` prefetch never runs at build time.
const SpikePage = async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  return <SpikeCalendar />;
};

export default SpikePage;
