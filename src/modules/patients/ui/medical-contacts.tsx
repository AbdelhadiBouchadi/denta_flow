import { formatPhone } from "@/lib/format";
import type { PatientMedicalHistory } from "../types";
import DetailItem from "./detail-item";

interface MedicalContactsProps {
  history: PatientMedicalHistory;
}

/**
 * «Médecin traitant» and «Contact d’urgence». They are stored with the
 * dossier médical but read on both tabs: the secretary looks for the emergency
 * number under Informations, the dentist next to the history. One component,
 * so the two places cannot show the same contact two different ways.
 */
const MedicalContacts = ({ history }: MedicalContactsProps) => (
  <>
    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-h4 text-foreground">Médecin traitant</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Nom" value={history?.primaryDoctorName ?? null} />
        <DetailItem
          label="Téléphone"
          value={
            history?.primaryDoctorPhone
              ? formatPhone(history.primaryDoctorPhone)
              : null
          }
        />
      </div>
    </section>

    <section className="flex flex-col gap-4">
      <h2 className="font-heading text-h4 text-foreground">
        Contact d’urgence
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Nom" value={history?.emergencyContactName ?? null} />
        <DetailItem
          label="Lien"
          value={history?.emergencyContactRelation ?? null}
        />
        <DetailItem
          label="Téléphone"
          value={
            history?.emergencyContactPhone
              ? formatPhone(history.emergencyContactPhone)
              : null
          }
        />
      </div>
    </section>
  </>
);

export default MedicalContacts;
