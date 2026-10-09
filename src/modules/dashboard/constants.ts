import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  ChartColumnIcon,
  CreditCardIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  SettingsIcon,
  StethoscopeIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";

import type { staffRole } from "@/database/schema";
import { DashboardPeriod, Greeting } from "./types";

/** Type-only: the union flows up from the pgEnum, nothing is hand-written. */
type StaffRole = (typeof staffRole.enumValues)[number];

export interface DashboardNavItem {
  /** French route segment — AGENTS.md §5. */
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Cosmetic only. Hiding the link is a courtesy, never a control: the
   * procedures behind /charges and /statistiques are `adminProcedure` and
   * reject a non-admin regardless of what the sidebar shows (AGENTS.md §2).
   */
  adminOnly?: boolean;
}

/** Order is the one fixed by prompts/09-shell.md and is not alphabetical. */
export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  {
    href: "/tableau-de-bord",
    label: "Tableau de bord",
    icon: LayoutDashboardIcon,
  },
  { href: "/patients", label: "Patients", icon: UsersIcon },
  { href: "/calendrier", label: "Calendrier", icon: CalendarDaysIcon },
  { href: "/rendez-vous", label: "Rendez-vous", icon: CalendarClockIcon },
  { href: "/actes", label: "Actes", icon: StethoscopeIcon },
  { href: "/paiements", label: "Paiements", icon: CreditCardIcon },
  { href: "/documents", label: "Documents", icon: FileTextIcon },
  { href: "/activite", label: "Activité du jour", icon: ActivityIcon },
  { href: "/taches", label: "Liste des tâches", icon: ListChecksIcon },
  { href: "/charges", label: "Charges", icon: WalletIcon, adminOnly: true },
  {
    href: "/statistiques",
    label: "Statistiques",
    icon: ChartColumnIcon,
    adminOnly: true,
  },
  { href: "/parametres", label: "Paramètres", icon: SettingsIcon },
] as const;

/**
 * Enum copy, never inlined in a component (06-ui.md §10). Lives here until the
 * `staff` slice lands and takes ownership of everything role-related.
 */
export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Administrateur",
  dentist: "Dentiste",
  assistant: "Assistant(e)",
  secretary: "Secrétaire",
};

export const ADMIN_ROLE: StaffRole = "admin";

/** Fallback shown while the session is still loading or the name is missing. */
export const UNKNOWN_STAFF_NAME = "Membre du cabinet";

// ── Tableau de bord ─────────────────────────────────────────────────────────
//
// The definitions behind every figure (prompts/22, decision 3; the predicates
// themselves live in `rules.ts` and `server/today.ts`):
//
// - «Rendez-vous du jour»: `startsAt` in today's clinic range, `canceled`
//   excluded; `no_show` and `completed` count — they happened today.
// - «Restants»: status `planned`, `confirmed` or `arrived`, whatever the
//   clock says. One more than 15 minutes past its start reads «En retard»
//   (informational — it changes no count).
// - «Salle d'attente»: status `arrived` AND `startsAt` in today's range.
// - «Revenu d'aujourd'hui»: SUM(payments.amountCents) with `paidAt` in
//   today's range, every method — insurance reimbursements and advances are
//   cash received. Admin only.
// - «Soldes à recouvrer»: the 5 patients with the largest positive
//   `remainingCents` (the shared billable rule), archived ones included.
// - «Reste à encaisser» / «Avances»: the same SQL as `payments.getSummary`,
//   balances as of now — independent of the period.
//
// - «Charges»: SUM(expenses.amountCents) with `spentAt` in the period — the
//   same fragment as `expenses.getSummary` (src/database/sql/expenses.ts).
// - «Bénéfice net»: revenue − charges over the same period; «Aucune charge
//   saisie» instead when the period has no charge (prompts/26, decision 5).
//
// No activity feed: it would print payment amounts to staff who must not see
// revenue.

/** The literal union the nuqs parser and the Zod enum accept. */
export const DASHBOARD_PERIOD_VALUES = [
  DashboardPeriod.Today,
  DashboardPeriod.Week,
  DashboardPeriod.Month,
  DashboardPeriod.LastMonth,
  DashboardPeriod.Year,
] as const;

export const DEFAULT_DASHBOARD_PERIOD = DashboardPeriod.Month;

export const DASHBOARD_PERIOD_LABELS: Record<DashboardPeriod, string> = {
  [DashboardPeriod.Today]: "Aujourd’hui",
  [DashboardPeriod.Week]: "Cette semaine",
  [DashboardPeriod.Month]: "Ce mois-ci",
  [DashboardPeriod.LastMonth]: "Le mois dernier",
  [DashboardPeriod.Year]: "Cette année",
};

