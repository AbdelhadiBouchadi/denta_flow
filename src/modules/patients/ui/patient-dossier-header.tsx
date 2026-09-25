"use client";

import {
  BanknoteIcon,
  CakeIcon,
  CalendarCheckIcon,
  CheckIcon,
  CopyIcon,
  HistoryIcon,
  IdCardIcon,
  MailIcon,
  PhoneIcon,
  ShieldIcon,
  TriangleAlertIcon,
  VenusAndMarsIcon,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import GeneratedAvatar from "@/components/shared/generated-avatar";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime, formatPhone } from "@/lib/format";
import { cn } from "@/lib/utils";
import { GENDER_LABELS, NO_INSURER_LABEL } from "../constants";
import {
  formatPatientName,
  getPatientAge,
  getPaymentStatus,
} from "../derived";
import { PaymentStatus, type Gender, type PatientGetOne } from "../types";
import MedicalAlertPills from "./medical-alert-pills";
import PatientActions from "./patient-actions";
import { PatientTags } from "./patient-tags";
import { PaymentAmount } from "./payment-amount";

interface PatientDossierHeaderProps {
  patient: PatientGetOne;
}

/** The dash an unknown field shows, in muted grey so it reads as «not filled». */
const UNKNOWN = "Aucun";

/**
 * One fact, one bordered chip — the identity strip of the reference dossier.
 * A missing value still renders its chip, muted, so the row does not reflow
 * from patient to patient.
 */
const InfoChip = ({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string | null;
  /** Read by screen readers, since the icon alone carries the meaning. */
  label: string;
}) => (
  <span
    title={value ?? `${label} : ${UNKNOWN}`}
    className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs"
  >
    <Icon aria-hidden="true" className="text-muted-foreground size-3.5 shrink-0" />
    <span className="sr-only">{label} :</span>
    <span className={cn("truncate", !value && "text-muted-foreground")}>
      {value ?? UNKNOWN}
    </span>
  </span>
);

/**
 * A filled tile, not a bordered chip: the three figures are the first thing
 * read on the dossier, and a tinted block carries further than an outline.
 * The tone is the fact — «Reste à payer» is red only when money is owed.
 */
type StatTone = "danger" | "success" | "info" | "neutral";

const STAT_TILE_SURFACE: Record<StatTone, string> = {
  danger: "bg-danger-subtle",
  success: "bg-success-subtle",
  info: "bg-info-subtle",
  neutral: "bg-muted",
};

const STAT_TILE_ACCENT: Record<StatTone, string> = {
  danger: "text-danger-strong",
  success: "text-success-strong",
  info: "text-info-strong",
  neutral: "text-foreground",
};

/** «Reste à payer» takes its tone from the payment standing (06-ui.md §4). */
const PAYMENT_TILE_TONES: Record<PaymentStatus, StatTone> = {
  [PaymentStatus.Unpaid]: "danger",
  [PaymentStatus.Partial]: "danger",
  [PaymentStatus.Paid]: "success",
  [PaymentStatus.Advance]: "info",
  [PaymentStatus.NoCharges]: "neutral",
};

const StatTile = ({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone: StatTone;
}) => (
  <div
    className={cn(
      // Full width stacked on a phone: three content-width tiles left a
      // ragged right edge down the card.
      "flex w-full items-center gap-3 rounded-xl px-4 py-3 sm:w-auto",
      STAT_TILE_SURFACE[tone],
    )}
  >
    <Icon
      aria-hidden="true"
      className={cn("size-5 shrink-0", STAT_TILE_ACCENT[tone])}
    />
    <div className="flex flex-col leading-tight">
      <span className="text-muted-foreground text-xs">{label}</span>
      {/* A clinic-local time can differ by an hour between Node's tz database
          and an older one bundled in the browser; see columns.tsx. */}
      <span
        suppressHydrationWarning
        className={cn(
          "text-base font-semibold tabular-nums",
          STAT_TILE_ACCENT[tone],
        )}
      >
        {value}
      </span>
    </div>
  </div>
);

/**
 * Staff read the short code aloud and write it on the physical file, so it is
 * worth one click rather than a careful re-type.
 */
