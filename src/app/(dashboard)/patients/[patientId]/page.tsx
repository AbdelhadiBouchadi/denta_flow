import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { auth } from "@/lib/auth";
import PatientIdView, {
  PatientIdViewError,
  PatientIdViewLoading,
} from "@/modules/patients/ui/views/patient-id-view";
import { getQueryClient, trpc } from "@/trpc/server";

export const metadata: Metadata = {
  title: "Dossier patient",
};

interface Props {
  params: Promise<{ patientId: string }>;
}

/**
 * The dossier's tabs are nuqs state on this one route, so one session read and
 * one prefetch block cover all five (04-hydration.md §2). The tabs whose slices
 * do not exist yet have nothing to prefetch.
 */
const PatientIdPage = async ({ params }: Props) => {
  const { patientId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.patients.getOne.queryOptions({ id: patientId }),
  );
  // Read by the edit dialog's form, which the header can open at any moment.
  void queryClient.prefetchQuery(trpc.tags.getMany.queryOptions());
  void queryClient.prefetchQuery(trpc.insurers.getMany.queryOptions());

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

export default PatientIdPage;
