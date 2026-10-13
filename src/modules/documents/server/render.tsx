import "server-only";

import { renderToBuffer } from "@react-pdf/renderer";

import {
  describeBalance,
  formatCalendarDate,
  formatDate,
  formatDH,
  formatPhone,
} from "@/lib/format";
import {
  BillingDocument,
  type BillingDocumentProps,
  type PdfAmountRow,
} from "@/lib/pdf/billing-document";
import { registerPdfFonts } from "@/lib/pdf/fonts";
import { loadPdfLogo, type PdfImage } from "@/lib/pdf/logo";
import {
  MedicalDocument,
  type MedicalDocumentProps,
} from "@/lib/pdf/medical-document";
import { formatPatientName } from "@/modules/patients/derived";
import { formatTeethList } from "@/modules/treatments/teeth";
import { DOCUMENT_PDF_COPY as P, LOGO_FETCH_TIMEOUT_MS } from "../constants";
import {
  documentSnapshotSchema,
  type BillingSnapshot,
  type DocumentSnapshot,
  type MedicalSnapshot,
} from "../snapshot";
import { DocumentType } from "../types";

/**
 * Snapshot → PDF. The ONLY input is the stored snapshot, parsed through its
 * versioned schema: no live row is read, so the same document renders the
 * same figures forever (prompts/21, decision 1). Every amount goes through
 * `formatDH`, every date through `formatDate` — the screens' formatters.
 */

export class UnreadableSnapshotError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("Stored document snapshot does not match any known version", options);
    this.name = "UnreadableSnapshotError";
  }
}

const IDENTIFIER_SEPARATOR = " · ";

const present = (values: readonly (string | null | false)[]) =>
  values.filter((value): value is string => Boolean(value));

/** «ICE … · Patente … · IF … · CNSS …»; an empty identifier is left out. */
const identifiersLine = ({ clinic }: DocumentSnapshot) =>
  present([
    clinic.ice && `${P.identifiers.ice} ${clinic.ice}`,
    clinic.patente && `${P.identifiers.patente} ${clinic.patente}`,
    clinic.fiscalId && `${P.identifiers.fiscalId} ${clinic.fiscalId}`,
    clinic.cnssNumber && `${P.identifiers.cnssNumber} ${clinic.cnssNumber}`,
  ]).join(IDENTIFIER_SEPARATOR);

/** The clinic block, identical on every document type. */
const clinicHeader = (snapshot: DocumentSnapshot, logo: PdfImage | null) => {
  const { clinic } = snapshot;
  return {
    logo,
    name: clinic.name,
    lines: present([
      clinic.address,
      clinic.city,
      clinic.phone && `${P.phone} ${formatPhone(clinic.phone)}`,
    ]),
    identifiers: identifiersLine(snapshot),
  };
};

/** Name, title, INPE — an empty INPE is left out, never «—» (decision 4). */
const signatureLines = (practitioner: DocumentSnapshot["practitioner"]) =>
  practitioner
    ? present([
        practitioner.name,
        practitioner.title,
        practitioner.inpe && `${P.inpe} ${practitioner.inpe}`,
      ])
    : [];

const amountRows = (snapshot: BillingSnapshot) => {
  const totals: PdfAmountRow[] = [
    { label: P.total, value: formatDH(snapshot.totalCents), emphasis: true },
  ];
  if (snapshot.type !== DocumentType.Invoice) {
    return { totals, situation: null };
  }

  // The account at the generation instant, frozen with the document. The
  // balance reads «Reste à payer» or «Avance» — never a minus sign.
  const { account } = snapshot;
  const balance = describeBalance(account.remainingCents);
  const rows: PdfAmountRow[] = [
    ...(account.totalBilledCents !== snapshot.totalCents
      ? [{ label: P.accountBilled, value: formatDH(account.totalBilledCents) }]
      : []),
    { label: P.paidToDate, value: formatDH(account.amountPaidCents) },
    { label: balance.label, value: formatDH(balance.amountCents), emphasis: true },
  ];
  return {
    totals,
    situation: {
      caption: P.accountSituation(formatDate(snapshot.issuedAt)),
      rows,
    },
  };
};

