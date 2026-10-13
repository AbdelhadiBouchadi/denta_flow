import { formatCalendarDate, formatLongDate } from "@/lib/format";
import { isCalendarDate } from "@/lib/time";
import { CERTIFICATE_BODY_MAX } from "@/modules/documents/constants";
import type { CertificatePeriod } from "@/modules/documents/snapshot";
import { formatPatientName } from "@/modules/patients/derived";
import {
  CERTIFICATE_PERIOD_VARIABLES,
  CERTIFICATE_RENDER_ERRORS as E,
  CERTIFICATE_VARIABLES,
  type CertificateVariable,
} from "./constants";

/**
 * The certificate body renderer — pure, no `db`, so the server (the
 * authority) and the builder's preview run the very same code, and Vitest
 * covers it.
 *
 * Plain text in, plain text out (prompts/29, decision 8): no HTML, no
 * markdown, nothing to sanitise. Line breaks are kept.
 *
 * Rules:
 * - `{{name}}`, spaces inside the braces tolerated. An unknown name is an
 *   error naming it; a known one without a value is an error naming it.
 * - `{{cin}}` with no CIN removes its WHOLE LINE — «CIN : {{cin}}» must not
 *   print as «CIN : ».
 * - Any «{{» or «}}» left once the variables are replaced is an error: the
 *   dentist sees it before the patient does.
 */

const TOKEN = /\{\{\s*([^{}\s]*)\s*\}\}/g;

const isVariable = (name: string): name is CertificateVariable =>
  (CERTIFICATE_VARIABLES as readonly string[]).includes(name);

/** The variables a body uses, in order of first appearance. */
export const findVariables = (body: string) => {
  const names: string[] = [];
  for (const match of body.matchAll(TOKEN)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
};

/** The first unknown variable of a body, or null. */
export const findUnknownVariable = (body: string) =>
  findVariables(body).find((name) => !isVariable(name)) ?? null;

/**
 * Why a TEMPLATE body cannot be saved, in French, or null. Only the syntax is
 * checked — every name known, no stray braces; values come at generation.
 */
export const templateBodyError = (body: string) => {
  const unknown = findUnknownVariable(body);
  if (unknown !== null) return E.unknown(unknown);
  if (/\{\{|\}\}/.test(body.replace(TOKEN, ""))) return E.malformed;
  return null;
};

/** Whether a body uses one of the period variables — the builder's dates. */
export const usesPeriod = (body: string) =>
  findVariables(body).some((name) =>
    (CERTIFICATE_PERIOD_VARIABLES as readonly string[]).includes(name),
  );

export type CertificateValues = Record<
  Exclude<CertificateVariable, "cin" | "debut" | "fin" | "jours">,
  string
> & {
  cin: string | null;
  debut: string | null;
  fin: string | null;
  jours: string | null;
};

export type RenderResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

export const renderCertificateBody = (
  body: string,
  values: CertificateValues,
): RenderResult => {
  const unknown = findUnknownVariable(body);
  if (unknown !== null) return { ok: false, error: E.unknown(unknown) };

  const lines: string[] = [];
  for (const line of body.replace(/\r\n?/g, "\n").split("\n")) {
    const names = findVariables(line) as CertificateVariable[];
    if (names.includes("cin") && values.cin === null) continue;

    const missing = names.find((name) => values[name] === null);
    if (missing) return { ok: false, error: E.missing(missing) };

    lines.push(
      line.replace(TOKEN, (_, name: CertificateVariable) => values[name] ?? ""),
    );
  }

  const text = lines.join("\n").trim();
  if (/\{\{|\}\}/.test(text)) return { ok: false, error: E.malformed };
  if (text.length === 0) return { ok: false, error: E.empty };
  if (text.length > CERTIFICATE_BODY_MAX) return { ok: false, error: E.tooLong };
  return { ok: true, text };
};

// ── The period ──────────────────────────────────────────────────────────────

/** Whole days from `start` to `end`, both counted: 12 → 14 is 3 days. */
export const countDaysInclusive = (start: string, end: string) => {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  return (Date.UTC(ey, em - 1, ed) - Date.UTC(sy, sm - 1, sd)) / 86_400_000 + 1;
};

export type PeriodResult =
  | { ok: true; period: CertificatePeriod }
  | { ok: false; error: string };

/**
 * The period a certificat prints. Clinic calendar days, «fin ≥ début». When
 * both dates exist, `jours` is COMPUTED from them and the client's number is
 * ignored; the client's number is used only when there is no range.
 * A malformed day reads as absent (the schema already refused it).
 */
export const resolveCertificatePeriod = (input: {
  startDate?: string | null;
  endDate?: string | null;
  days?: number | null;
}): PeriodResult => {
  const startDate =
    input.startDate && isCalendarDate(input.startDate) ? input.startDate : null;
  const endDate =
    input.endDate && isCalendarDate(input.endDate) ? input.endDate : null;

  if (startDate && endDate) {
    if (endDate < startDate) return { ok: false, error: E.rangeInverted };
    return {
      ok: true,
      period: { startDate, endDate, days: countDaysInclusive(startDate, endDate) },
    };
  }
  return { ok: true, period: { startDate, endDate, days: input.days ?? null } };
};

/**
 * The values of every variable, from the facts the SERVER read (or, for the
 * preview, the same facts the dossier shows). `issuedAt` is the generation
 * instant: `{{date}}` is that day on the clinic's calendar.
 */
export const buildCertificateValues = ({
  patient,
  practitionerName,
  issuedAt,
  period,
}: {
  patient: { firstName: string; lastName: string; cin: string | null };
  practitionerName: string;
  issuedAt: Date;
  period: CertificatePeriod;
}): CertificateValues => ({
  patient: formatPatientName(patient),
  cin: patient.cin?.trim() ? patient.cin.trim() : null,
  date: formatLongDate(issuedAt),
  debut: period.startDate ? formatCalendarDate(period.startDate) : null,
  fin: period.endDate ? formatCalendarDate(period.endDate) : null,
  jours: period.days !== null ? String(period.days) : null,
  praticien: practitionerName,
});
