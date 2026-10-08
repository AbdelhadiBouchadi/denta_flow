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
 * one prefetch block cover all of them (04-hydration.md §2).
 */
const PatientIdPage = async ({ params }: Props) => {
  const { patientId } = await params;

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/connexion");

  const queryClient = getQueryClient();
  void queryClient.prefetchQuery(
    trpc.patients.getOne.queryOptions({ id: patientId }),
  );
  // The «Rendez-vous» tab: prefetched whatever tab is open, so switching to
  // it never shows a spinner.
  void queryClient.prefetchQuery(
    trpc.appointments.getManyByPatient.queryOptions({ patientId }),
  );
  // The «Actes» tab, for the same reason.
  void queryClient.prefetchQuery(
    trpc.treatments.getManyByPatient.queryOptions({ patientId }),
  );
  // The «Paiements» tab, for the same reason.
  void queryClient.prefetchQuery(
    trpc.payments.getManyByPatient.queryOptions({ patientId }),
  );
  // The «Documents» tab, for the same reason. Its generators read the
  // «Actes» query above.
  void queryClient.prefetchQuery(
    trpc.documents.getManyByPatient.queryOptions({ patientId }),
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
