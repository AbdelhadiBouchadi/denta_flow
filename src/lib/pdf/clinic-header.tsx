import { Image, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { PdfImage } from "./logo";
import { PDF_PALETTE } from "./palette";

export interface PdfClinicHeaderProps {
  /** Null ⇒ a text-only header. */
  logo: PdfImage | null;
  name: string;
  /** Address, city, phone — only the ones the clinic filled in. */
  lines: readonly string[];
  /** «ICE … · Patente … · IF … · CNSS …», already joined; "" ⇒ omitted. */
  identifiers: string;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: PDF_PALETTE.rule,
  },
  logo: { width: 64, height: 64, objectFit: "contain" },
  identity: { flexGrow: 1, flexShrink: 1 },
  name: { fontSize: 14, fontWeight: 700, marginBottom: 2 },
  line: { fontSize: 9 },
  identifiers: { fontSize: 8, color: PDF_PALETTE.muted, marginTop: 3 },
});

/**
 * The clinic's identity, drawn from data only — nothing about any clinic is
 * written here. The letterhead upload (V1.1) will replace this block with the
 * clinic's own background.
 */
export const PdfClinicHeader = ({
  logo,
  name,
  lines,
  identifiers,
}: PdfClinicHeaderProps) => (
  <View style={styles.header}>
    {/* eslint-disable-next-line jsx-a11y/alt-text -- a PDF image, not an <img> */}
    {logo && <Image style={styles.logo} src={logo} />}
    <View style={styles.identity}>
      <Text style={styles.name}>{name}</Text>
      {lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
      {identifiers && <Text style={styles.identifiers}>{identifiers}</Text>}
    </View>
  </View>
);
