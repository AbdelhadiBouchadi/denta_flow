import { describe, expect, it } from "vitest";

import { clinicInstant } from "@/lib/time";
import { AppointmentStatus } from "@/modules/appointments/types";
import { DocumentType } from "@/modules/documents/types";
import { TreatmentStatus } from "@/modules/treatments/types";
import {
  APPOINTMENT_SUMMARIES,
  CERTIFICATE_TEMPLATE_SUMMARIES,
  DOCUMENT_SUMMARIES,
  MEDICATION_SUMMARIES,
  PRESCRIPTION_PACK_SUMMARIES,
  ofPatient,
  PAYMENT_SUMMARIES,
  teethSuffix,
  TREATMENT_SUMMARIES,
} from "./summaries";

const BENALI = "BENALI Amine";
const EL_AMRANI = "EL AMRANI Karim";
const HADDAD = "HADDAD Sara";

// 10:30 on the clinic's wall clock — in October (UTC+1) and in Ramadan
// (UTC+0) alike: the sentence prints the clinic's time, never the process's.
const OCT_8_1030 = clinicInstant("2026-10-08", "10:30");
const OCT_9_1415 = clinicInstant("2026-10-09", "14:15");
const RAMADAN_1030 = clinicInstant("2026-03-05", "10:30");

// ── Grammar ─────────────────────────────────────────────────────────────────

describe("ofPatient — «de» and its elision", () => {
  it("keeps «de» before a consonant", () => {
    expect(ofPatient(BENALI)).toBe("de BENALI Amine");
  });

  it("elides before a vowel, accented or not, and before «y»", () => {
    expect(ofPatient(EL_AMRANI)).toBe("d’EL AMRANI Karim");
    expect(ofPatient("ÉLAOUI Nadia")).toBe("d’ÉLAOUI Nadia");
    expect(ofPatient("OUAZZANI Rim")).toBe("d’OUAZZANI Rim");
    expect(ofPatient("YACOUBI Ali")).toBe("d’YACOUBI Ali");
  });

  it("never elides before «h»", () => {
    expect(ofPatient(HADDAD)).toBe("de HADDAD Sara");
  });
});

describe("teethSuffix — singular and plural", () => {
  it("is empty without teeth", () => {
    expect(teethSuffix([])).toBe("");
  });
  it("says «dent» for one", () => {
    expect(teethSuffix(["11"])).toBe(" (dent 11)");
  });
  it("says «dents» for several", () => {
    expect(teethSuffix(["11", "12", "21"])).toBe(" (dents 11, 12, 21)");
  });
});

// ── Appointments ────────────────────────────────────────────────────────────

describe("APPOINTMENT_SUMMARIES", () => {
  it("created names the patient and the clinic-local slot", () => {
    expect(APPOINTMENT_SUMMARIES.created(BENALI, OCT_8_1030)).toBe(
      "Rendez-vous de BENALI Amine pris pour le jeudi 8 octobre à 10 h 30.",
    );
    expect(APPOINTMENT_SUMMARIES.created(BENALI, RAMADAN_1030)).toBe(
      "Rendez-vous de BENALI Amine pris pour le jeudi 5 mars à 10 h 30.",
    );
  });

  it("rescheduled reads «déplacé du … au …», with elision", () => {
    expect(
      APPOINTMENT_SUMMARIES.rescheduled(EL_AMRANI, OCT_8_1030, OCT_9_1415),
    ).toBe(
      "Rendez-vous d’EL AMRANI Karim déplacé du jeudi 8 octobre à 10 h 30 au vendredi 9 octobre à 14 h 15.",
    );
  });

  it("rescheduled on the same slot means another practitioner", () => {
    expect(
      APPOINTMENT_SUMMARIES.rescheduled(BENALI, OCT_8_1030, new Date(OCT_8_1030)),
    ).toBe(
      "Rendez-vous de BENALI Amine du jeudi 8 octobre à 10 h 30 confié à un autre praticien.",
    );
  });

  it("statusChanged prints the FRENCH status labels, never the enum values", () => {
    const sentence = APPOINTMENT_SUMMARIES.statusChanged(
      BENALI,
      AppointmentStatus.Planned,
      AppointmentStatus.Canceled,
    );
    expect(sentence).toBe(
      "Rendez-vous de BENALI Amine passé de « Planifié » à « Annulé ».",
    );
    expect(sentence).not.toMatch(/planned|canceled/);
    expect(
      APPOINTMENT_SUMMARIES.statusChanged(
        EL_AMRANI,
        AppointmentStatus.Confirmed,
        AppointmentStatus.Arrived,
      ),
    ).toBe(
      "Rendez-vous d’EL AMRANI Karim passé de « Confirmé » à « En salle d’attente ».",
    );
  });

  it("updated names the slot, never what was edited", () => {
    expect(APPOINTMENT_SUMMARIES.updated(EL_AMRANI, OCT_8_1030)).toBe(
      "Rendez-vous d’EL AMRANI Karim du jeudi 8 octobre à 10 h 30 modifié.",
    );
  });

  it("removed keeps a trail of the slot", () => {
    expect(APPOINTMENT_SUMMARIES.removed(HADDAD, OCT_8_1030)).toBe(
      "Rendez-vous de HADDAD Sara du jeudi 8 octobre à 10 h 30 supprimé.",
    );
  });
});

