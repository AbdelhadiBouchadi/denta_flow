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
