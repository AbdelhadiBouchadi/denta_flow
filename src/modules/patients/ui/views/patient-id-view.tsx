"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import EmptyState from "@/components/shared/empty-state";
import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/trpc/client";
import { PATIENT_TABS } from "../../constants";
import { formatPatientName } from "../../derived";
import { usePatientTab } from "../../hooks/use-patient-tab";
import { PatientTab } from "../../types";
import PatientBreadcrumb from "../patient-breadcrumb";
import PatientDossierHeader from "../patient-dossier-header";
import PatientInformations from "../patient-informations";
import PatientMedicalHistory from "../patient-medical-history";

interface PatientIdViewProps {
  /** An identifier, not data — the only prop a view takes from a page. */
  patientId: string;
}

/** Copy for the four tabs whose slices do not exist yet. */
const PENDING_TABS: Record<
  Exclude<PatientTab, PatientTab.Informations | PatientTab.MedicalHistory>,
  { title: string; description: string }
> = {
  [PatientTab.Appointments]: {
    title: "Aucun rendez-vous",
    description:
      "Les rendez-vous de ce patient s’afficheront ici dès que l’agenda sera disponible.",
  },
  [PatientTab.Treatments]: {
    title: "Aucun acte",
    description:
      "Les actes réalisés et leur montant s’afficheront ici dès que le catalogue d’actes sera disponible.",
  },
  [PatientTab.Payments]: {
    title: "Aucun paiement",
    description:
      "Les règlements du patient s’afficheront ici dès que les paiements seront disponibles.",
  },
  [PatientTab.Documents]: {
    title: "Aucun document",
    description:
      "Les factures et documents générés s’afficheront ici dès qu’ils seront disponibles.",
  },
};

const PatientIdView = ({ patientId }: PatientIdViewProps) => {
  const trpc = useTRPC();
  const [tab, setTab] = usePatientTab();

  const { data: patient } = useSuspenseQuery(
    trpc.patients.getOne.queryOptions({ id: patientId }),
  );

  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 md:px-8">
      <PatientBreadcrumb patientName={formatPatientName(patient)} />

      <PatientDossierHeader patient={patient} />

      {/* Tabs are nuqs state on this one route, not nested routes — nine tabs
          would otherwise mean nine session reads for one record. The list and
          the panels share one Card so the active tab reads as the top edge of
          the content it opens, not as a separate grey band above it. */}
      <Card className="gap-0 py-0">
        <Tabs
          value={tab}
          onValueChange={(value) => void setTab(value as PatientTab)}
        >
          {/* The wrapper owns the sideways scroll; the rule the tabs sit on
              is the list's own border-b, not the wrapper's. A negative margin
              on a child of a scroll container makes the container shorter than
              its content, so a wrapper-owned rule left the strip permanently
              1px scrollable on the vertical axis. With the border on the list,
              the -mb-px overlap resolves inside the list's own box and the
              scroller has nothing to scroll. `min-w-full` keeps the rule
              spanning the card even when the tabs are narrower than it.

              Base UI marks the selected tab with `data-active` — `data-selected`
              was renamed in v1.0.0-beta-5 — so the active state is styled on
              that attribute, not on Radix's `data-[state=active]`, which never
              matches here. The line variant's own `after:` underline is
              switched off so there is exactly one active indicator. */}
          <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList
              variant="line"
              className="group-data-horizontal/tabs:h-auto w-max min-w-full justify-start rounded-none border-b bg-transparent p-0 px-4 md:px-6"
            >
              {PATIENT_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="text-muted-foreground hover:text-foreground data-active:text-primary data-active:border-b-primary -mb-px h-12 flex-none gap-2 rounded-none border-x-transparent border-t-transparent border-b-2 border-b-transparent px-4 text-base font-medium after:hidden [&_svg:not([class*='size-'])]:size-5"
                >
                  <Icon />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <div className="p-4 md:p-6">
            <TabsContent value={PatientTab.Informations}>
              <PatientInformations patient={patient} />
            </TabsContent>

            {/* Read from the same getOne as the header, so saving the
                history refreshes its pills with no second query. */}
            <TabsContent value={PatientTab.MedicalHistory}>
              <PatientMedicalHistory patient={patient} />
            </TabsContent>

            {Object.entries(PENDING_TABS).map(
              ([value, { title, description }]) => (
                <TabsContent key={value} value={value} className="py-6">
                  <EmptyState title={title} description={description} />
                </TabsContent>
              ),
            )}
          </div>
        </Tabs>
      </Card>
    </div>
  );
};

export const PatientIdViewLoading = () => (
  <LoadingState
    title="Chargement du dossier"
    description="Merci de patienter quelques instants…"
  />
);

export const PatientIdViewError = () => (
  <ErrorState
    title="Dossier indisponible"
    description="Ce dossier patient n’a pas pu être chargé. Il a peut-être été supprimé."
  />
);

export default PatientIdView;
