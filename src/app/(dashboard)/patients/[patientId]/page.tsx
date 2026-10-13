import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SearchParams } from "nuqs/server";

import { auth } from "@/lib/auth";
import { loadSearchParams as loadImagingSearchParams } from "@/modules/imaging/params";
import { canReadImaging } from "@/modules/imaging/rules";
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
  searchParams: Promise<SearchParams>;
}

/**
 * The dossier's tabs are nuqs state on this one route, so one session read and
 * one prefetch block cover all of them (04-hydration.md §2).
 */
const PatientIdPage = async ({ params, searchParams }: Props) => {
  const { patientId } = await params;
  // The «Imagerie» tab's kind and tooth filters. The dossier composes other
  // slices' tabs, so — like /parametres — it reads that slice's own loader:
  // the gallery's query key is built from the same parsers on both sides.
  // (`imageGroup` is a client-side view of the rows: not part of any key.)
  const { imageKind, imageTooth } = await loadImagingSearchParams(searchParams);

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
  // The header's «Prochains rendez-vous», rendered whatever the tab.
  void queryClient.prefetchQuery(
    trpc.appointments.getUpcomingByPatient.queryOptions({ patientId }),
  );
  // The «Odontogramme» tab, for the same reason — the chart's JSON only;
  // the engine itself loads with the tab.
  void queryClient.prefetchQuery(
    trpc.odontogram.getChart.queryOptions({ patientId }),
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
  // The «Actes» toolbar's «Devis (N)» / «Facture (N)».
  void queryClient.prefetchQuery(
    trpc.documents.countByPatient.queryOptions({ patientId }),
  );
  // The «Imagerie» tab, for the same reason — only for the roles that may
  // read it: a secretary's prefetch would only stream a FORBIDDEN.
  if (canReadImaging(session.user.role)) {
    void queryClient.prefetchQuery(
      trpc.imaging.getManyByPatient.queryOptions({
        patientId,
        kind: imageKind,
        tooth: imageTooth,
      }),
    );
    // Its chips' counts.
    void queryClient.prefetchQuery(
      trpc.imaging.getCountsByPatient.queryOptions({ patientId }),
    );
  }
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