const CopyShortCode = ({ shortCode }: { shortCode: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shortCode);
      setIsCopied(true);
      toast.success("Identifiant copié");
      window.setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Clipboard access is refused outside a secure context, so the failure
      // has to be said out loud rather than swallowed.
      toast.error("Impossible de copier l’identifiant");
    }
  };

  return (
    <span className="bg-muted flex items-center gap-1 rounded-md py-0.5 pr-0.5 pl-2">
      <span className="text-muted-foreground font-mono text-xs tracking-wider">
        #{shortCode}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label="Copier l’identifiant du patient"
        onClick={copy}
      >
        {isCopied ? (
          <CheckIcon className="text-success" />
        ) : (
          <CopyIcon className="text-muted-foreground" />
        )}
      </Button>
    </span>
  );
};

const PatientDossierHeader = ({ patient }: PatientDossierHeaderProps) => {
  const fullName = formatPatientName(patient);
  const age = getPatientAge(patient.birthDate);
  const paymentStatus = getPaymentStatus(patient);

  const birthDate = patient.birthDate
    ? `${formatDate(patient.birthDate)}${age === null ? "" : ` (${age} ans)`}`
    : null;

  return (
    <Card className="p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2">
            <GeneratedAvatar
              seed={patient.id}
              name={fullName}
              birthDate={patient.birthDate}
              gender={patient.gender}
              className="size-28"
            />
            <CopyShortCode shortCode={patient.shortCode} />
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-heading text-h2 text-foreground font-semibold">
                {fullName}
              </h1>
              <PatientTags tags={patient.tags} max={patient.tags.length || 1} />

              {/* The allergy stays on the name row, spelled out rather than
                  hidden behind an icon: it is the one fact that must be read
                  before anyone touches the patient
                  (prompt_material/10-patient-dossier.md). */}
              {patient.allergies && (
                <span
                  role="alert"
                  title={`Alerte médicale · ${patient.allergies}`}
                  className="border-danger/30 bg-danger-subtle text-danger-strong text-label inline-flex max-w-xs min-w-0 items-center gap-1.5 rounded-md border px-2 py-1"
                >
                  <TriangleAlertIcon
                    aria-hidden="true"
                    className="size-3.5 shrink-0"
                  />
                  <span className="truncate">
                    Alerte médicale · {patient.allergies}
                  </span>
                </span>
              )}

              {/* The critical flags of the dossier médical, the same red as the
                  allergy and right beside it: each changes what may safely be
                  done before any acte (prompt 10b). */}
              <MedicalAlertPills history={patient.medicalHistory} />

              {patient.isArchived && (
                <StatusBadge tone="neutral" label="Archivé" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <InfoChip icon={IdCardIcon} label="CIN" value={patient.cin} />
              <InfoChip
                icon={PhoneIcon}
                label="Téléphone"
                value={formatPhone(patient.phone)}
              />
              <InfoChip
                icon={VenusAndMarsIcon}
                label="Sexe"
                value={
                  patient.gender
                    ? GENDER_LABELS[patient.gender as Gender]
                    : null
                }
              />
              <InfoChip
                icon={ShieldIcon}
                label="Couverture"
                value={patient.insurer?.name ?? NO_INSURER_LABEL}
              />
              <InfoChip
                icon={CakeIcon}
                label="Date de naissance"
                value={birthDate}
              />
              <InfoChip
                icon={MailIcon}
                label="Adresse e-mail"
                value={patient.email}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <StatTile
                icon={BanknoteIcon}
                label="Reste à payer"
                tone={PAYMENT_TILE_TONES[paymentStatus]}
                value={
                  <PaymentAmount
                    cents={patient.remainingCents}
                    status={paymentStatus}
                    className="text-base font-semibold"
                  />
                }
              />

              <StatTile
                icon={CalendarCheckIcon}
                label="Dernière visite"
                tone="neutral"
                value={
                  patient.lastVisitAt ? (
                    formatDateTime(patient.lastVisitAt)
                  ) : (
                    <span className="text-muted-foreground font-normal">
                      {UNKNOWN}
                    </span>
                  )
                }
              />

              <StatTile
                icon={HistoryIcon}
                label="Nombre de visites"
                tone="info"
                value={patient.visitCount}
              />
            </div>
          </div>
        </div>

        <PatientActions patient={patient} />
      </div>
    </Card>
  );
};

export default PatientDossierHeader;