// ── Actes ───────────────────────────────────────────────────────────────────

describe("TREATMENT_SUMMARIES", () => {
  it("created names the acte, its teeth and the patient", () => {
    expect(
      TREATMENT_SUMMARIES.created(BENALI, "Composite 2 faces", ["36"]),
    ).toBe("Acte « Composite 2 faces » (dent 36) ajouté pour BENALI Amine.");
    expect(
      TREATMENT_SUMMARIES.created(BENALI, "Détartrage", []),
    ).toBe("Acte « Détartrage » ajouté pour BENALI Amine.");
  });

  it("updated elides «de»", () => {
    expect(TREATMENT_SUMMARIES.updated(EL_AMRANI, "Détartrage")).toBe(
      "Acte « Détartrage » d’EL AMRANI Karim modifié.",
    );
  });

  it("statusChanged prints the French acte labels", () => {
    expect(
      TREATMENT_SUMMARIES.statusChanged(
        BENALI,
        "Extraction simple",
        TreatmentStatus.Planned,
        TreatmentStatus.Completed,
      ),
    ).toBe(
      "Acte « Extraction simple » de BENALI Amine passé de « Prévu » à « Réalisé ».",
    );
  });

  it("removed keeps the teeth, plural included", () => {
    expect(
      TREATMENT_SUMMARIES.removed(EL_AMRANI, "Bridge", ["14", "15", "16"]),
    ).toBe("Acte « Bridge » (dents 14, 15, 16) d’EL AMRANI Karim supprimé.");
  });
});

// ── Payments ────────────────────────────────────────────────────────────────

describe("PAYMENT_SUMMARIES — the only lines with an amount", () => {
  it("created formats the amount in DH", () => {
    expect(PAYMENT_SUMMARIES.created(BENALI, 125_000)).toMatch(
      /^Paiement de 1\s250,00\sDH enregistré pour BENALI Amine\.$/,
    );
  });

  it("updated shows both amounts, or one when unchanged", () => {
    expect(PAYMENT_SUMMARIES.updated(EL_AMRANI, 50_000, 60_000)).toMatch(
      /^Paiement d’EL AMRANI Karim modifié : 500,00\sDH → 600,00\sDH\.$/,
    );
    expect(PAYMENT_SUMMARIES.updated(BENALI, 50_000, 50_000)).toMatch(
      /^Paiement de BENALI Amine modifié \(500,00\sDH\)\.$/,
    );
  });

  it("removed keeps a trail of the amount", () => {
    expect(PAYMENT_SUMMARIES.removed(HADDAD, 30_000)).toMatch(
      /^Paiement de HADDAD Sara supprimé \(300,00\sDH\)\.$/,
    );
  });
});

// ── Documents ───────────────────────────────────────────────────────────────

describe("DOCUMENT_SUMMARIES", () => {
  it("agrees in gender with the document type", () => {
    expect(
      DOCUMENT_SUMMARIES.generated(DocumentType.Invoice, "F-2026-0001", BENALI),
    ).toBe("Facture F-2026-0001 générée pour BENALI Amine.");
    expect(
      DOCUMENT_SUMMARIES.generated(DocumentType.Quote, "D-2026-0002", BENALI),
    ).toBe("Devis D-2026-0002 généré pour BENALI Amine.");
  });

  it("removed elides «de» and says the number is not reissued", () => {
    expect(
      DOCUMENT_SUMMARIES.removed(DocumentType.Invoice, "F-2026-0001", EL_AMRANI),
    ).toBe(
      "Facture F-2026-0001 d’EL AMRANI Karim supprimée (numéro non réattribué).",
    );
  });
});

