import { AppointmentStatus } from "@/modules/appointments/types";
import { PAYMENT_METHOD_LABELS } from "@/modules/payments/constants";
import { PaymentMethod } from "@/modules/payments/types";
import {
  Granularity,
  RevenueView,
  StatisticsPeriod,
  TopActesOrder,
} from "./types";

/**
 * The only place French copy for this slice exists (06-ui.md §10).
 *
 * ── Definitions (prompts/30, decision 6; mirrored in 08-clinical.md) ───────
 *
 * - «Encaissé»: SUM(payments.amountCents) by `paidAt`, every method — the
 *   SAME fragment as the dashboard and `payments.getSummary`
 *   (src/database/sql/receivables.ts).
 * - «Produit» (production): SUM(treatments.totalAmountCents) of the BILLABLE
 *   actes (`in_progress` / `completed`, src/database/sql/billable.ts), dated
 *   by the acte's clinical date — `performedAt`, else when it was recorded
 *   (src/database/sql/treatment-date.ts, the date `/actes` and the dossier
 *   list). A planned or canceled acte never produces.
 * - Encaissé and Produit are two different quantities: never summed, never
 *   stacked on one chart, always labelled.
 * - «Rendez-vous honorés»: status `completed`, `startsAt` in the period.
 * - «Taux d'absence»: no_show / (completed + no_show); «—» with no outcome.
 * - «Taux d'annulation»: canceled / every appointment of the period.
 * - «Nouveaux patients»: `patients.createdAt` in the period, archived
 *   included.
 * - «Patients actifs»: distinct patients with at least one `completed`
 *   appointment in the period.
 * - «Résultat (encaissé − charges)»: the dashboard's «Bénéfice net» rule
 *   (`netProfitCents`) — cash basis, and ABSENT (not zero) when the period
 *   has no charge.
 * - «Reste à encaisser» / «Avances»: balances as of now, the same SQL as the
 *   dashboard and `/paiements` — not bound to the period.
 * - «Répartition assurance»: patients (not archived) by their CURRENT
 *   insurer — people, not money.
 * - «Actes les plus réalisés»: billable actes grouped by their LABEL
 *   snapshot (`treatments.label`), the text the dossier shows.
 * - «Production par catégorie»: billable actes by their catalogue service's
 *   category (`services.category`, as the catalogue says NOW — an acte with
 *   no service counts as «Autre»).
 * - «Fréquentation»: `completed` appointments by clinic weekday and hour.
 * - «Par praticien»: completed appointments by `appointments.practitionerId`,
 *   production by `treatments.practitionerId`.
 */

// ── Period ──────────────────────────────────────────────────────────────────

/** The literal union the nuqs parser and the Zod enum accept. */
export const STATISTICS_PERIOD_VALUES = [
  StatisticsPeriod.ThisMonth,
  StatisticsPeriod.LastMonth,
  StatisticsPeriod.Last90Days,
  StatisticsPeriod.ThisYear,
  StatisticsPeriod.Last12Months,
  StatisticsPeriod.Custom,
] as const;

export const DEFAULT_STATISTICS_PERIOD = StatisticsPeriod.ThisMonth;

export const STATISTICS_PERIOD_LABELS: Record<StatisticsPeriod, string> = {
  [StatisticsPeriod.ThisMonth]: "Ce mois-ci",
  [StatisticsPeriod.LastMonth]: "Le mois dernier",
  [StatisticsPeriod.Last90Days]: "90 derniers jours",
  [StatisticsPeriod.ThisYear]: "Cette année",
  [StatisticsPeriod.Last12Months]: "12 derniers mois",
  [StatisticsPeriod.Custom]: "Personnalisée",
};

export const STATISTICS_PERIOD_OPTIONS = STATISTICS_PERIOD_VALUES.map(
  (value) => ({ value, label: STATISTICS_PERIOD_LABELS[value] }),
);

/** A custom range spans at most this many months. */
export const MAX_CUSTOM_RANGE_MONTHS = 24;

/** Granularity thresholds, in days (both included). */
export const MAX_DAY_BUCKET_DAYS = 31;
export const MAX_WEEK_BUCKET_DAYS = 120;

