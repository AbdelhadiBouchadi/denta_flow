import {
  AccessibilityIcon,
  BabyIcon,
  BellIcon,
  BriefcaseMedicalIcon,
  ClockAlertIcon,
  ClockIcon,
  CrownIcon,
  FlagIcon,
  HandHeartIcon,
  HeartIcon,
  HeartPulseIcon,
  PhoneIcon,
  PillIcon,
  RepeatIcon,
  ShieldIcon,
  SirenIcon,
  SmileIcon,
  SparklesIcon,
  StarIcon,
  StethoscopeIcon,
  SyringeIcon,
  TriangleAlertIcon,
  UserRoundIcon,
  UsersIcon,
  WalletIcon,
  type LucideIcon,
} from "lucide-react";

/**
 * The only place French copy exists for this slice (06-ui.md §10).
 */

// ── Icons ───────────────────────────────────────────────────────────────────

/**
 * The curated icons a tag may carry, by the lucide name stored in `tags.icon`.
 * A static map on purpose: `import * as icons` or a dynamic lookup would pull
 * the whole lucide set into the bundle. The Zod schema accepts only these keys.
 * The seed's names (siren, heart-pulse, clock-alert, repeat, crown, users,
 * sparkles) are all here.
 */
export const TAG_ICON_NAMES = [
  "triangle-alert",
  "siren",
  "star",
  "heart",
  "heart-pulse",
  "baby",
  "users",
  "user-round",
  "crown",
  "phone",
  "clock",
  "clock-alert",
  "repeat",
  "shield",
  "stethoscope",
  "pill",
  "syringe",
  "accessibility",
  "hand-heart",
  "smile",
  "sparkles",
  "bell",
  "flag",
  "wallet",
  "briefcase-medical",
] as const;

export type TagIconName = (typeof TAG_ICON_NAMES)[number];

export const TAG_ICONS: Record<TagIconName, LucideIcon> = {
  "triangle-alert": TriangleAlertIcon,
  siren: SirenIcon,
  star: StarIcon,
  heart: HeartIcon,
  "heart-pulse": HeartPulseIcon,
  baby: BabyIcon,
  users: UsersIcon,
  "user-round": UserRoundIcon,
  crown: CrownIcon,
  phone: PhoneIcon,
  clock: ClockIcon,
  "clock-alert": ClockAlertIcon,
  repeat: RepeatIcon,
  shield: ShieldIcon,
  stethoscope: StethoscopeIcon,
  pill: PillIcon,
  syringe: SyringeIcon,
  accessibility: AccessibilityIcon,
  "hand-heart": HandHeartIcon,
  smile: SmileIcon,
  sparkles: SparklesIcon,
  bell: BellIcon,
  flag: FlagIcon,
  wallet: WalletIcon,
  "briefcase-medical": BriefcaseMedicalIcon,
};

/** Accessible names for the icon picker's buttons. */
export const TAG_ICON_LABELS: Record<TagIconName, string> = {
  "triangle-alert": "Alerte",
  siren: "Urgence",
  star: "Étoile",
  heart: "Cœur",
  "heart-pulse": "Santé fragile",
  baby: "Enfant",
  users: "Famille",
  "user-round": "Personne",
  crown: "VIP",
  phone: "Téléphone",
  clock: "Horloge",
  "clock-alert": "Retard",
  repeat: "Régulier",
  shield: "Protection",
  stethoscope: "Médical",
  pill: "Traitement",
  syringe: "Injection",
  accessibility: "Mobilité réduite",
  "hand-heart": "Attention particulière",
  smile: "Sourire",
  sparkles: "Nouveau",
  bell: "Rappel",
  flag: "Signalement",
  wallet: "Paiement",
  "briefcase-medical": "Soins",
};

const isTagIconName = (name: string): name is TagIconName =>
  Object.hasOwn(TAG_ICONS, name);

/** An unknown or empty stored name renders no icon, never an error. */
export const getTagIcon = (
  name: string | null | undefined,
): LucideIcon | null => (name && isTagIconName(name) ? TAG_ICONS[name] : null);

// ── Copy ────────────────────────────────────────────────────────────────────

export const TAG_FIELD_LABELS = {
  label: "Libellé",
  color: "Couleur",
  icon: "Icône",
  preview: "Aperçu",
} as const;

export const TAG_FIELD_PLACEHOLDERS = {
  label: "ex. Urgent, VIP, Famille",
} as const;

/** Zod messages — rendered verbatim by <FieldError />. */
export const TAG_VALIDATION_MESSAGES = {
  labelRequired: "Le libellé est obligatoire",
  labelTooLong: "Le libellé est trop long",
  colorInvalid: "Choisissez une couleur de la palette",
  iconInvalid: "Choisissez une icône de la liste",
} as const;

/** `TRPCError` messages thrown by `tags.*`. */
export const TAG_SERVER_ERRORS = {
  notFound: "Tag introuvable.",
  duplicateLabel: "Un tag porte déjà ce libellé.",
} as const;

export const TAG_COPY = {
  sectionTitle: "Tags",
  sectionDescription:
    "Les étiquettes qui signalent un patient d’un coup d’œil : urgence, famille, VIP…",
  add: "Ajouter",
  adminOnly: "Seul un administrateur peut modifier ces réglages.",
  actionsLabel: "Actions sur le tag",

  newTitle: "Nouveau tag",
  newDescription:
    "Choisissez un libellé, une couleur et, si besoin, une icône.",
  editTitle: "Modifier le tag",
  editDescription:
    "Le changement s’applique à tous les patients qui portent ce tag.",
  noIcon: "Aucune",
  previewFallback: "Libellé",

  edit: "Modifier",
  remove: "Supprimer",
  cancel: "Annuler",
  save: "Enregistrer",
  saving: "Enregistrement…",
  update: "Mettre à jour",
  updating: "Mise à jour…",

  created: "Tag créé",
  updated: "Tag mis à jour",
  removed: "Tag supprimé",

  removeConfirmTitle: "Supprimer ce tag ?",

  emptyTitle: "Aucun tag pour le moment.",
  emptyDescription:
    "Créez des tags pour repérer rapidement certains patients dans la liste.",
  loadingTitle: "Chargement des tags",
  loadingDescription: "Merci de patienter quelques instants…",
  errorTitle: "Erreur de chargement",
  errorDescription:
    "La liste des tags n’a pas pu être chargée. Veuillez réessayer.",
} as const;

export const TAG_COLUMN_HEADERS = {
  tag: "Tag",
  patientCount: "Patients",
  actions: "Actions",
} as const;

/** «1 patient», «0 patient», «3 patients» — French singular below 2. */
export const formatPatientCount = (count: number) =>
  `${count} patient${count >= 2 ? "s" : ""}`;

/**
 * The delete confirmation names the real cascade: `patient_tags` rows go with
 * the tag (01-database.md), so the count is what the receptionist weighs.
 */
export const tagRemoveConfirmDescription = (label: string, count: number) =>
  count === 0
    ? `Supprimer le tag « ${label} » ? Aucun patient ne le porte.`
    : `Supprimer le tag « ${label} » ? Il sera retiré de ${formatPatientCount(count)}.`;