/** Pure: the page's props from a parsed snapshot. Exported for the tests. */
export const toBillingDocumentProps = (
  snapshot: BillingSnapshot,
  logo: PdfImage | null,
): BillingDocumentProps => {
  const { clinic, patient } = snapshot;
  const title = P.title(snapshot.type, snapshot.number);
  const { totals, situation } = amountRows(snapshot);

  return {
    documentTitle: title,
    author: clinic.name,
    header: clinicHeader(snapshot, logo),
    title,
    details: [
      { label: P.date, value: formatDate(snapshot.issuedAt) },
      ...(snapshot.type === DocumentType.Quote
        ? [
            {
              label: P.validUntil,
              value: formatCalendarDate(snapshot.validUntil),
            },
          ]
        : []),
    ],
    recipient: {
      heading: P.patient,
      lines: present([
        formatPatientName(patient),
        `${P.patientCode} ${patient.shortCode}`,
        patient.cin && `${P.cin} ${patient.cin}`,
        patient.phone && `${P.phone} ${formatPhone(patient.phone)}`,
      ]),
    },
    columns: [
      { key: "date", label: P.columns.date, width: "13%" },
      { key: "label", label: P.columns.label, width: "39%" },
      { key: "code", label: P.columns.code, width: "11%" },
      { key: "teeth", label: P.columns.teeth, width: "19%" },
      { key: "amount", label: P.columns.amount, width: "18%", align: "right" },
    ],
    rows: snapshot.lines.map((line, index) => ({
      key: `${line.treatmentId}-${index}`,
      cells: {
        date: formatDate(line.date),
        label: line.label,
        code: line.nomenclatureCode ?? "",
        teeth: line.teeth.length > 0 ? formatTeethList(line.teeth) : P.noTeeth,
        amount: formatDH(line.amountCents),
      },
    })),
    totals,
    situation,
    mentions: snapshot.type === DocumentType.Quote ? [P.quoteMention] : [],
    signature: { lines: signatureLines(snapshot.practitioner), label: P.signature },
    pageLabel: P.page,
  };
};

/** «1 comprimé matin et soir · Durée : 7 jours»; either half may be absent. */
const lineDetail = (posology: string, duration: string | null) =>
  present([posology, duration && `${P.duration} : ${duration}`]).join(" · ") ||
  null;

/**
 * Pure: the ordonnance's or the certificat's props from a parsed snapshot.
 * Exported for the tests. «Papier à en-tête» drops the header block — the
 * page keeps its space (MedicalDocument's reserved slot).
 */
export const toMedicalDocumentProps = (
  snapshot: MedicalSnapshot,
  logo: PdfImage | null,
): MedicalDocumentProps => {
  const { clinic, patient } = snapshot;
  const title =
    snapshot.type === DocumentType.Certificate
      ? P.certificateTitle(snapshot.number)
      : P.title(snapshot.type, snapshot.number);
  const issuedOn = formatDate(snapshot.issuedAt);

  return {
    documentTitle: title,
    author: clinic.name,
    header: snapshot.noHeader ? null : clinicHeader(snapshot, logo),
    title,
    details: [{ label: P.date, value: issuedOn }],
    recipient: {
      heading: P.patient,
      lines: present([
        formatPatientName(patient),
        patient.age !== null && P.age(patient.age),
        patient.cin && `${P.cin} ${patient.cin}`,
      ]),
    },
    content:
      snapshot.type === DocumentType.Prescription
        ? {
            kind: "lines",
            lines: snapshot.lines.map((line, index) => ({
              key: String(index),
              marker: `${index + 1}.`,
              heading: present([line.label, line.strength]).join(" "),
              detail: lineDetail(line.posology, line.duration),
              remark: line.remark,
            })),
          }
        : { kind: "text", text: snapshot.body },
    placeAndDate: P.placeAndDate(clinic.city, issuedOn),
    signature: { lines: signatureLines(snapshot.practitioner), label: P.signature },
    pageLabel: P.page,
  };
};

/** Reads a stored snapshot; throws `UnreadableSnapshotError` on an unknown shape. */
export const parseStoredSnapshot = (stored: unknown): DocumentSnapshot => {
  const parsed = documentSnapshotSchema.safeParse(stored);
  if (!parsed.success) throw new UnreadableSnapshotError({ cause: parsed.error });
  return parsed.data;
};

const isMedical = (snapshot: DocumentSnapshot): snapshot is MedicalSnapshot =>
  snapshot.type === DocumentType.Prescription ||
  snapshot.type === DocumentType.Certificate;

export const renderDocumentPdf = async (stored: unknown): Promise<Buffer> => {
  const snapshot = parseStoredSnapshot(stored);
  registerPdfFonts();

  if (isMedical(snapshot)) {
    // On pre-printed paper the header is not drawn: no logo to fetch.
    const logo = snapshot.noHeader
      ? null
      : await loadPdfLogo(snapshot.clinic.logoUrl, LOGO_FETCH_TIMEOUT_MS);
    return renderToBuffer(
      <MedicalDocument {...toMedicalDocumentProps(snapshot, logo)} />,
    );
  }

  const logo = await loadPdfLogo(snapshot.clinic.logoUrl, LOGO_FETCH_TIMEOUT_MS);
  return renderToBuffer(
    <BillingDocument {...toBillingDocumentProps(snapshot, logo)} />,
  );
};
