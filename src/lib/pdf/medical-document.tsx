import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { PdfLabelledValue } from "./billing-document";
import { PdfClinicHeader, type PdfClinicHeaderProps } from "./clinic-header";
import { PDF_FONT_FAMILY } from "./fonts";
import { PDF_PALETTE } from "./palette";

/**
 * The A4 page an ordonnance or a certificat médical is printed on.
 *
 * Presentational only, like BillingDocument: it receives French,
 * already-formatted strings from the documents slice — every date already
 * through `formatDate` — and knows no domain type, no label, no clinic.
 *
 * No reference layout exists (prompts/29): a clean, sober page — identity
 * (or the same space left blank for pre-printed paper), title, date, the
 * patient, then the prescription lines or the certificate text, the place
 * and date, and the practitioner beside a «Cachet et signature» area.
 * The text is plain: line breaks are kept, nothing is interpreted.
 */

export interface PdfPrescriptionLine {
  key: string;
  /** «1.», «2.»… */
  marker: string;
  /** «Amoxicilline 1 g» — semibold. */
  heading: string;
  /** «1 comprimé matin et soir · Durée : 7 jours», or null. */
  detail: string | null;
  /** Muted, under the detail. */
  remark: string | null;
}

export interface MedicalDocumentProps {
  documentTitle: string;
  author: string;
  /** Null ⇒ «Papier à en-tête»: the block is not drawn, its space is kept. */
  header: PdfClinicHeaderProps | null;
  title: string;
  details: readonly PdfLabelledValue[];
  recipient: { heading: string; lines: readonly string[] };
  content:
    | { kind: "lines"; lines: readonly PdfPrescriptionLine[] }
    | { kind: "text"; text: string };
  /** «Fait à Agadir, le 12/10/2026». */
  placeAndDate: string | null;
  signature: { lines: readonly string[]; label: string };
  pageLabel: (page: number, total: number) => string;
}

/**
 * The height kept for the clinic header, drawn or not, so a page printed on
 * pre-printed paper starts its title at the same place as a full one.
 */
export const PDF_HEADER_RESERVED_HEIGHT = 96;

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    color: PDF_PALETTE.text,
    paddingTop: 36,
    paddingHorizontal: 48,
    paddingBottom: 56,
    // No `lineHeight` on the page or any wrapper (see BillingDocument): an
    // inherited one stops react-pdf from drawing the page number.
  },
  headerSlot: { minHeight: PDF_HEADER_RESERVED_HEIGHT },
  titleBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 14,
    marginBottom: 20,
    gap: 16,
  },
  titleColumn: { gap: 4, flexShrink: 1 },
  title: { fontSize: 15, fontWeight: 700, letterSpacing: 0.3 },
  titleAccent: {
    width: 36,
    height: 3,
    backgroundColor: PDF_PALETTE.primary,
    marginTop: 2,
    marginBottom: 4,
  },
  detail: { flexDirection: "row", gap: 4, fontSize: 9 },
  detailLabel: { color: PDF_PALETTE.muted },
  recipient: {
    width: 210,
    padding: 10,
    borderWidth: 1,
    borderColor: PDF_PALETTE.rule,
    borderRadius: 3,
    gap: 2,
  },
  recipientHeading: {
    fontSize: 8,
    color: PDF_PALETTE.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  recipientName: { fontSize: 11, fontWeight: 600 },
  recipientLine: { fontSize: 9 },
  lines: { gap: 12 },
  line: { flexDirection: "row", gap: 8 },
  lineMarker: { width: 16, fontWeight: 600, color: PDF_PALETTE.muted },
  lineBody: { flexGrow: 1, flexShrink: 1, gap: 2 },
  lineHeading: { fontSize: 11, fontWeight: 600 },
  lineDetail: { fontSize: 10 },
  lineRemark: { fontSize: 9, color: PDF_PALETTE.muted },
  // A readable measure: about 75 characters at this size.
  body: { fontSize: 11, lineHeight: 1.6, maxWidth: 420 },
  placeAndDate: { marginTop: 28, fontSize: 10 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 24,
  },
  practitioner: { gap: 2, fontSize: 9, flexShrink: 1 },
  practitionerName: { fontWeight: 600, fontSize: 10 },
  signature: {
    width: 200,
    height: 90,
    borderWidth: 1,
    borderColor: PDF_PALETTE.rule,
    borderStyle: "dashed",
    borderRadius: 3,
    padding: 6,
  },
  signatureLabel: { fontSize: 8, color: PDF_PALETTE.muted },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    left: 48,
    right: 48,
    textAlign: "right",
    fontSize: 8,
    color: PDF_PALETTE.muted,
  },
});

export const MedicalDocument = ({
  documentTitle,
  author,
  header,
  title,
  details,
  recipient,
  content,
  placeAndDate,
  signature,
  pageLabel,
}: MedicalDocumentProps) => {
  const [recipientName, ...recipientLines] = recipient.lines;

  return (
    <Document title={documentTitle} author={author} language="fr-FR">
      <Page size="A4" style={styles.page}>
        <View style={styles.headerSlot}>
          {header && <PdfClinicHeader {...header} />}
        </View>

        <View style={styles.titleBlock}>
          <View style={styles.titleColumn}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.titleAccent} />
            {details.map((detail) => (
              <View key={detail.label} style={styles.detail}>
                <Text style={styles.detailLabel}>{detail.label}</Text>
                <Text>{detail.value}</Text>
              </View>
            ))}
          </View>
          <View style={styles.recipient}>
            <Text style={styles.recipientHeading}>{recipient.heading}</Text>
            {recipientName && (
              <Text style={styles.recipientName}>{recipientName}</Text>
            )}
            {recipientLines.map((line) => (
              <Text key={line} style={styles.recipientLine}>
                {line}
              </Text>
            ))}
          </View>
        </View>

        {content.kind === "lines" ? (
          <View style={styles.lines}>
            {/* `wrap={false}`: a medication line is never split across pages. */}
            {content.lines.map((line) => (
              <View key={line.key} style={styles.line} wrap={false}>
                <Text style={styles.lineMarker}>{line.marker}</Text>
                <View style={styles.lineBody}>
                  <Text style={styles.lineHeading}>{line.heading}</Text>
                  {line.detail && (
                    <Text style={styles.lineDetail}>{line.detail}</Text>
                  )}
                  {line.remark && (
                    <Text style={styles.lineRemark}>{line.remark}</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          // One Text: react-pdf keeps «\n» as a line break, and a long
          // certificat flows onto a second page rather than being squeezed.
          <Text style={styles.body}>{content.text}</Text>
        )}

        {placeAndDate && (
          <Text style={styles.placeAndDate} minPresenceAhead={110}>
            {placeAndDate}
          </Text>
        )}

        <View style={styles.footer} wrap={false}>
          <View style={styles.practitioner}>
            {signature.lines.map((line, index) => (
              <Text
                key={line}
                style={index === 0 ? styles.practitionerName : {}}
              >
                {line}
              </Text>
            ))}
          </View>
          <View style={styles.signature}>
            <Text style={styles.signatureLabel}>{signature.label}</Text>
          </View>
        </View>

        <Text
          style={styles.pageNumber}
          fixed
          render={({ pageNumber, totalPages }) =>
            totalPages > 1 ? pageLabel(pageNumber, totalPages) : ""
          }
        />
      </Page>
    </Document>
  );
};
