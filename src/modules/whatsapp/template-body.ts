import {
  CHIP_VALUES,
  EVENTS_REQUIRING_DATE_TIME,
  PROMOTIONAL_WORDS,
  TEMPLATE_BODY_MAX,
  TEMPLATE_MAX_CONSECUTIVE_SPACES,
  WHATSAPP_VALIDATION as V,
} from "./constants";
import type { MessageParams } from "./message";
import { MessageChip, type BodySegment, type WhatsappEvent } from "./types";

/**
 * A message in its three forms (prompts/33b, decision 5). Pure, isomorphic.
 *
 * - **segments** — what the editor holds and the client sends: text and
 *   chips, never a placeholder string;
 * - **canonical** — `body` with `{{1}}`, `{{2}}`… plus `variables`, the chip
 *   behind each number. Numbers follow FIRST APPEARANCE, because WhatsApp
 *   requires sequential placeholders: a message without «Prénom» still starts
 *   at `{{1}}`. Stored, sent for approval, never shown;
 * - **rendered** — the plain text a patient reads, for the preview, manual
 *   mode and the sandbox.
 */

export interface CanonicalBody {
  body: string;
  variables: MessageChip[];
}

/** A body that cannot be read back — stored data damaged, never user input. */
export class MalformedBodyError extends Error {
  constructor() {
    super("Malformed template body");
    this.name = "MalformedBodyError";
  }
}

const PLACEHOLDER = /\{\{(\d+)\}\}/g;
const BRACES = /[{}]/;
const LINE_BREAK = /[\r\n\t]/;
const TOO_MANY_SPACES = new RegExp(` {${TEMPLATE_MAX_CONSECUTIVE_SPACES + 1},}`);
const WORD = /[\p{L}\p{N}]/u;

export const isChip = (value: unknown): value is MessageChip =>
  (CHIP_VALUES as readonly unknown[]).includes(value);

/** Neighbouring texts merged, empty texts dropped. */
export const normalizeSegments = (segments: readonly BodySegment[]): BodySegment[] =>
  segments.reduce<BodySegment[]>((result, segment) => {
    if (segment.type === "chip") return [...result, segment];
    if (segment.text === "") return result;
    const last = result.at(-1);
    if (last?.type === "text") {
      return [...result.slice(0, -1), { type: "text", text: last.text + segment.text }];
    }
    return [...result, segment];
  }, []);

/** Segments → the canonical body. Refuses braces typed as text. */
export const toCanonical = (segments: readonly BodySegment[]): CanonicalBody => {
  const variables: MessageChip[] = [];
  let body = "";
  for (const segment of normalizeSegments(segments)) {
    if (segment.type === "text") {
      // Validation rejects these first; this keeps a forged body impossible.
      if (BRACES.test(segment.text)) throw new MalformedBodyError();
      body += segment.text;
      continue;
    }
    if (!isChip(segment.chip)) throw new MalformedBodyError();
    let index = variables.indexOf(segment.chip);
    if (index === -1) index = variables.push(segment.chip) - 1;
    body += `{{${index + 1}}}`;
  }
  return { body, variables };
};

/** The canonical body → segments. Throws on a number with no chip. */
export const fromCanonical = ({ body, variables }: CanonicalBody): BodySegment[] => {
  const segments: BodySegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(PLACEHOLDER)) {
    const chip = variables[Number(match[1]) - 1];
    if (!isChip(chip)) throw new MalformedBodyError();
    segments.push({ type: "text", text: body.slice(cursor, match.index) });
    segments.push({ type: "chip", chip });
    cursor = match.index + match[0].length;
  }
  segments.push({ type: "text", text: body.slice(cursor) });
  const result = normalizeSegments(segments);
  if (result.some((segment) => segment.type === "text" && BRACES.test(segment.text))) {
    throw new MalformedBodyError();
  }
  return result;
};

/** The value each chip takes in one message. */
export type ChipValues = Record<MessageChip, string>;

export const chipValuesFrom = (params: MessageParams): ChipValues => ({
  [MessageChip.FirstName]: params.firstName,
  [MessageChip.Date]: params.date,
  [MessageChip.Time]: params.time,
  [MessageChip.ClinicName]: params.clinicName,
  [MessageChip.ClinicPhone]: params.clinicPhone,
});