export const DASHBOARD_PERIOD_OPTIONS = DASHBOARD_PERIOD_VALUES.map(
  (value) => ({ value, label: DASHBOARD_PERIOD_LABELS[value] }),
);

export const GREETING_LABELS: Record<Greeting, string> = {
  [Greeting.Morning]: "Bonjour",
  [Greeting.Afternoon]: "Bon après-midi",
  [Greeting.Evening]: "Bonsoir",
};

/** «Bonjour, Salma Berrada» — a bare greeting when the name is empty. */
export const greetingLine = (greeting: Greeting, name: string) => {
  const trimmed = name.trim();
  return trimmed
    ? `${GREETING_LABELS[greeting]}, ${trimmed}`
    : GREETING_LABELS[greeting];
};

/**
 * The banner's subtitle, from the server's counts. «rendez-vous» is
 * invariable; «honoré» agrees. `remaining` can never exceed `total` (the
 * restants are a subset of the day), but the sentence is still guarded so an
 * inconsistent pair never prints «3 sur 2».
 */
export const todaySummary = ({
  total,
  remaining,
  completed,
}: {
  total: number;
  remaining: number;
  completed: number;
}) => {
  if (total <= 0) return "Aucun rendez-vous aujourd’hui.";
  if (remaining > 0) {
    return `Il vous reste ${Math.min(remaining, total)} rendez-vous sur ${total} aujourd’hui.`;
  }
  if (completed <= 0)
    return "La journée est terminée : aucun rendez-vous honoré.";
  return `La journée est terminée : ${completed} rendez-vous ${completed === 1 ? "honoré" : "honorés"}.`;
};

/** «dont 3 restants» under the day's total. */
export const remainingHint = (remaining: number) =>
  remaining <= 0
    ? "aucun restant"
    : `dont ${remaining} ${remaining === 1 ? "restant" : "restants"}`;

/** «2 patients» in the waiting-room card. */
export const waitingHint = (count: number) =>
  count === 0
    ? "Personne en attente"
    : `${count} ${count === 1 ? "patient arrivé" : "patients arrivés"}`;

/** «12 paiements» under the period's revenue. */
export const paymentCountHint = (count: number) =>
  count === 0
    ? "Aucun paiement"
    : `${count} ${count === 1 ? "paiement" : "paiements"}`;

/** «4 charges» under the period's charges. */
export const expenseCountHint = (count: number) =>
  count === 0
    ? "Aucune charge"
    : `${count} ${count === 1 ? "charge" : "charges"}`;

/** «30 min» — the appointment's length, already computed by the server. */
export const durationLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${hours} h`
    : `${hours} h ${String(rest).padStart(2, "0")}`;
};

export const DASHBOARD_COPY = {
  pageTitle: "Tableau de bord",
  todayTotal: "Rendez-vous aujourd’hui",
  waitingRoom: "Salle d’attente",
  todayRevenue: "Revenu d’aujourd’hui",
  todayRevenueHint: "Tous modes de paiement",
  agendaTitle: "Rendez-vous d’aujourd’hui",
  agendaEmpty: "Aucun rendez-vous aujourd’hui.",
  agendaEmptyHint: "Les rendez-vous pris pour aujourd’hui apparaîtront ici.",
  agendaLink: "Ouvrir le calendrier",
  late: "En retard",
  noType: "Sans type",
  noPractitioner: "Non attribué",
  statusMenu: "Changer le statut",
  markArrived: "Arrivé",
  debtorsTitle: "Soldes à recouvrer",
  debtorsDescription:
    "Les cinq plus gros soldes impayés, patients archivés compris.",
  debtorsEmpty: "Aucun solde impayé.",
  debtorsEmptyHint: "Tous les patients sont à jour de leurs paiements.",
  archived: "Archivé",
  financeTitle: "Encaissements",
  periodLabel: "Période",
  periodRevenue: "Revenu de la période",
  outstanding: "Reste à encaisser",
  advances: "Avances",
  charges: "Charges",
  net: "Bénéfice net",
  netHint: "Revenu de la période moins ses charges",
  noCharges: "Aucune charge saisie",
  noChargesHint: "Saisissez les charges de la période pour obtenir le net.",
  chargesLink: "Voir les charges",
  balancesCaption: "Reste à encaisser et avances : situation actuelle",
  loadingTitle: "Chargement du tableau de bord",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "Le tableau de bord n’a pas pu être chargé. Vérifiez votre connexion, puis réessayez.",
  retry: "Réessayer",
} as const;
