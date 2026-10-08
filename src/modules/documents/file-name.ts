import { toClinicTime, type ClinicDateInput } from "@/lib/time";
import { DOCUMENT_TYPE_LABELS } from "./constants";
import type { GeneratedDocumentType } from "./types";

/**
 * `Facture_Prenom_NOM_17_06_2026_190049.pdf` (08-clinical.md §5): the type,
 * the patient, then the generation date and time on the CLINIC's wall clock.
 *
 * The name travels in a `Content-Disposition` header, so it is reduced to
 * ASCII letters, digits and hyphens: accents are folded («Aït» → «Ait»), any
 * other run of characters — a space, an apostrophe — becomes one hyphen, and
 * `_` stays the field separator.
 */

const pad2 = (value: number) => String(value).padStart(2, "0");

/** A name part made safe for a header; never empty. */
export const toFileNamePart = (value: string, fallback: string) => {
  const ascii = value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return ascii || fallback;
};

const FALLBACK_NAME = "Patient";

export const buildDocumentFileName = ({
  type,
  firstName,
  lastName,
  issuedAt,
}: {
  type: GeneratedDocumentType;
  firstName: string;
  lastName: string;
  issuedAt: ClinicDateInput;
}) => {
  const local = toClinicTime(issuedAt);
  const date = `${pad2(local.getDate())}_${pad2(local.getMonth() + 1)}_${local.getFullYear()}`;
  const time = `${pad2(local.getHours())}${pad2(local.getMinutes())}${pad2(local.getSeconds())}`;
  const first = toFileNamePart(firstName, FALLBACK_NAME);
  const last = toFileNamePart(lastName, FALLBACK_NAME).toUpperCase();
  const label = toFileNamePart(DOCUMENT_TYPE_LABELS[type], "Document");
  return `${label}_${first}_${last}_${date}_${time}.pdf`;
};