describe("medical documents and their catalogues (prompts/29)", () => {
  it("names the type, the number and the patient — never the content", () => {
    expect(
      DOCUMENT_SUMMARIES.generated(DocumentType.Prescription, "O-2026-0001", BENALI),
    ).toBe("Ordonnance O-2026-0001 générée pour BENALI Amine.");
    expect(
      DOCUMENT_SUMMARIES.generated(DocumentType.Certificate, "C-2026-0001", BENALI),
    ).toBe("Certificat C-2026-0001 généré pour BENALI Amine.");
    expect(
      DOCUMENT_SUMMARIES.removed(DocumentType.Prescription, "O-2026-0002", EL_AMRANI),
    ).toBe(
      "Ordonnance O-2026-0002 d’EL AMRANI Karim supprimée (numéro non réattribué).",
    );
  });

  it("logs catalogue changes by their catalogue name", () => {
    expect(MEDICATION_SUMMARIES.created("Amoxicilline 1 g")).toBe(
      "Médicament « Amoxicilline 1 g » ajouté au catalogue.",
    );
    expect(MEDICATION_SUMMARIES.deactivated("Tramadol 50 mg")).toBe(
      "Médicament « Tramadol 50 mg » désactivé.",
    );
    expect(PRESCRIPTION_PACK_SUMMARIES.removed("Post-extraction")).toBe(
      "Pack d’ordonnance « Post-extraction » supprimé.",
    );
    expect(CERTIFICATE_TEMPLATE_SUMMARIES.updated("Certificat de repos")).toBe(
      "Modèle de certificat « Certificat de repos » modifié.",
    );
  });
});

// ── No amount outside payments (prompts/27, decision 4) ─────────────────────

describe("no builder except the payment one receives an amount", () => {
  // Compile-time half: `npm run typecheck` covers this file. Each line below
  // is an attempt to hand an amount to a non-payment builder; its
  // expect-error directive fails the typecheck the day a signature accepts one.
  it("is refused by the signatures", () => {
    const refused = () => {
      // @ts-expect-error — an acte line takes no amount.
      TREATMENT_SUMMARIES.created(BENALI, "Détartrage", [], 30_000);
      // @ts-expect-error — an acte update takes no amount.
      TREATMENT_SUMMARIES.updated(BENALI, "Détartrage", 30_000);
      // @ts-expect-error — a document line takes no amount.
      DOCUMENT_SUMMARIES.generated(DocumentType.Invoice, "F-1", BENALI, 30_000);
      // @ts-expect-error — an appointment line takes no amount.
      APPOINTMENT_SUMMARIES.statusChanged(BENALI, AppointmentStatus.Planned, AppointmentStatus.Canceled, 30_000);
    };
    expect(typeof refused).toBe("function");
  });

  // Run-time half: no non-payment sentence ever prints a currency.
  it("prints no «DH» outside payments", () => {
    const sentences = [
      APPOINTMENT_SUMMARIES.created(BENALI, OCT_8_1030),
      APPOINTMENT_SUMMARIES.rescheduled(BENALI, OCT_8_1030, OCT_9_1415),
      APPOINTMENT_SUMMARIES.updated(BENALI, OCT_8_1030),
      APPOINTMENT_SUMMARIES.removed(BENALI, OCT_8_1030),
      ...Object.values(AppointmentStatus).flatMap((from) =>
        Object.values(AppointmentStatus).map((to) =>
          APPOINTMENT_SUMMARIES.statusChanged(BENALI, from, to),
        ),
      ),
      TREATMENT_SUMMARIES.created(BENALI, "Couronne", ["26"]),
      TREATMENT_SUMMARIES.updated(BENALI, "Couronne"),
      TREATMENT_SUMMARIES.removed(BENALI, "Couronne", ["26"]),
      ...Object.values(TreatmentStatus).map((to) =>
        TREATMENT_SUMMARIES.statusChanged(BENALI, "Couronne", TreatmentStatus.Planned, to),
      ),
      DOCUMENT_SUMMARIES.generated(DocumentType.Invoice, "F-2026-0001", BENALI),
      DOCUMENT_SUMMARIES.removed(DocumentType.Quote, "D-2026-0001", BENALI),
    ];
    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/DH|MAD|€|\$/);
    }
  });
});
