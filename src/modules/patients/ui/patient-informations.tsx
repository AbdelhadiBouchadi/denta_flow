import { formatDate, formatPhone } from "@/lib/format";
import type { PatientGetOne } from "../types";
import DetailItem from "./detail-item";
import MedicalContacts from "./medical-contacts";

interface PatientInformationsProps {
  patient: PatientGetOne;
}

/**
 * The «Informations» tab carries only what the header does not.
 *
 * The header already shows the CIN, the phone, the sex, the cover, the birth
 * date and the e-mail, and the allergy is its red pill — repeating any of them
 * here would just be a second place to read a stale value from. The médecin
 * traitant and the contact d’urgence are the exception, on purpose: they are
 * who the front desk calls, so they sit with the coordonnées as well as in the
 * dossier médical, through one shared component.
 */
const PatientInformations = ({ patient }: PatientInformationsProps) => (
  <div className="flex flex-col gap-6">
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-h4 text-foreground">Coordonnées</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Adresse" value={patient.address} />
        <DetailItem label="Ville" value={patient.city} />
        <DetailItem
          label="Téléphone secondaire"
          value={
            patient.secondaryPhone ? formatPhone(patient.secondaryPhone) : null
          }
        />
        <DetailItem label="Numéro d’assuré" value={patient.insuranceNumber} />
        <DetailItem label="Profession" value={patient.profession} />
      </div>
    </section>

    <MedicalContacts history={patient.medicalHistory} />

    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-h4 text-foreground">Notes médicales</h2>
      {patient.medicalNotes ? (
        <p className="text-sm whitespace-pre-wrap">{patient.medicalNotes}</p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Aucune note médicale pour le moment.
        </p>
      )}
    </section>

    <section className="border-t pt-4">
      <p className="text-muted-foreground text-xs">
        Dossier créé le {formatDate(patient.createdAt)}
        {patient.createdByStaff?.name
          ? ` par ${patient.createdByStaff.name}`
          : ""}
        .
      </p>
    </section>
  </div>
);

export default PatientInformations;
