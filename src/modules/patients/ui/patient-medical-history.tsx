"use client";

import { ClipboardPenIcon, PencilIcon } from "lucide-react";
import { useState, type ReactNode } from "react";

import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import {
  BLOOD_TYPE_LABELS,
  MEDICAL_ALERT_LABELS,
  MEDICAL_CONDITION_LABELS,
  SMOKING_STATUS_LABELS,
  TRI_STATE_LABELS,
} from "../constants";
import {
  formatPregnancyTerm,
  getCurrentPregnancyWeeks,
  isMedicalCondition,
} from "../derived";
import {
  Gender,
  MedicalAlert,
  type BloodType,
  type PatientGetOne,
  type SmokingStatus,
} from "../types";
import DetailItem from "./detail-item";
import MedicalContacts from "./medical-contacts";
import UpdateMedicalHistoryDialog from "./update-medical-history-dialog";

interface PatientMedicalHistoryProps {
  patient: PatientGetOne;
}

const triState = (value: boolean | null) =>
  value === true
    ? TRI_STATE_LABELS.yes
    : value === false
      ? TRI_STATE_LABELS.no
      : TRI_STATE_LABELS.unknown;

/**
 * A critical flag in the read view. «Oui» is spelled out in danger red — the
 * same fact as the header pill, so it must read as the same alarm.
 */
const FlagItem = ({ label, value }: { label: string; value: boolean }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-label text-muted-foreground uppercase">{label}</span>
    {value ? (
      <span className="text-danger-strong text-sm font-semibold">
        {TRI_STATE_LABELS.yes}
      </span>
    ) : (
      <span className="text-sm">{TRI_STATE_LABELS.no}</span>
    )}
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) => (
  <section className="flex flex-col gap-4">
    <h2 className="font-heading text-h4 text-foreground">{title}</h2>
    {children}
  </section>
);

/**
 * The «Dossier médical» tab: read by default, edited in one dialog. It is the
 * structured anamnèse — the allergy and the free-text notes stay on the
 * patient row, where the header and the Informations tab already read them.
 */
const PatientMedicalHistory = ({ patient }: PatientMedicalHistoryProps) => {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const history = patient.medicalHistory;
  const canBePregnant = (patient.gender as Gender | null) !== Gender.Male;

  const pregnancy = (() => {
    if (!history || history.isPregnant !== true) {
      return triState(history?.isPregnant ?? null);
    }
    const term = formatPregnancyTerm(
      getCurrentPregnancyWeeks(history.pregnancyWeeks, history.updatedAt),
    );
    return term ? `${TRI_STATE_LABELS.yes} · ${term}` : TRI_STATE_LABELS.yes;
  })();

  const conditions = history?.conditions.filter(isMedicalCondition) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <UpdateMedicalHistoryDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        patient={patient}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-muted-foreground text-sm">
          {history ? (
            // A clinic-local time can differ by an hour between Node's tz
            // database and an older one bundled in the browser.
            <span suppressHydrationWarning>
              Mis à jour le {formatDateTime(history.updatedAt)}
              {patient.medicalHistoryEditor?.name
                ? ` par ${patient.medicalHistoryEditor.name}`
                : ""}
              .
            </span>
          ) : (
            "Le dossier médical n’a pas encore été renseigné."
          )}
        </p>
        <Button
          variant="outline"
          size="lg"
          onClick={() => setIsEditOpen(true)}
          className="w-full sm:w-auto"
        >
          <PencilIcon />
          Modifier le dossier médical
        </Button>
      </div>

      {!history ? (
        // Not an EmptyState: an empty history is not «nothing to see», it is
        // a question nobody has asked yet, and no pill in the header does not
        // mean no risk.
        <div
          role="status"
          className="border-warning/40 bg-warning-subtle text-warning-strong flex items-start gap-3 rounded-lg border p-4"
        >
          <ClipboardPenIcon
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
          />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">Dossier médical à compléter</p>
            <p className="text-sm">
              Aucun antécédent n’a été recueilli pour ce patient. Complétez le
              dossier avant le premier acte : l’absence d’alerte dans l’en-tête
              ne signifie pas l’absence de risque.
            </p>
          </div>
        </div>
      ) : (
        <>
          <Section title="Antécédents médicaux">
            {conditions.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {conditions.map((condition) => (
                  <li key={condition}>
                    <StatusBadge
                      tone="neutral"
                      label={MEDICAL_CONDITION_LABELS[condition]}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucun antécédent médical déclaré.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                label="Antécédents chirurgicaux"
                value={history.surgicalHistory}
                multiline
              />
              <DetailItem
                label="Groupe sanguin"
                value={
                  history.bloodType
                    ? BLOOD_TYPE_LABELS[history.bloodType as BloodType]
                    : null
                }
              />
            </div>
          </Section>

          <Section title="Traitements & allergies">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FlagItem
                label={MEDICAL_ALERT_LABELS[MedicalAlert.Anticoagulants]}
                value={history.onAnticoagulants}
              />
              <FlagItem
                label={MEDICAL_ALERT_LABELS[MedicalAlert.Bisphosphonates]}
                value={history.onBisphosphonates}
              />
              <FlagItem
                label={MEDICAL_ALERT_LABELS[MedicalAlert.AntibioticProphylaxis]}
                value={history.needsAntibioticProphylaxis}
              />
              <DetailItem label="Allergies" value={patient.allergies} />
              <DetailItem
                label="Traitements en cours"
                value={history.currentMedications}
                multiline
              />
              <DetailItem
                label="Réactions à l’anesthésie"
                value={history.anesthesiaReactions}
                multiline
              />
            </div>
          </Section>

          {canBePregnant && (
            <Section title="Grossesse">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <DetailItem label="Enceinte" value={pregnancy} />
                <DetailItem
                  label="Allaitement"
                  value={triState(history.isBreastfeeding)}
                />
              </div>
            </Section>
          )}

          <Section title="Habitudes">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <DetailItem
                label="Tabac"
                value={SMOKING_STATUS_LABELS[history.smoking as SmokingStatus]}
              />
              <DetailItem
                label="Bruxisme"
                value={
                  history.bruxism ? TRI_STATE_LABELS.yes : TRI_STATE_LABELS.no
                }
              />
            </div>
          </Section>

          <MedicalContacts history={history} />
        </>
      )}
    </div>
  );
};

export default PatientMedicalHistory;