export const STATISTICS_PERIOD_ERRORS = {
  fromInvalid: "Choisissez une date de début valide",
  toInvalid: "Choisissez une date de fin valide",
  fromAfterTo: "La date de début doit précéder la date de fin",
  toInFuture: "La date de fin ne peut pas être dans le futur",
  tooLong: `La période ne peut pas dépasser ${MAX_CUSTOM_RANGE_MONTHS} mois`,
} as const;

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  [Granularity.Day]: "par jour",
  [Granularity.Week]: "par semaine",
  [Granularity.Month]: "par mois",
};

// ── Limits ──────────────────────────────────────────────────────────────────

/** A donut never shows more slices than this; the rest is «Autres». */
export const MAX_SLICES = 5;

/** The key the server folds the smallest slices into. */
export const OTHERS_KEY = "others";

/** The key of «Sans assurance» in the insurer breakdown. */
export const NO_INSURER_KEY = "none";

/** The key of an acte or appointment with no practitioner recorded. */
export const NO_PRACTITIONER_KEY = "none";

export const TOP_ACTES_LIMIT = 10;

// ── Series labels (legends and tooltips) ────────────────────────────────────

export const PAYMENT_METHOD_SERIES: readonly PaymentMethod[] = [
  PaymentMethod.Cash,
  PaymentMethod.Card,
  PaymentMethod.Check,
  PaymentMethod.Transfer,
  PaymentMethod.Insurance,
];

/** Reused from the payments slice: one label per method in the whole app. */
export const METHOD_LABELS = PAYMENT_METHOD_LABELS;

/** The four appointment outcomes the «Rendez-vous» chart stacks. */
export const APPOINTMENT_OUTCOME_LABELS = {
  completed: "Honorés",
  canceled: "Annulés",
  noShow: "Absents",
  upcoming: "À venir",
} as const;

/** «À venir» = still on the books: the dashboard's «restants». */
export const UPCOMING_STATUSES = [
  AppointmentStatus.Planned,
  AppointmentStatus.Confirmed,
  AppointmentStatus.Arrived,
] as const;

export const MONEY_SERIES_LABELS = {
  encaisse: "Encaissé",
  production: "Produit",
  charges: "Charges",
  resultat: "Résultat",
} as const;

export const REVENUE_VIEW_LABELS: Record<RevenueView, string> = {
  [RevenueView.ByMethod]: "Par mode de paiement",
  [RevenueView.CollectedVsProduced]: "Encaissé et produit",
};

export const REVENUE_VIEW_OPTIONS = [
  RevenueView.ByMethod,
  RevenueView.CollectedVsProduced,
].map((value) => ({ value, label: REVENUE_VIEW_LABELS[value] }));

export const TOP_ACTES_ORDER_LABELS: Record<TopActesOrder, string> = {
  [TopActesOrder.ByCount]: "Par nombre",
  [TopActesOrder.ByValue]: "Par valeur",
};

/** Lundi first (WEEK_STARTS_ON = 1), index 0 … 6. */
export const WEEKDAY_SHORT_LABELS = [
  "Lun",
  "Mar",
  "Mer",
  "Jeu",
  "Ven",
  "Sam",
  "Dim",
] as const;

export const WEEKDAY_LONG_LABELS = [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
  "dimanche",
] as const;

// ── Delta and formatting copy ───────────────────────────────────────────────

export const STATISTICS_DELTA_LABELS = {
  stable: "stable",
  new: "Nouveau",
  none: "—",
  pointsUnit: "pt",
  vsPrevious: "vs période précédente",
} as const;

/** The mask «Afficher les montants» replaces every amount with. */
export const AMOUNT_MASK = "•••• DH";

// ── Page copy ───────────────────────────────────────────────────────────────