/** Segments as the patient reads them. */
export const renderSegments = (segments: readonly BodySegment[], values: ChipValues) =>
  segments
    .map((segment) => (segment.type === "text" ? segment.text : values[segment.chip]))
    .join("");

/** The canonical body as the patient reads it — manual mode and the sandbox. */
export const renderCanonical = (canonical: CanonicalBody, values: ChipValues) =>
  renderSegments(fromCanonical(canonical), values);

/**
 * `{"1": "…", "2": "…"}` for the numbers a Content resource uses — the
 * Messages API's `ContentVariables`, and the approval request's examples.
 */
export const contentVariablesFor = (
  variables: readonly MessageChip[],
  values: ChipValues,
): Record<string, string> =>
  Object.fromEntries(variables.map((chip, index) => [String(index + 1), values[chip]]));

const textBetween = (segments: BodySegment[], from: number, to: number) =>
  segments
    .slice(from, to)
    .map((segment) => (segment.type === "text" ? segment.text : ""))
    .join("");

/**
 * Every rule a message breaks, as French messages; `[]` when it is valid.
 * WhatsApp's own rules (Twilio, «message template approvals»): no
 * placeholder at the start or the end, at least one word between two, no
 * line break or tab, at most four spaces in a row, 1 024 characters.
 */
export const bodyErrors = (
  segments: readonly BodySegment[],
  kind: WhatsappEvent,
): string[] => {
  const normalized = normalizeSegments(segments);
  const texts = normalized.flatMap((segment) => (segment.type === "text" ? [segment.text] : []));
  const chips = normalized.flatMap((segment) => (segment.type === "chip" ? [segment.chip] : []));

  if (normalized.length === 0 || (chips.length === 0 && texts.join("").trim() === "")) {
    return [V.bodyRequired];
  }
  if (normalized.some((segment) => segment.type === "chip" && !isChip(segment.chip))) {
    return [V.bodyInvalid];
  }

  const errors: string[] = [];
  if (texts.some((value) => BRACES.test(value))) errors.push(V.bodyBraces);
  if (texts.some((value) => LINE_BREAK.test(value))) errors.push(V.bodyLineBreak);
  if (texts.some((value) => TOO_MANY_SPACES.test(value))) errors.push(V.bodySpaces);

  const chipIndexes = normalized.flatMap((segment, index) =>
    segment.type === "chip" ? [index] : [],
  );
  if (chipIndexes.length > 0) {
    const first = chipIndexes[0];
    const last = chipIndexes.at(-1)!;
    if (
      textBetween(normalized, 0, first).trim() === "" ||
      textBetween(normalized, last + 1, normalized.length).trim() === ""
    ) {
      errors.push(V.bodyEdgeChip);
    }
    const adjacent = chipIndexes
      .slice(1)
      .some((index, position) => !WORD.test(textBetween(normalized, chipIndexes[position] + 1, index)));
    if (adjacent) errors.push(V.bodyAdjacentChips);
  }

  if (
    EVENTS_REQUIRING_DATE_TIME.includes(kind) &&
    (!chips.includes(MessageChip.Date) || !chips.includes(MessageChip.Time))
  ) {
    errors.push(V.bodyDateTime);
  }

  if (!errors.includes(V.bodyBraces) && toCanonical(normalized).body.length > TEMPLATE_BODY_MAX) {
    errors.push(V.bodyTooLong);
  }
  return errors;
};

/** The canonical length — what the counter under the editor shows. */
export const canonicalLength = (segments: readonly BodySegment[]) => {
  try {
    return toCanonical(segments).body.length;
  } catch {
    return 0;
  }
};

const PROMOTIONAL = new RegExp(
  `(^|[^\\p{L}])(${PROMOTIONAL_WORDS.filter((word) => word !== "%").join("|")})([^\\p{L}]|$)`,
  "iu",
);

/** Marketing-sounding wording: a warning in the editor, never a refusal. */
export const isPromotional = (segments: readonly BodySegment[]) => {
  const plain = segments
    .map((segment) => (segment.type === "text" ? segment.text : " "))
    .join("");
  return PROMOTIONAL.test(plain) || plain.includes("%");
};

/** Two segment lists say the same thing. */
export const sameCanonical = (a: CanonicalBody, b: CanonicalBody) =>
  a.body === b.body &&
  a.variables.length === b.variables.length &&
  a.variables.every((chip, index) => chip === b.variables[index]);
