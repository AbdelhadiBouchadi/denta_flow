import type { StatusTone } from "@/components/shared/status-badge";
import { ActivityEntityType } from "./types";

/**
 * The only place French UI copy for this slice exists (06-ui.md §10). The
 * sentences of the timeline are not here: they are stored rows, built by
 * `summaries.ts` when the change is written.
 */

/** Rows per `getDay` page — «Afficher plus» loads the next one. */
export const ACTIVITY_PAGE_SIZE = 50;

/** The tint of each entity's icon — the badge palette of 06-ui.md §4. */
export const ACTIVITY_ENTITY_TONES: Record<ActivityEntityType, StatusTone> = {
  [ActivityEntityType.Appointment]: "info",
  [ActivityEntityType.Treatment]: "brand",
  [ActivityEntityType.Payment]: "success",
  [ActivityEntityType.Document]: "neutral",
};

/** Screen-reader name of each icon. */
export const ACTIVITY_ENTITY_LABELS: Record<ActivityEntityType, string> = {
  [ActivityEntityType.Appointment]: "Rendez-vous",
  [ActivityEntityType.Treatment]: "Acte",
  [ActivityEntityType.Payment]: "Paiement",
  [ActivityEntityType.Document]: "Document",
};

export const ACTIVITY_COPY = {
  pageTitle: "Activité du jour",
  pageDescription:
    "Ce qui a été enregistré au cabinet, jour par jour, et par qui.",
  allStaff: "Tous les utilisateurs",
  staffLabel: "Utilisateur",
  inactiveStaff: (name: string) => `${name} (inactif)`,
  today: "Aujourd’hui",
  previousWeek: "Semaine précédente",
  nextWeek: "Semaine suivante",
  pickDate: "Choisir une date",
  dayCount: (count: number) =>
    count === 0 ? "Aucune activité" : `${count} activité${count > 1 ? "s" : ""}`,
  by: "Par :",
  unknownStaff: "Utilisateur supprimé",
  openDossier: "Voir le dossier",
  showMore: "Afficher plus",
  loadingMore: "Chargement…",
  emptyTitle: "Aucune activité ce jour-là.",
  emptyDescription:
    "Les rendez-vous, actes et documents enregistrés ce jour-là apparaîtront ici.",
  loadingTitle: "Chargement de l’activité",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Impossible d’afficher l’activité",
  errorDescription:
    "Vérifiez la date choisie — un jour à venir n’a pas encore d’activité — puis réessayez.",
  backToToday: "Revenir à aujourd’hui",
  retry: "Réessayer",
} as const;

export const ACTIVITY_VALIDATION_MESSAGES = {
  invalidDate: "Choisissez une date valide.",
  futureDate: "Impossible d’afficher l’activité d’un jour à venir.",
  invalidCursor: "Pagination invalide. Rechargez la page.",
} as const;