export const STATISTICS_COPY = {
  pageTitle: "Statistiques",
  pageDescription: "Activité et finances du cabinet sur la période choisie.",
  periodLabel: "Période",
  from: "Du",
  to: "Au",
  showAmounts: "Afficher les montants",
  periodRange: (from: string, to: string) => `Du ${from} au ${to}`,
  previousRange: (from: string, to: string) => `Comparé au ${from} – ${to}`,
  invalidPeriodTitle: "Période invalide :",
  helpLabel: "Encaissé ou produit ?",
  helpText:
    "« Encaissé » : l’argent reçu sur la période (tous les paiements, assurance comprise). « Produit » : la valeur des actes réalisés ou en cours sur la période, payés ou non. Les deux ne s’additionnent jamais.",
  emptyTitle: "Aucune donnée",
  empty: "Aucune donnée sur cette période.",
  errorTitle: "Erreur de chargement",
  errorDescription: "Cette section n’a pas pu être chargée.",
  retry: "Réessayer",
  loading: "Chargement…",
  forbiddenTitle: "Action réservée à l’administrateur",
} as const;

export const KPI_LABELS = {
  encaisse: "Encaissé",
  encaisseCaption: "Paiements reçus, tous modes",
  production: "Produit",
  productionCaption: "Actes réalisés ou en cours",
  honores: "Rendez-vous honorés",
  honoresCaption: (active: number) =>
    `${active} ${active > 1 ? "patients actifs" : "patient actif"}`,
  nouveaux: "Nouveaux patients",
  nouveauxCaption: "Dossiers ouverts sur la période",
  absence: "Taux d’absence",
  absenceCaption: (cancellation: string) =>
    `Taux d’annulation : ${cancellation}`,
  resultat: "Résultat (encaissé − charges)",
  resultatCaption: (charges: string) => `Charges : ${charges}`,
  noCharges: "Aucune charge saisie sur la période",
  outstanding: "Reste à encaisser",
  advances: "Avances",
  balancesCaption: "Situation actuelle, quelle que soit la période",
} as const;

export const CHART_COPY = {
  revenueTitle: "Encaissements",
  revenueByMethod:
    "Encaissé par mode de paiement — les aires empilées forment le total encaissé.",
  revenueVsProduction:
    "Encaissé (paiements reçus) et produit (actes facturables), côte à côte — jamais additionnés.",
  revenueViewLabel: "Vue du graphique",
  appointmentsTitle: "Rendez-vous",
  appointmentsDescription:
    "Rendez-vous de la période selon leur issue, empilés.",
  methodsTitle: "Modes de paiement",
  methodsDescription: "Encaissé sur la période, par mode de paiement.",
  methodsTotal: "Encaissé",
  topActesTitle: "Actes les plus réalisés",
  topActesDescription: (order: string) =>
    `Les 10 premiers actes facturables, ${order.toLowerCase()} (production).`,
  topActesOrderLabel: "Classement",
  topActesCount: "Nombre",
  topActesValue: "Produit",
  categoriesTitle: "Production par catégorie d’acte",
  categoriesDescription:
    "Produit des actes facturables, par catégorie du catalogue.",
  categoriesTotal: "Produit",
  weekdayTitle: "Fréquentation par jour",
  weekdayDescription: "Rendez-vous honorés, par jour de la semaine.",
  heatmapTitle: "Fréquentation par heure",
  heatmapDescription:
    "Rendez-vous honorés, par jour et heure de début (heure du cabinet).",
  heatmapLegendLess: "Moins",
  heatmapLegendMore: "Plus",
  heatmapCell: (weekday: string, hour: number, count: number) =>
    // «rendez-vous» is invariable.
    `${weekday}, ${hour} h : ${count} rendez-vous`,
  honoredSeries: "Honorés",
  chargesTitle: "Encaissé et charges",
  chargesDescription:
    "Encaissé et charges par période (barres), résultat en ligne.",
  insurersTitle: "Patients par assurance",
  insurersDescription:
    "Patients actifs (non archivés) selon leur assurance actuelle.",
  insurersTotal: "Patients",
  practitionersTitle: "Par praticien",
  practitionersDescription:
    "Rendez-vous honorés et produit des actes, par praticien.",
  practitionersAppointments: "Honorés",
  practitionersProduction: "Produit",
  others: "Autres",
  noInsurer: "Sans assurance",
  noPractitioner: "Non attribué",
  otherCategory: "Autre",
  shareLabel: "part",
} as const;
