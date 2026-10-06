/**
 * Typed access to the NGAP dataset (services/data/ngap-acts.json).
 *
 * Reference data, not the clinic's price list: `referenceTariffCents` is the
 * reimbursement basis and is NEVER written to `services.defaultPriceCents`
 * except as an editable starting value on import (08-clinical.md §3). The file
 * is an unofficial compilation, not verified against the regulation — never
 * call it «officiel».
 *
 * No `server-only`: the seed script imports this. But NO client component may
 * import it — the browser reaches the nomenclature only through tRPC
 * (`services.searchNgap`), so the 150-act JSON never ships in a bundle.
 *
 * Types are derived from the JSON shape; the whole file is validated with Zod
 * once, in ngap.test.ts, not at runtime.
 */
import dataset from "./data/ngap-acts.json";
import { NgapXrayRequirement, ServiceCategory } from "./types";

type RawNgapAct = (typeof dataset)["acts"][number];

/** The letters the dataset prices: C, V (consultation), D (dental), Z (radiology). */
export type NgapLetter = "C" | "V" | "D" | "Z";

/**
 * The JSON's string fields, narrowed to the unions ngap.test.ts proves they
 * hold. Everything else is the JSON's own inferred shape.
 */
export type NgapAct = Omit<
  RawNgapAct,
  "suggestedCategory" | "xrayRequired" | "letter" | "onQuote"
> & {
  letter: NgapLetter;
  suggestedCategory: ServiceCategory;
  xrayRequired: NgapXrayRequirement | null;
  /** Coefficient 0: no tariff of its own, priced on quote. */
  onQuote?: boolean;
};

export const NGAP_ACTS = dataset.acts as readonly NgapAct[];

export const NGAP_META = dataset.meta;

/** The 7 chapters, in the dataset's order. */
export const NGAP_CHAPTERS: readonly string[] = [
  ...new Set(NGAP_ACTS.map((act) => act.nomenclatureCategory)),
];

export interface NgapLetterValue {
  letter: NgapLetter;
  cents: number;
  chapters: readonly string[];
}

/**
 * Letter values as the tariff regulation set them when the file was compiled.
 * `D` has two values depending on the chapter. Updating them is a data-file
 * change, never a code change.
 */
export const NGAP_LETTER_VALUES: readonly NgapLetterValue[] = Object.entries(
  dataset.meta.letterValues,
).flatMap(([letter, value]) =>
  (Array.isArray(value) ? value : [value]).map((entry) => ({
    letter: letter as NgapLetter,
    cents: entry.cents,
    chapters: entry.chapters,
  })),
);

/** The letter value in force for an act's letter in its chapter. */
export const getLetterValueCents = (letter: string, chapter: string) =>
  NGAP_LETTER_VALUES.find(
    (value) => value.letter === letter && value.chapters.includes(chapter),
  )?.cents ?? null;

const ACTS_BY_CODE = new Map(NGAP_ACTS.map((act) => [act.code, act]));

/** Exact, case-sensitive code lookup — codes are stored as the dataset writes them. */
export const getNgapAct = (code: string | null | undefined) =>
  code ? (ACTS_BY_CODE.get(code) ?? null) : null;

/** «Détartrage» and «detartrage» are the same search. */
export const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const SEARCH_INDEX = new Map(
  NGAP_ACTS.map((act) => [
    act.code,
    normalizeSearchText(`${act.code} ${act.designation}`),
  ]),
);

interface SearchNgapActsOptions {
  query?: string | null;
  chapter?: string | null;
  limit?: number;
}

/**
 * Case- and accent-insensitive search on code and wording. Every word of the
 * query must match. An exact code match comes first, then code prefixes, then
 * the dataset's own order.
 */
export const searchNgapActs = ({
  query,
  chapter,
  limit = NGAP_ACTS.length,
}: SearchNgapActsOptions = {}): NgapAct[] => {
  const terms = normalizeSearchText(query ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const needle = terms.join(" ");

  const rank = (act: NgapAct) => {
    const code = act.code.toLowerCase();
    if (code === needle) return 0;
    if (code.startsWith(needle)) return 1;
    return 2;
  };

  return NGAP_ACTS.map((act, index) => ({ act, index }))
    .filter(({ act }) => !chapter || act.nomenclatureCategory === chapter)
    .filter(({ act }) => {
      const haystack = SEARCH_INDEX.get(act.code) ?? "";
      return terms.every((term) => haystack.includes(term));
    })
    .sort((a, b) =>
      terms.length > 0
        ? rank(a.act) - rank(b.act) || a.index - b.index
        : a.index - b.index,
    )
    .slice(0, limit)
    .map(({ act }) => act);
};

/** The key the catalogue's «unique label within a category» rule compares on. */
export const serviceLabelKey = (category: string, label: string) =>
  `${category}|${label.trim().toLowerCase()}`;

interface ExistingCatalogue {
  /** Every `nomenclatureCode` already in `services`, active or not. */
  codes: ReadonlySet<string>;
  /** `serviceLabelKey` of every existing service. */
  labelKeys: ReadonlySet<string>;
}

/**
 * Which of the requested codes `services.importNgap` will create. A code is
 * skipped when a service already carries it, or when its wording already
 * names a service of the same category (the label rule). Pure, so the
 * idempotence is testable without a database.
 */
export const planNgapImport = (
  codes: readonly string[],
  existing: ExistingCatalogue,
) => {
  const toCreate: NgapAct[] = [];
  const labelKeys = new Set(existing.labelKeys);
  let skipped = 0;

  for (const code of new Set(codes)) {
    const act = getNgapAct(code);
    if (!act) continue;

    const labelKey = serviceLabelKey(act.suggestedCategory, act.designation);
    if (existing.codes.has(code) || labelKeys.has(labelKey)) {
      skipped++;
      continue;
    }

    labelKeys.add(labelKey);
    toCreate.push(act);
  }

  return { toCreate, skipped };
};
