import { format } from "date-fns";
import { fr } from "date-fns/locale";

import {
  clinicInstant,
  previousCalendarDate,
  toClinicDate,
  toClinicTime,
  type ClinicDateInput,
} from "@/lib/time";
import {
  IMAGING_COMPARE_MAX,
  IMAGING_COPY as COPY,
  PATIENT_FILE_KIND_GROUP_LABELS,
  PATIENT_FILE_KIND_ORDER,
} from "./constants";
import { ImagingGroupBy, type PatientFileKind } from "./types";

/**
 * The «Imagerie» grid's pure rules (prompts/32), free of React and `db` so
 * Vitest covers them: grouping, the compare selection and the filmstrip's
 * neighbours. Grouping is a VIEW of the rows `getManyByPatient` returned —
 * already ordered newest first — never a second query.
 */

/** What grouping needs of a row: the gallery's `ImagingFile` satisfies it. */
export interface GroupableFile {
  id: string;
  kind: string;
  takenAt: ClinicDateInput;
}

export interface ImagingGroup<T extends GroupableFile> {
  /** Stable across renders: the clinic day, or the kind. */
  key: string;
  label: string;
  files: T[];
}

const kindRank = (kind: string) => {
  const rank = PATIENT_FILE_KIND_ORDER.indexOf(kind as PatientFileKind);
  return rank === -1 ? PATIENT_FILE_KIND_ORDER.length : rank;
};

const instantOf = (value: ClinicDateInput) => new Date(value).getTime();

const byId = (a: GroupableFile, b: GroupableFile) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

/**
 * A group header's date: «Aujourd’hui», «Hier», then «12 octobre 2026».
 * `day` and `today` are clinic calendar days; the long form is read from the
 * day's clinic-midnight instant on the clinic clock, never the browser's.
 */
export const formatGroupDate = (day: string, today: string) => {
  if (day === today) return COPY.today;
  if (day === previousCalendarDate(today)) return COPY.yesterday;
  return format(toClinicTime(clinicInstant(day)), "d MMMM yyyy", { locale: fr });
};

/**
 * «Par date»: one group per clinic day of `takenAt`, newest day first;
 * inside a day, the fixed kind order then `id`. `now` is injected so the
 * «Aujourd’hui» / «Hier» boundary is the clinic's, testable on any clock.
 */
export const groupByDate = <T extends GroupableFile>(
  files: readonly T[],
  now: ClinicDateInput,
): ImagingGroup<T>[] => {
  const today = toClinicDate(now);
  const days = new Map<string, T[]>();
  for (const file of files) {
    const day = toClinicDate(file.takenAt);
    const bucket = days.get(day);
    if (bucket) bucket.push(file);
    else days.set(day, [file]);
  }

  // "yyyy-MM-dd" sorts as text in calendar order.
  return [...days.keys()]
    .sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
    .map((day) => ({
      key: day,
      label: formatGroupDate(day, today),
      files: [...days.get(day)!].sort(
        (a, b) => kindRank(a.kind) - kindRank(b.kind) || byId(a, b),
      ),
    }));
};

/**
 * «Par type»: Panoramiques, Rétro-alvéolaires, Téléradiographies, Photos,
 * Autres — each newest first (then `id`); an empty kind has no group.
 */
export const groupByType = <T extends GroupableFile>(
  files: readonly T[],
): ImagingGroup<T>[] =>
  PATIENT_FILE_KIND_ORDER.map((kind) => ({
    key: kind,
    label: PATIENT_FILE_KIND_GROUP_LABELS[kind],
    files: files
      .filter((file) => file.kind === kind)
      .sort(
        (a, b) => instantOf(b.takenAt) - instantOf(a.takenAt) || byId(a, b),
      ),
  })).filter((group) => group.files.length > 0);

export const groupFiles = <T extends GroupableFile>(
  files: readonly T[],
  groupBy: ImagingGroupBy,
  now: ClinicDateInput,
) =>
  groupBy === ImagingGroupBy.Type
    ? groupByType(files)
    : groupByDate(files, now);

/** The grouped set, flattened: the order the viewer and filmstrip walk. */
export const flattenGroups = <T extends GroupableFile>(
  groups: readonly ImagingGroup<T>[],
) => groups.flatMap((group) => group.files);

// ── Compare selection (decision 5) ──────────────────────────────────────────

export interface CompareSelection {
  selected: string[];
  /** A third pick was refused: the caller shows a quiet toast. */
  refused: boolean;
}

/** Tap a tile: deselect it, select it, or refuse a third one. */
export const toggleCompareSelection = (
  selected: readonly string[],
  id: string,
  max = IMAGING_COMPARE_MAX,
): CompareSelection => {
  if (selected.includes(id)) {
    return { selected: selected.filter((item) => item !== id), refused: false };
  }
  if (selected.length >= max) return { selected: [...selected], refused: true };
  return { selected: [...selected, id], refused: false };
};

// ── Filmstrip neighbours (decision 6) ───────────────────────────────────────

export interface Neighbours {
  /** -1 when `id` is not in the set (removed, or filtered out). */
  index: number;
  previousId: string | null;
  nextId: string | null;
}

/** Where `id` sits in the walked set, and who is on either side. No wrap. */
export const neighboursOf = (
  ids: readonly string[],
  id: string | null,
): Neighbours => {
  const index = id === null ? -1 : ids.indexOf(id);
  if (index === -1) return { index, previousId: null, nextId: null };
  return {
    index,
    previousId: ids[index - 1] ?? null,
    nextId: ids[index + 1] ?? null,
  };
};
