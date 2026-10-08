import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import { PdfClinicHeader, type PdfClinicHeaderProps } from "./clinic-header";
import { PDF_FONT_FAMILY } from "./fonts";
import { PDF_PALETTE } from "./palette";

/**
 * The A4 page every billing document (facture, devis) is printed on.
 *
 * Presentational only: it receives French, already-formatted strings — every
 * amount already through `formatDH`, every date through `formatDate` — from
 * the documents slice, which owns the copy and reads the snapshot. Nothing
 * here knows a domain type, a label or a clinic.
 *
 * No reference layout exists for the PDF (prompts/21): a clean, sober page —
 * identity, title, patient, a fixed-width table, totals bottom right, then the
 * practitioner and a «Cachet et signature» area. One page when it fits; past
 * that the table header repeats and «Page n/N» appears.
 */

export interface PdfColumn {
  key: string;
  label: string;
  /** A percentage of the table width: fixed widths, no reflow per document. */
  width: string;
  align?: "left" | "right";
}

export interface PdfRow {
  key: string;
  cells: Record<string, string>;
}

export interface PdfAmountRow {
  label: string;
  value: string;
  emphasis?: boolean;
}

export interface PdfLabelledValue {
  label: string;
  value: string;
}

export interface BillingDocumentProps {
  /** The PDF's own metadata title (the viewer's tab). */
  documentTitle: string;
  author: string;
  header: PdfClinicHeaderProps;
  title: string;
  details: readonly PdfLabelledValue[];
  recipient: { heading: string; lines: readonly string[] };
  columns: readonly PdfColumn[];
  rows: readonly PdfRow[];
  totals: readonly PdfAmountRow[];
  /** The account situation under the totals (factures only). */
  situation: { caption: string; rows: readonly PdfAmountRow[] } | null;
  mentions: readonly string[];
  signature: { lines: readonly string[]; label: string };
  pageLabel: (page: number, total: number) => string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: PDF_FONT_FAMILY,
    fontSize: 10,
    color: PDF_PALETTE.text,
    paddingTop: 36,
    paddingHorizontal: 40,
    paddingBottom: 56,
    // No `lineHeight` here, nor on any wrapper: an inherited one stops
    // react-pdf (4.x) from drawing the render-prop page number. The default
    // leading reads well at these sizes.
  },
  titleBlock: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 18,
    marginBottom: 16,
    gap: 16,
  },
  titleColumn: { gap: 4 },
  title: { fontSize: 16, fontWeight: 700 },
  /** A short accent bar under the title — the page's one touch of colour. */
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
    width: 220,
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
  tableHeader: {
    flexDirection: "row",
    backgroundColor: PDF_PALETTE.surface,
    borderBottomWidth: 1,
    borderBottomColor: PDF_PALETTE.rule,
    fontSize: 8.5,
    fontWeight: 600,
    color: PDF_PALETTE.muted,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_PALETTE.rule,
    fontSize: 9,
  },
  cell: { paddingVertical: 5, paddingHorizontal: 5 },
  right: { textAlign: "right" },
  totals: {
    alignSelf: "flex-end",
    width: 250,
    marginTop: 12,
    gap: 3,
  },
  amountRow: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  amountEmphasis: {
    fontWeight: 700,
    fontSize: 11,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: PDF_PALETTE.text,
  },
  situation: {
    marginTop: 8,
    padding: 8,
    backgroundColor: PDF_PALETTE.surface,
    borderRadius: 3,
    gap: 3,
  },
  situationCaption: { fontSize: 8, color: PDF_PALETTE.muted, marginBottom: 2 },
  mentions: { marginTop: 14, gap: 2, fontSize: 8.5, color: PDF_PALETTE.muted },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 28,
    gap: 24,
  },
  practitioner: { gap: 2, fontSize: 9 },
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
    left: 40,
    right: 40,
    textAlign: "right",
    fontSize: 8,
    color: PDF_PALETTE.muted,
  },
});

const AmountRow = ({ row }: { row: PdfAmountRow }) => (
  <View style={[styles.amountRow, row.emphasis ? styles.amountEmphasis : {}]}>
    <Text>{row.label}</Text>
    <Text>{row.value}</Text>
  </View>
);

export const BillingDocument = ({
  documentTitle,
  author,
  header,
  title,
  details,
  recipient,
  columns,
  rows,
  totals,
  situation,
  mentions,
  signature,
  pageLabel,
}: BillingDocumentProps) => {
  const [recipientName, ...recipientLines] = recipient.lines;

  const cellStyle = (column: PdfColumn) => [
    styles.cell,
    { width: column.width },
    column.align === "right" ? styles.right : {},
  ];

  return (
    <Document title={documentTitle} author={author} language="fr-FR">
      <Page size="A4" style={styles.page}>
        <PdfClinicHeader {...header} />

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

        {/* `fixed` repeats the header row at the top of every page the
            table runs onto; `wrap={false}` keeps a row whole. */}
        <View>
          <View style={styles.tableHeader} fixed>
            {columns.map((column) => (
              <Text key={column.key} style={cellStyle(column)}>
                {column.label}
              </Text>
            ))}
          </View>
          {rows.map((row) => (
            <View key={row.key} style={styles.row} wrap={false}>
              {columns.map((column) => (
                <Text key={column.key} style={cellStyle(column)}>
                  {row.cells[column.key] ?? ""}
                </Text>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.totals} wrap={false}>
          {totals.map((row) => (
            <AmountRow key={row.label} row={row} />
          ))}
          {situation && (
            <View style={styles.situation}>
              <Text style={styles.situationCaption}>{situation.caption}</Text>
              {situation.rows.map((row) => (
                <AmountRow key={row.label} row={row} />
              ))}
            </View>
          )}
        </View>

        {mentions.length > 0 && (
          <View style={styles.mentions} wrap={false}>
            {mentions.map((mention) => (
              <Text key={mention}>{mention}</Text>
            ))}
          </View>
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

        {/* Only when the document overflows: a one-page invoice carries no
            «Page 1/1». */}
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
