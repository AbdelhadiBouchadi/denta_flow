// src/database/seed.ts
// The ONLY sanctioned fake data in this project. Every name below is invented.
//
// Idempotent:
//  - `user` rows are upserted on fixed ids ("seed-admin", …) — never truncated, so an
//    existing session or credential row is never orphaned.
//  - every other seeded table is truncated and re-inserted.
// Both happen in a single `db.batch` (one Neon HTTP transaction): a failed run
// leaves the previous data untouched.
//
// Dates are generated relative to "today" in the clinic timezone, so the agenda
// always has past and upcoming appointments around the day the seed is run.
import "dotenv/config";

import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  differenceInYears,
  format,
  parseISO,
  startOfMonth,
} from "date-fns";
import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { nanoid } from "nanoid";

import { CLINIC_TIMEZONE } from "../constants";
import { db } from "./index";
import {
  activityLog,
  appointments,
  appointmentTypes,
  clinicSettings,
  documents,
  expenses,
  insurers,
  medicalHistories,
  odontogramCharts,
  patients,
  patientTags,
  payments,
  practitionerSchedules,
  scheduleExceptions,
  services,
  tags,
  tasks,
  treatments,
  user,
} from "./schema";

// ── Deterministic randomness ────────────────────────────────────────────────
// Same seed ⇒ same patients, same clinical history; only the dates slide with "today".
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260919);
const int = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)];
const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join("");
function weighted<T>(entries: readonly (readonly [T, number])[]): T {
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r < 0) return value;
  }
  return entries[entries.length - 1][0];
}
function shuffle<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}
/** Round centimes down to a whole multiple of `stepDH` dirhams. */
const roundDH = (cents: number, stepDH: number) => Math.floor(cents / (stepDH * 100)) * stepDH * 100;

// ── Clinic time ─────────────────────────────────────────────────────────────
const now = new Date();
const today = TZDate.tz(CLINIC_TIMEZONE);
today.setHours(0, 0, 0, 0);

/** An instant at wall-clock `hh:mm` on `day`, resolved in the clinic timezone. */
function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const local = new TZDate(day.getFullYear(), day.getMonth(), day.getDate(), h, m, CLINIC_TIMEZONE);
  return new Date(local.getTime());
}
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
const hhmmOf = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const isoWeekday = (day: Date) => (day.getDay() === 0 ? 7 : day.getDay());
const dayKey = (day: Date) => format(day, "yyyy-MM-dd");
/** A clinic day `offset` days from today (TZDate — getters read clinic-local). */
const clinicDay = (offset: number) => addDays(today, offset);
/**
 * A random instant inside the working hours of a clinic day. Sunday is closed, so a
 * Sunday date is moved back to the Saturday — never dated on a day the clinic is shut.
 */
function workingInstant(day: Date): Date {
  const openDay = isoWeekday(day) === 7 ? addDays(day, -1) : day;
  const sessions = SESSIONS[isoWeekday(openDay)];
  const [start, end] = pick(sessions);
  const minute = int(minutesOf(start), minutesOf(end) - 15);
  return at(openDay, hhmmOf(minute - (minute % 5)));
}
/** Clamp a generated instant so money and history never land in the future. */
const notAfterNow = (instant: Date) => (instant > now ? new Date(now.getTime() - 60_000) : instant);

// ISO weekday → working sessions. Sunday (7) is closed.
const WEEKDAY_SESSIONS: [string, string][] = [
  ["09:00", "12:30"],
  ["14:30", "18:30"],
];
const SESSIONS: Record<number, [string, string][]> = {
  1: WEEKDAY_SESSIONS,
  2: WEEKDAY_SESSIONS,
  3: WEEKDAY_SESSIONS,
  4: WEEKDAY_SESSIONS,
  5: WEEKDAY_SESSIONS,
  6: [["09:00", "13:00"]],
};

// ── Staff (upserted on fixed ids) ───────────────────────────────────────────
const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
if (!adminEmail) {
  throw new Error("BOOTSTRAP_ADMIN_EMAIL must be set: the seeded admin uses it as their email.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Refusing to seed with NODE_ENV=production: the seed truncates clinical tables.");
}

type NewUser = typeof user.$inferInsert;
const STAFF = {
  admin: {
    id: "seed-admin",
    name: "Youssef Amrani",
    email: adminEmail,
    emailVerified: true,
    role: "admin",
    title: "Chirurgien-Dentiste",
    inpe: "093412587",
    color: "#0D9488",
  },
  dentist: {
    id: "seed-dentist",
    name: "Salma Berrada",
    email: "salma.berrada@example.com",
    emailVerified: true,
    role: "dentist",
    title: "Chirurgien-Dentiste",
    inpe: "093518264",
    color: "#2563EB",
  },
  assistant: {
    id: "seed-assistant",
    name: "Khadija Ait Baha",
    email: "khadija.aitbaha@example.com",
    emailVerified: true,
    role: "assistant",
    title: "Assistante dentaire",
    color: "#D97706",
  },
  secretary: {
    id: "seed-secretary",
    name: "Hanane Oubella",
    email: "hanane.oubella@example.com",
    emailVerified: true,
    role: "secretary",
    title: "Secrétaire médicale",
    color: "#7C3AED",
  },
} satisfies Record<string, NewUser & { id: string }>;

// ── Reference data ──────────────────────────────────────────────────────────
const INSURER_NAMES = ["CNSS", "CNOPS", "SANLAM", "RMA", "AXA Assurance"] as const;

const TAG_DEFS = [
  { label: "Urgent", color: "#DC2626", icon: "siren" },
  { label: "Sensible", color: "#DB2777", icon: "heart-pulse" },
  { label: "Retardataire", color: "#D97706", icon: "clock-alert" },
  { label: "Régulier", color: "#16A34A", icon: "repeat" },
  { label: "VIP", color: "#CA8A04", icon: "crown" },
  { label: "Famille", color: "#2563EB", icon: "users" },
  { label: "Nouveau", color: "#0D9488", icon: "sparkles" },
] as const;

// teeth: how the FDI codes of an acte are chosen.
type TeethMode = "none" | "one" | "wisdom" | "bridge" | "anterior";
type ServiceDef = {
  label: string;
  category: (typeof services.$inferInsert)["category"] & string;
  priceCents: number;
  duration: number;
  teeth: TeethMode;
  child?: boolean; // suitable for a child patient (adult-eligible unless childOnly)
  childOnly?: boolean;
};
const SERVICE_DEFS: ServiceDef[] = [
  { label: "Consultation", category: "consultation", priceCents: 15000, duration: 30, teeth: "none", child: true },
  { label: "Consultation d’urgence", category: "consultation", priceCents: 20000, duration: 30, teeth: "none", child: true },
  { label: "Radiographie rétro-alvéolaire", category: "consultation", priceCents: 10000, duration: 15, teeth: "one", child: true },
  { label: "Radiographie panoramique", category: "consultation", priceCents: 30000, duration: 15, teeth: "none" },
  { label: "Détartrage", category: "periodontics", priceCents: 30000, duration: 45, teeth: "none", child: true },
  { label: "Surfaçage radiculaire (par quadrant)", category: "periodontics", priceCents: 60000, duration: 60, teeth: "none" },
  { label: "Composite 1 face", category: "restorative", priceCents: 25000, duration: 30, teeth: "one", child: true },
  { label: "Composite 2 faces", category: "restorative", priceCents: 35000, duration: 45, teeth: "one", child: true },
  { label: "Composite 3 faces", category: "restorative", priceCents: 45000, duration: 45, teeth: "one" },
  { label: "Amalgame", category: "restorative", priceCents: 20000, duration: 30, teeth: "one" },
  { label: "Traitement de racine monoradiculaire", category: "endodontics", priceCents: 60000, duration: 60, teeth: "one" },
  { label: "Traitement de racine biradiculaire", category: "endodontics", priceCents: 80000, duration: 75, teeth: "one" },
  { label: "Traitement de racine pluriradiculaire", category: "endodontics", priceCents: 100000, duration: 90, teeth: "one" },
  { label: "Pulpotomie (dent temporaire)", category: "endodontics", priceCents: 30000, duration: 30, teeth: "one", child: true, childOnly: true },
  { label: "Inlay-core", category: "prosthetics", priceCents: 80000, duration: 45, teeth: "one" },
  { label: "Couronne céramo-métallique", category: "prosthetics", priceCents: 180000, duration: 60, teeth: "one" },
  { label: "Couronne zircone", category: "prosthetics", priceCents: 300000, duration: 60, teeth: "one" },
  { label: "Bridge 3 éléments céramo-métallique", category: "prosthetics", priceCents: 540000, duration: 90, teeth: "bridge" },
  { label: "Prothèse amovible partielle résine", category: "prosthetics", priceCents: 250000, duration: 45, teeth: "none" },
  { label: "Prothèse complète (par arcade)", category: "prosthetics", priceCents: 450000, duration: 60, teeth: "none" },
  { label: "Extraction simple", category: "surgery", priceCents: 20000, duration: 30, teeth: "one", child: true },
  { label: "Extraction dent de sagesse", category: "surgery", priceCents: 60000, duration: 45, teeth: "wisdom" },
  { label: "Extraction dent de sagesse incluse", category: "surgery", priceCents: 120000, duration: 90, teeth: "wisdom" },
  { label: "Pose d’implant dentaire", category: "implantology", priceCents: 800000, duration: 90, teeth: "one" },
  { label: "Couronne sur implant", category: "implantology", priceCents: 350000, duration: 60, teeth: "one" },
  { label: "Bilan orthodontique", category: "orthodontics", priceCents: 40000, duration: 45, teeth: "none", child: true },
  { label: "Traitement orthodontique multi-attaches (par semestre)", category: "orthodontics", priceCents: 600000, duration: 60, teeth: "none" },
  { label: "Gouttière de contention", category: "orthodontics", priceCents: 150000, duration: 30, teeth: "none" },
  { label: "Blanchiment dentaire", category: "cosmetic", priceCents: 250000, duration: 60, teeth: "none" },
  { label: "Facette céramique", category: "cosmetic", priceCents: 350000, duration: 60, teeth: "anterior" },
  { label: "Gouttière de bruxisme", category: "other", priceCents: 120000, duration: 30, teeth: "none" },
];
// How often each category is performed — consultations and fillings dominate a real day.
const CATEGORY_WEIGHT: Record<ServiceDef["category"], number> = {
  consultation: 8,
  periodontics: 5,
  restorative: 9,
  endodontics: 5,
  prosthetics: 3,
  surgery: 4,
  implantology: 1,
  orthodontics: 1.5,
  cosmetic: 1,
  other: 1,
};

const APPOINTMENT_TYPE_DEFS = [
  { label: "Consultation Initiale", color: "#0D9488", duration: 30, weight: 5,
    reasons: ["Premier examen", "Bilan bucco-dentaire", "Douleur dentaire", "Contrôle annuel"] },
  { label: "Consultation de Retour", color: "#0891B2", duration: 15, weight: 5,
    reasons: ["Contrôle post-opératoire", "Suivi de traitement", "Contrôle cicatrisation"] },
  { label: "Détartrage", color: "#16A34A", duration: 45, weight: 4,
    reasons: ["Détartrage et polissage", "Saignement des gencives"] },
  { label: "Soin", color: "#2563EB", duration: 45, weight: 7,
    reasons: ["Carie molaire", "Obturation composite", "Traitement de racine — séance", "Sensibilité au froid"] },
  { label: "Extraction", color: "#DC2626", duration: 30, weight: 2,
    reasons: ["Extraction dent délabrée", "Extraction dent de lait", "Dent mobile"] },
  { label: "Chirurgie", color: "#9333EA", duration: 90, weight: 1,
    reasons: ["Dent de sagesse incluse", "Pose d’implant", "Élévation sinusienne"] },
  { label: "Prothèse", color: "#D97706", duration: 60, weight: 2,
    reasons: ["Empreinte couronne", "Essayage prothèse", "Pose couronne", "Scellement bridge"] },
  { label: "Orthodontie", color: "#DB2777", duration: 30, weight: 1,
    reasons: ["Activation appareil", "Pose des attaches", "Contrôle orthodontique"] },
] as const;

// ── Names & addresses (invented) ────────────────────────────────────────────
const MALE_FIRST = [
  "Youssef", "Mohamed", "Ahmed", "Omar", "Hamza", "Mehdi", "Karim", "Rachid", "Hassan", "Brahim",
  "Lahcen", "Mustapha", "Abdellah", "Said", "Anas", "Ayoub", "Ilyas", "Zakaria", "Soufiane", "Adil",
  "Hicham", "Driss", "Jamal", "Nabil",
];
const FEMALE_FIRST = [
  "Fatima Zahra", "Khadija", "Salma", "Meryem", "Imane", "Hajar", "Sanaa", "Nadia", "Latifa", "Zineb",
  "Asmae", "Houda", "Siham", "Loubna", "Ghizlane", "Kawtar", "Aicha", "Rachida", "Samira", "Hanane",
  "Oumaima", "Douae", "Yasmine", "Malika",
];
const LAST_NAMES = [
  "Alaoui", "Benali", "El Idrissi", "Bennani", "Tazi", "Chraibi", "El Fassi", "Ouazzani", "Lahlou",
  "Benkirane", "Ait Lhaj", "Id Bella", "Boutaleb", "Bouzid", "El Ouardi", "Amzil", "Oukacha", "Belhaj",
  "Hmidouch", "Ait Ouahmane", "Ezzahiri", "Rhouni", "Sebti", "Kettani", "Marzouki", "Najjar", "Filali",
  "Cherkaoui", "Ouhammou", "Aboulfath", "Afkir", "Boukhris", "Nait Brahim", "El Mansouri", "Aglou",
  "Ait Taleb", "Bouhlal", "Essaadi",
];
const QUARTIERS = [
  "Talborjt", "Dakhla", "Hay Mohammadi", "Les Amicales", "Founty", "Charaf", "Salam", "Tilila",
  "Anza", "Bensergao", "Hay Al Houda", "Nouveau Talborjt",
];
const STREETS = ["Rue", "Avenue", "Boulevard", "Impasse"];
const CITIES = [
  ["Agadir", 14], ["Inezgane", 3], ["Aït Melloul", 2], ["Dcheira El Jihadia", 1], ["Taghazout", 1],
] as const;
const ALLERGIES = [
  "Pénicilline", "Latex", "Aspirine", "Iode", "Amoxicilline", "Ibuprofène (AINS)",
];
const MEDICAL_NOTES = [
  "Diabète de type 2, sous metformine.",
  "Hypertension artérielle traitée.",
  "Sous anticoagulant (acénocoumarol) — demander un INR récent avant tout acte chirurgical.",
  "Asthme, porte un inhalateur.",
  "Cardiopathie valvulaire — antibioprophylaxie avant acte sanglant.",
  "Grossesse en cours — éviter les radiographies.",
  "Anxiété importante lors des soins, prévoir des séances courtes.",
  "Hypothyroïdie traitée.",
];

// ── Dossier médical ─────────────────────────────────────────────────────────
type NewMedicalHistory = typeof medicalHistories.$inferInsert;
type HistoryFacts = Partial<Omit<NewMedicalHistory, "patientId">>;

/**
 * What each free-text note already says, carried into the structured history
 * so the two never contradict each other on the same dossier.
 */
const NOTE_FACTS: Record<string, HistoryFacts> = {
  "Diabète de type 2, sous metformine.": {
    conditions: ["diabetes"],
    currentMedications: "Metformine 850 mg, 2 fois par jour",
  },
  "Hypertension artérielle traitée.": {
    conditions: ["hypertension"],
    currentMedications: "Amlodipine 5 mg, 1 fois par jour",
  },
  "Sous anticoagulant (acénocoumarol) — demander un INR récent avant tout acte chirurgical.": {
    conditions: ["heart_disease"],
    onAnticoagulants: true,
    currentMedications: "Acénocoumarol (Sintrom) 4 mg, dose adaptée à l’INR",
  },
  "Asthme, porte un inhalateur.": {
    conditions: ["asthma"],
    currentMedications: "Salbutamol en inhalation, à la demande",
  },
  "Cardiopathie valvulaire — antibioprophylaxie avant acte sanglant.": {
    conditions: ["heart_disease"],
    needsAntibioticProphylaxis: true,
  },
  // Pregnancy is applied separately — only to a woman of the right age.
  "Grossesse en cours — éviter les radiographies.": {},
  "Anxiété importante lors des soins, prévoir des séances courtes.": {},
  "Hypothyroïdie traitée.": {
    conditions: ["thyroid"],
    currentMedications: "Lévothyroxine 75 µg, le matin à jeun",
  },
};

/** Background conditions drawn at random — the critical flags are placed on purpose. */
const BACKGROUND_CONDITIONS = [
  "diabetes", "hypertension", "asthma", "thyroid", "kidney_disease", "epilepsy", "hepatitis",
] as const;
const PROFESSIONS = [
  "Enseignant(e)", "Commerçant(e)", "Fonctionnaire", "Infirmier(ère)", "Agriculteur(trice)",
  "Ingénieur(e)", "Étudiant(e)", "Chauffeur", "Artisan", "Retraité(e)", "Sans profession",
  "Comptable", "Pêcheur", "Employé(e) de banque", "Guide touristique",
];
const SURGERIES = [
  "Appendicectomie.", "Césarienne.", "Cholécystectomie.", "Amygdalectomie dans l’enfance.",
  "Fracture du poignet opérée.", "Hospitalisation pour pneumopathie.",
];
const ADULT_RELATIONS = ["Conjoint(e)", "Fils", "Fille", "Frère", "Sœur", "Mère", "Père"];
const BLOOD_TYPES = [
  ["o_pos", 40], ["a_pos", 30], ["b_pos", 12], ["ab_pos", 4],
  ["o_neg", 6], ["a_neg", 5], ["b_neg", 2], ["ab_neg", 1],
] as const;

// FDI codes (see docs/architecture/08-clinical.md §1).
const quadrant = (q: number, n: number) => Array.from({ length: n }, (_, i) => `${q}${i + 1}`);
const ADULT_TEETH = [...quadrant(1, 8), ...quadrant(2, 8), ...quadrant(3, 8), ...quadrant(4, 8)];
const CHILD_TEETH = [...quadrant(5, 5), ...quadrant(6, 5), ...quadrant(7, 5), ...quadrant(8, 5)];
function teethFor(mode: TeethMode, isChild: boolean): string[] {
  switch (mode) {
    case "none":
      return [];
    case "one":
      return [pick(isChild ? CHILD_TEETH : ADULT_TEETH.filter((t) => !t.endsWith("8")))];
    case "wisdom":
      return [pick(["18", "28", "38", "48"])];
    case "anterior":
      return [pick(["11", "12", "13", "21", "22", "23"])];
    case "bridge": {
      const q = int(1, 4);
      const center = int(4, 6);
      return [`${q}${center - 1}`, `${q}${center}`, `${q}${center + 1}`];
    }
  }
}

const SHORT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const shortCodes = new Set<string>();
function shortCode(): string {
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => pick([...SHORT_CODE_ALPHABET])).join("");
  } while (shortCodes.has(code));
  shortCodes.add(code);
  return code;
}
const mobile = () => `+212${pick(["6", "7"])}${digits(8)}`;
const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, "");

// Moroccan public holidays (fixed dates). The clinic-wide closure is the one nearest to today,
// so it always lands inside the ±3-month appointment window.
const HOLIDAYS = [
  ["01-01", "Nouvel An"],
  ["01-11", "Manifeste de l’Indépendance"],
  ["01-14", "Nouvel An amazigh"],
  ["05-01", "Fête du Travail"],
  ["07-30", "Fête du Trône"],
  ["08-14", "Allégeance Oued Eddahab"],
  ["08-20", "Révolution du Roi et du Peuple"],
  ["08-21", "Fête de la Jeunesse"],
  ["11-06", "Marche Verte"],
  ["11-18", "Fête de l’Indépendance"],
] as const;

// ── Build ───────────────────────────────────────────────────────────────────
type NewPatient = typeof patients.$inferInsert & { id: string };
type NewAppointment = typeof appointments.$inferInsert & { id: string; startsAt: Date; endsAt: Date };
type NewTreatment = typeof treatments.$inferInsert & { id: string; totalAmountCents: number };
type NewPayment = typeof payments.$inferInsert;

async function main() {
  // A staff row created earlier with the bootstrap email (e.g. by bootstrap:admin) keeps its id,
  // so the email unique constraint never fires and no session is orphaned.
  const [existingAdmin] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, STAFF.admin.email));
  const adminId = existingAdmin?.id ?? STAFF.admin.id;
  const staffRows: (NewUser & { id: string })[] = [
    { ...STAFF.admin, id: adminId },
    STAFF.dentist,
    STAFF.assistant,
    STAFF.secretary,
  ];
  const dentistIds = [adminId, STAFF.dentist.id];

  // Clinic
  const clinic: typeof clinicSettings.$inferInsert = {
    id: "clinic",
    name: "Cabinet Dentaire Dr Amrani",
    address: "Avenue Hassan II, Immeuble Al Wafa, 2e étage, n° 14",
    city: "Agadir",
    phone: "+212528843217",
    email: "contact@example.com",
    ice: "002184736000057",
    patente: "48213675",
    fiscalId: "40218756",
    cnssNumber: "7392146",
    inpe: "093412587",
  };

  // Insurers, tags
  const insurerRows = INSURER_NAMES.map((name) => ({ id: nanoid(), name }));
  const tagRows = TAG_DEFS.map((t) => ({ id: nanoid(), ...t }));
  const tagId = (label: (typeof TAG_DEFS)[number]["label"]) => tagRows.find((t) => t.label === label)!.id;

  // Services
  const serviceRows = SERVICE_DEFS.map((s) => ({
    id: nanoid(),
    def: s,
    row: {
      label: s.label,
      category: s.category,
      defaultPriceCents: s.priceCents,
      durationMinutes: s.duration,
    },
  }));

  // Appointment types
  const typeRows = APPOINTMENT_TYPE_DEFS.map((t) => ({ id: nanoid(), def: t }));

  // Practitioner schedules
  const scheduleRows: (typeof practitionerSchedules.$inferInsert)[] = dentistIds.flatMap((practitionerId) =>
    Object.entries(SESSIONS).flatMap(([weekday, sessions]) =>
      sessions.map(([startTime, endTime]) => ({
        practitionerId,
        weekday: Number(weekday),
        startTime,
        endTime,
      })),
    ),
  );

  // Schedule exceptions: nearest public holiday (clinic-wide) + a week of leave for Dr Berrada.
  const holidayCandidates = [-1, 0, 1].flatMap((dy) =>
    HOLIDAYS.map(([md, reason]) => {
      const [m, d] = md.split("-").map(Number);
      const day = new TZDate(today.getFullYear() + dy, m - 1, d, CLINIC_TIMEZONE);
      return { day, reason, distance: differenceInCalendarDays(day, today) };
    }),
  ).filter((h) => isoWeekday(h.day) !== 7 && h.distance !== 0);
  const holiday = holidayCandidates.sort(
    (a, b) => Math.abs(a.distance) - Math.abs(b.distance) || b.distance - a.distance,
  )[0];
  const leaveStart = addDays(clinicDay(21), 1 - isoWeekday(clinicDay(21))); // a Monday, 3 weeks out
  const leaveEnd = addDays(leaveStart, 6); // up to Sunday 00:00
  const exceptionRows: (typeof scheduleExceptions.$inferInsert)[] = [
    { practitionerId: null, startsAt: at(holiday.day, "00:00"), endsAt: at(addDays(holiday.day, 1), "00:00"), reason: `Jour férié — ${holiday.reason}` },
    { practitionerId: STAFF.dentist.id, startsAt: at(leaveStart, "00:00"), endsAt: at(leaveEnd, "00:00"), reason: "Congé annuel" },
  ];
  const isClosed = (practitionerId: string, day: Date) =>
    dayKey(day) === dayKey(holiday.day) ||
    (practitionerId === STAFF.dentist.id && day >= leaveStart && day < leaveEnd);

  // Patients
  const archivedIdx = new Set([13, 37, 52]);
  const childIdx = new Set([4, 19, 33, 46]);
  const usedNames = new Set<string>();
  const childIds = new Set<string>();
  const patientRows: NewPatient[] = Array.from({ length: 60 }, (_, i) => {
    const gender = chance(0.52) ? "female" : "male";
    let firstName: string;
    let lastName: string;
    do {
      firstName = pick(gender === "female" ? FEMALE_FIRST : MALE_FIRST);
      lastName = pick(LAST_NAMES);
    } while (usedNames.has(`${firstName} ${lastName}`));
    usedNames.add(`${firstName} ${lastName}`);

    const isChild = childIdx.has(i);
    const age = isChild ? int(6, 11) : int(18, 78);
    const birthDate = format(addDays(addMonths(today, -12 * age), -int(0, 364)), "yyyy-MM-dd");
    const insurer = chance(0.7) ? pick(insurerRows) : null;
    const city = weighted(CITIES);
    const id = nanoid();
    if (isChild) childIds.add(id);
    return {
      id,
      shortCode: shortCode(),
      firstName,
      lastName,
      gender,
      phone: mobile(),
      // Children are reached through a parent; some adults leave a second number.
      secondaryPhone: isChild || chance(0.2) ? mobile() : null,
      email: !isChild && chance(0.45) ? `${slug(firstName)}.${slug(lastName)}${int(1, 99)}@example.com` : null,
      birthDate,
      address: `${int(1, 180)}, ${pick(STREETS)} ${int(1, 60)}, ${pick(QUARTIERS)}`,
      city,
      cin: isChild ? null : `${pick(["J", "JA", "JB", "JC", "JH"])}${digits(6)}`,
      insurerId: insurer?.id ?? null,
      insuranceNumber: insurer
        ? insurer.name === "CNSS" ? digits(9)
        : insurer.name === "CNOPS" ? `${digits(3)}-${digits(6)}`
        : `POL-${digits(7)}`
        : null,
      allergies: chance(0.15) ? pick(ALLERGIES) : null,
      medicalNotes: !isChild && chance(0.2) ? pick(MEDICAL_NOTES) : null,
      isArchived: archivedIdx.has(i),
      createdByStaffId: STAFF.secretary.id,
      createdAt: workingInstant(clinicDay(-int(1, 720))),
    };
  });
  const activePatients = patientRows.filter((p) => !p.isArchived);

  // Patient tags — roughly a third of patients, 1–2 tags each.
  const patientTagRows: (typeof patientTags.$inferInsert)[] = [];
  for (const p of shuffle(activePatients).slice(0, 20)) {
    const labels = shuffle(TAG_DEFS.map((t) => t.label)).slice(0, int(1, 2));
    for (const label of labels) patientTagRows.push({ patientId: p.id, tagId: tagId(label) });
  }
  // Recently created patients are tagged «Nouveau».
  for (const p of activePatients) {
    const isRecent = (p.createdAt as Date) > at(clinicDay(-30), "00:00");
    if (isRecent && !patientTagRows.some((r) => r.patientId === p.id && r.tagId === tagId("Nouveau"))) {
      patientTagRows.push({ patientId: p.id, tagId: tagId("Nouveau") });
    }
  }

  // Appointments — walk each working session with a cursor, so a practitioner's
  // appointments can never overlap. Denser around today so the day and week views are full.
  const appointmentRows: NewAppointment[] = [];
  for (let offset = -91; offset <= 91; offset++) {
    const day = clinicDay(offset);
    const sessions = SESSIONS[isoWeekday(day)];
    if (!sessions) continue;
    const density = offset >= -3 && offset <= 7 ? 0.22 : 0.028;
    for (const practitionerId of dentistIds) {
      if (isClosed(practitionerId, day)) continue;
      for (const [start, end] of sessions) {
        let cursor = minutesOf(start);
        while (cursor + 15 <= minutesOf(end)) {
          if (!chance(density)) {
            cursor += 15;
            continue;
          }
          const type = weighted(typeRows.map((t) => [t, t.def.weight] as const));
          const duration = type.def.duration;
          if (cursor + duration > minutesOf(end)) break;
          const patient = offset < 0 ? pick(activePatients) : pick(activePatients.filter((p) => !childIds.has(p.id) || chance(0.5)));
          appointmentRows.push({
            id: nanoid(),
            patientId: patient.id,
            practitionerId,
            typeId: type.id,
            startsAt: at(day, hhmmOf(cursor)),
            endsAt: at(day, hhmmOf(cursor + duration)),
            reason: pick(type.def.reasons),
            notes: chance(0.1) ? pick(["Patient anxieux.", "Prévoir radiographie.", "Rappeler la veille.", "Accompagné d’un parent."]) : null,
            createdByStaffId: pick([STAFF.secretary.id, STAFF.assistant.id]),
            createdAt: at(clinicDay(Math.min(offset, 0) - int(1, 20)), "10:00"),
          });
          cursor += duration + pick([0, 0, 15, 30]);
        }
      }
    }
  }
  // Status follows the clock: the past is settled, today is in motion, the future is booked.
  for (const a of appointmentRows) {
    if (a.endsAt <= now) {
      a.status = weighted([["completed", 78], ["canceled", 12], ["no_show", 10]] as const);
    } else if (a.startsAt <= now) {
      a.status = "arrived";
    } else {
      a.status = weighted([["planned", 50], ["confirmed", 40], ["canceled", 10]] as const);
    }
  }
  // Guarantee every status is represented whatever the hour the seed runs at.
  const upcoming = appointmentRows.filter((a) => a.startsAt > now && a.status !== "canceled");
  if (!appointmentRows.some((a) => a.status === "arrived")) {
    const next =
      upcoming.find((a) => dayKey(a.startsAt) === dayKey(today)) ??
      appointmentRows.filter((a) => a.status === "completed").at(-1);
    if (next) next.status = "arrived"; // an early patient already in the waiting room
  }
  for (const status of ["planned", "confirmed", "canceled"] as const) {
    if (!appointmentRows.some((a) => a.status === status)) {
      const target = upcoming.filter((a) => a.status !== "arrived").at(-1);
      if (target) target.status = status;
    }
  }
  for (const status of ["completed", "no_show"] as const) {
    if (!appointmentRows.some((a) => a.status === status)) {
      const target = appointmentRows.find((a) => a.endsAt <= now && a.status !== "completed" && a.status !== "no_show")
        ?? appointmentRows.find((a) => a.endsAt <= now);
      if (target) target.status = status;
    }
  }

  // Treatments — 2–6 per active patient, label + price snapshotted from the service.
  const completedByPatient = new Map<string, NewAppointment[]>();
  for (const a of appointmentRows) {
    if (a.status !== "completed") continue;
    completedByPatient.set(a.patientId, [...(completedByPatient.get(a.patientId) ?? []), a]);
  }
  const treatmentRows: NewTreatment[] = [];
  for (const patient of activePatients) {
    const eligible = serviceRows.filter((s) =>
      childIds.has(patient.id) ? s.def.child : !s.def.childOnly,
    );
    const visits = completedByPatient.get(patient.id) ?? [];
    for (let n = int(2, 6); n > 0; n--) {
      const service = weighted(eligible.map((s) => [s, CATEGORY_WEIGHT[s.def.category]] as const));
      const status = weighted([["completed", 55], ["in_progress", 15], ["planned", 22], ["canceled", 8]] as const);
      const visit = status !== "planned" && visits.length > 0 && chance(0.8) ? pick(visits) : null;
      const performedAt =
        status === "planned" ? null
        : visit ? visit.startsAt
        : workingInstant(clinicDay(-int(1, 90)));
      treatmentRows.push({
        id: nanoid(),
        patientId: patient.id,
        appointmentId: visit?.id ?? null,
        serviceId: service.id,
        practitionerId: (visit?.practitionerId as string | undefined) ?? pick(dentistIds),
        label: service.row.label,
        teeth: teethFor(service.def.teeth, childIds.has(patient.id)),
        totalAmountCents: service.row.defaultPriceCents,
        status,
        performedAt,
        notes: status === "canceled" ? "Annulé à la demande du patient." : null,
        createdByStaffId: pick(dentistIds),
        createdAt: performedAt ?? workingInstant(clinicDay(-int(1, 60))),
      });
    }
  }

  // A patient's file is opened before their first appointment or acte.
  for (const patient of patientRows) {
    const firstActivity = [
      ...appointmentRows.filter((a) => a.patientId === patient.id).map((a) => a.createdAt as Date),
      ...treatmentRows.filter((t) => t.patientId === patient.id).map((t) => t.createdAt as Date),
    ].sort((a, b) => a.getTime() - b.getTime())[0];
    if (firstActivity && firstActivity < (patient.createdAt as Date)) {
      // Back-date through workingInstant so the file is opened on an open day, in opening hours.
      const firstDay = new TZDate(firstActivity.getTime(), CLINIC_TIMEZONE);
      patient.createdAt = workingInstant(addDays(firstDay, -int(1, 30)));
    }
  }

  // Payments — full, partial, unpaid, and overpaid («Avance») accounts.
  const paymentRows: NewPayment[] = [];
  const METHODS = [["cash", 55], ["card", 18], ["check", 17], ["transfer", 10]] as const;
  const referenceFor = (method: NewPayment["method"]) =>
    method === "check" ? `Chèque n° ${digits(7)}`
    : method === "transfer" ? `VIR-${digits(8)}`
    : method === "card" ? `TPE ${digits(6)}`
    : method === "insurance" ? `Dossier n° ${digits(8)}`
    : null;
  const paidAfter = (performedAt: Date) => {
    const from = Math.max(0, differenceInCalendarDays(performedAt, today) * -1);
    return notAfterNow(workingInstant(clinicDay(-int(0, Math.min(from, 20)))));
  };
  const pay = (p: Omit<NewPayment, "reference" | "createdByStaffId">) =>
    paymentRows.push({ ...p, reference: referenceFor(p.method), createdByStaffId: STAFF.secretary.id });

  const billable = (patientId: string) =>
    treatmentRows.filter((t) => t.patientId === patientId && (t.status === "completed" || t.status === "in_progress"));
  const payers = shuffle(activePatients.filter((p) => billable(p.id).length > 0));
  let insuranceCount = 0;
  payers.forEach((patient, i) => {
    const acts = billable(patient.id);
    const profile = i < 2 ? "overpaid" : i < 2 + payers.length * 0.4 ? "full" : i < 2 + payers.length * 0.72 ? "partial" : "unpaid";
    if (profile === "unpaid") return;

    const settled = profile === "partial" ? acts.slice(0, Math.max(0, acts.length - 1)) : acts;
    for (const act of settled) {
      const paidAt = paidAfter(act.performedAt as Date);
      const insurer = patient.insurerId && (insuranceCount < 3 || chance(0.08)) ? patient.insurerId : null;
      if (insurer) {
        // The insurer reimburses part of the acte; the patient pays the rest.
        insuranceCount++;
        const reimbursed = roundDH(act.totalAmountCents * 0.6, 10);
        pay({ patientId: patient.id, treatmentId: act.id, amountCents: act.totalAmountCents - reimbursed, method: weighted(METHODS), paidAt });
        pay({ patientId: patient.id, treatmentId: act.id, insurerId: insurer, amountCents: reimbursed, method: "insurance", paidAt: notAfterNow(workingInstant(clinicDay(Math.min(0, differenceInCalendarDays(paidAt, today) + int(7, 21))))) });
      } else if (act.totalAmountCents >= 300000) {
        // Large actes are paid in two instalments.
        const first = roundDH(act.totalAmountCents / 2, 100);
        pay({ patientId: patient.id, treatmentId: act.id, amountCents: first, method: weighted(METHODS), paidAt });
        pay({ patientId: patient.id, treatmentId: act.id, amountCents: act.totalAmountCents - first, method: weighted(METHODS), paidAt: paidAfter(paidAt) });
      } else {
        pay({ patientId: patient.id, treatmentId: act.id, amountCents: act.totalAmountCents, method: weighted(METHODS), paidAt });
      }
    }
    if (profile === "partial") {
      // An unallocated deposit on the last, unsettled acte.
      const open = acts[acts.length - 1];
      const deposit = roundDH(open.totalAmountCents * 0.4, 50);
      if (deposit > 0) {
        pay({ patientId: patient.id, amountCents: deposit, method: "cash", paidAt: paidAfter(open.performedAt as Date), notes: "Acompte" });
      }
    }
    if (profile === "overpaid") {
      // Paid ahead of the treatment plan: exceeds every non-canceled acte, planned ones included.
      const planned = treatmentRows
        .filter((t) => t.patientId === patient.id && t.status === "planned")
        .reduce((sum, t) => sum + t.totalAmountCents, 0);
      pay({ patientId: patient.id, amountCents: planned + 100000, method: "cash", paidAt: workingInstant(clinicDay(-int(1, 10))), notes: "Avance sur plan de traitement" });
    }
  });

  // Expenses — the last three months, spread across every category.
  const expenseRows: (typeof expenses.$inferInsert)[] = [];
  for (let m = 0; m < 3; m++) {
    const month = startOfMonth(addMonths(today, -m));
    const spend = (dayOfMonth: number, row: Omit<typeof expenses.$inferInsert, "spentAt" | "createdByStaffId">) => {
      const day = addDays(month, dayOfMonth - 1);
      if (day > today) return;
      expenseRows.push({ ...row, spentAt: at(day, "10:30"), createdByStaffId: adminId });
    };
    spend(2, { label: "Loyer du cabinet", category: "rent", amountCents: 800000, supplier: "SCI Résidence Souss" });
    spend(28, { label: "Salaire assistante dentaire", category: "salaries", amountCents: 450000, supplier: null });
    spend(28, { label: "Salaire secrétaire médicale", category: "salaries", amountCents: 400000, supplier: null });
    spend(10, { label: "Cotisations CNSS employeur", category: "taxes", amountCents: int(170000, 185000), supplier: "CNSS" });
    spend(12, { label: "Facture d’électricité", category: "utilities", amountCents: int(90000, 140000), supplier: "ONEE" });
    spend(12, { label: "Facture d’eau", category: "utilities", amountCents: int(15000, 25000), supplier: "RAMSA" });
    spend(5, { label: "Internet et téléphone", category: "utilities", amountCents: 49900, supplier: "Maroc Telecom" });
    spend(int(3, 9), { label: "Consommables (gants, compresses, aspiration)", category: "supplies", amountCents: int(150000, 300000), supplier: "Souss Dental Distribution" });
    spend(int(15, 22), { label: "Composites et anesthésiques", category: "supplies", amountCents: int(200000, 400000), supplier: "Atlas Médical Fournitures" });
    spend(int(18, 26), { label: "Travaux de prothèse (couronnes, bridges)", category: "lab", amountCents: int(250000, 600000), supplier: "Laboratoire Prothèse Argana" });
  }
  const oneOff = (offset: number, row: Omit<typeof expenses.$inferInsert, "spentAt" | "createdByStaffId">) =>
    expenseRows.push({ ...row, spentAt: at(clinicDay(offset), "11:00"), createdByStaffId: adminId });
  oneOff(-64, { label: "Lampe à photopolymériser LED", category: "equipment", amountCents: 350000, supplier: "Atlas Médical Fournitures" });
  oneOff(-41, { label: "Révision annuelle du compresseur", category: "maintenance", amountCents: 120000, supplier: "Souss Technique Dentaire", notes: "Contrat de maintenance 2026" });
  oneOff(-23, { label: "Taxe professionnelle", category: "taxes", amountCents: 250000, supplier: "Commune d’Agadir" });
  oneOff(-9, { label: "Blouses et tenues du personnel", category: "other", amountCents: 60000, supplier: null });

  // Tasks
  const due = (offset: number) => format(clinicDay(offset), "yyyy-MM-dd");
  const taskRows: (typeof tasks.$inferInsert)[] = [
    { content: "Relancer le laboratoire pour les couronnes en attente", dueDate: due(1), isImportant: true, isDone: false, createdByStaffId: adminId },
    { content: "Commander des gants nitrile taille M et des compresses", dueDate: due(3), isImportant: false, isDone: false, createdByStaffId: STAFF.assistant.id },
    { content: "Renouveler le contrat de maintenance de l’autoclave", dueDate: due(12), isImportant: false, isDone: false, createdByStaffId: adminId },
    { content: "Envoyer les dossiers de remboursement CNOPS du mois", dueDate: due(-3), isImportant: false, isDone: true, createdByStaffId: STAFF.secretary.id },
    { content: "Vérifier les dates de péremption des anesthésiques", dueDate: null, isImportant: false, isDone: true, createdByStaffId: STAFF.assistant.id },
  ];

  // ── Dossier médical ──────────────────────────────────────────────────────
  // Its own random stream: drawing from `rand` here would reshuffle every
  // appointment, acte and payment the seed produced before this block existed.
  const mh = mulberry32(20261010);
  const mhInt = (min: number, max: number) => min + Math.floor(mh() * (max - min + 1));
  const mhChance = (p: number) => mh() < p;
  const mhPick = <T,>(items: readonly T[]): T => items[Math.floor(mh() * items.length)];
  function mhWeighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = mh() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r < 0) return value;
    }
    return entries[entries.length - 1][0];
  }
  const mhDigits = (n: number) => Array.from({ length: n }, () => mhInt(0, 9)).join("");
  const mhMobile = () => `+212${mhPick(["6", "7"])}${mhDigits(8)}`;
  const ageOf = (p: NewPatient) => differenceInYears(today, parseISO(p.birthDate!));

  for (const p of patientRows) {
    if (!childIds.has(p.id) && mhChance(0.65)) p.profession = mhPick(PROFESSIONS);
  }

  /** When the dossier was last saved: some day since the patient was created. */
  const savedAt = (p: NewPatient, maxDaysAgo: number) => {
    const age = Math.max(0, differenceInCalendarDays(today, p.createdAt as Date));
    return at(clinicDay(-mhInt(0, Math.min(age, maxDaysAgo))), hhmmOf(mhInt(9 * 60, 18 * 60)));
  };

  const historyFor = (p: NewPatient, facts: HistoryFacts): NewMedicalHistory => {
    const isChild = childIds.has(p.id);
    const canBePregnant = p.gender === "female" && !isChild && ageOf(p) <= 45;
    const drawn = isChild ? [] : BACKGROUND_CONDITIONS.filter(() => mhChance(0.06));
    const updatedAt = savedAt(p, 300);
    const hasContact = isChild || mhChance(0.6);
    return {
      patientId: p.id,
      onAnticoagulants: false,
      onBisphosphonates: false,
      needsAntibioticProphylaxis: false,
      isPregnant: canBePregnant ? false : null,
      pregnancyWeeks: null,
      isBreastfeeding: canBePregnant ? mhChance(0.1) : null,
      currentMedications: null,
      surgicalHistory: !isChild && mhChance(0.25) ? mhPick(SURGERIES) : null,
      anesthesiaReactions: mhChance(0.05) ? "Malaise vagal lors d’une anesthésie locale." : null,
      smoking: isChild ? "none" : mhWeighted([["none", 70], ["occasional", 12], ["regular", 18]] as const),
      bruxism: mhChance(0.15),
      bloodType: mhChance(0.6) ? mhWeighted(BLOOD_TYPES) : null,
      primaryDoctorName: mhChance(0.5) ? `Dr ${mhPick(LAST_NAMES)}` : null,
      primaryDoctorPhone: mhChance(0.5) ? `+2125288${mhDigits(5)}` : null,
      // A child's emergency contact is the other parent.
      emergencyContactName: hasContact
        ? `${mhPick(mhChance(0.5) ? FEMALE_FIRST : MALE_FIRST)} ${isChild ? p.lastName : mhPick(LAST_NAMES)}`
        : null,
      emergencyContactPhone: hasContact ? mhMobile() : null,
      emergencyContactRelation: hasContact ? (isChild ? mhPick(["Mère", "Père"]) : mhPick(ADULT_RELATIONS)) : null,
      updatedByStaffId: mhPick([STAFF.dentist.id, STAFF.assistant.id, adminId]),
      createdAt: updatedAt,
      updatedAt,
      ...facts,
      // Merged, not replaced: a note's condition joins the drawn ones.
      conditions: [...new Set([...drawn, ...(facts.conditions ?? [])])],
    };
  };

  // ~40% of adults — every one whose note already describes a history, then a
  // random fill — plus every child: a minor's dossier needs a parent to call.
  const adults = patientRows.filter((p) => !childIds.has(p.id));
  const target = Math.round(adults.length * 0.4);
  const noteFacts = (p: NewPatient) => (p.medicalNotes ? NOTE_FACTS[p.medicalNotes] : undefined);
  const noteDriven = adults.filter((p) => noteFacts(p) !== undefined);
  const filled = [
    ...noteDriven,
    ...shuffle(adults.filter((p) => !noteDriven.includes(p))).slice(0, Math.max(0, target - noteDriven.length)),
  ];
  const historyRows = new Map<string, NewMedicalHistory>();
  for (const p of filled) historyRows.set(p.id, historyFor(p, noteFacts(p) ?? {}));
  for (const p of patientRows) {
    if (childIds.has(p.id)) historyRows.set(p.id, historyFor(p, {}));
  }
  // A pregnancy note only becomes a pregnancy for a woman who can be pregnant.
  for (const p of noteDriven) {
    const row = historyRows.get(p.id)!;
    if (p.medicalNotes!.startsWith("Grossesse") && row.isPregnant === false) {
      const recordedAt = savedAt(p, 14);
      Object.assign(row, { isPregnant: true, pregnancyWeeks: mhInt(10, 24), createdAt: recordedAt, updatedAt: recordedAt });
    }
  }

  // Guarantee one active patient per header pill, so each can be checked on
  // screen. A pregnancy is recorded recently, so its aged term stays plausible.
  const isActive = (patientId: string) => activePatients.some((p) => p.id === patientId);
  const guarantee = (
    holds: (h: NewMedicalHistory) => boolean,
    eligible: (p: NewPatient) => boolean,
    facts: HistoryFacts,
  ) => {
    if ([...historyRows.values()].some((h) => holds(h) && isActive(h.patientId))) return;
    const candidate = activePatients.find((p) => {
      const h = historyRows.get(p.id);
      // One critical flag per guaranteed patient, so each pill is seen alone too.
      const isFlagged = !!h && (!!h.onAnticoagulants || !!h.onBisphosphonates || !!h.needsAntibioticProphylaxis || h.isPregnant === true);
      return !childIds.has(p.id) && !isFlagged && eligible(p);
    });
    if (!candidate) throw new Error("Seed : aucun patient éligible pour une alerte médicale garantie.");
    const existing = historyRows.get(candidate.id) ?? historyFor(candidate, {});
    historyRows.set(candidate.id, {
      ...existing,
      ...facts,
      conditions: [...new Set([...(existing.conditions ?? []), ...(facts.conditions ?? [])])],
    });
  };
  guarantee((h) => !!h.onAnticoagulants, () => true, {
    onAnticoagulants: true,
    conditions: ["heart_disease"],
    currentMedications: "Acénocoumarol (Sintrom) 4 mg, dose adaptée à l’INR",
  });
  guarantee((h) => !!h.needsAntibioticProphylaxis, () => true, {
    needsAntibioticProphylaxis: true,
    conditions: ["heart_disease"],
  });
  guarantee((h) => !!h.onBisphosphonates, (p) => ageOf(p) >= 55, {
    onBisphosphonates: true,
    conditions: ["osteoporosis"],
    currentMedications: "Alendronate 70 mg, 1 fois par semaine",
  });
  const pregnancyRecordedAt = at(clinicDay(-mhInt(1, 10)), "11:00");
  guarantee(
    (h) => h.isPregnant === true,
    (p) => p.gender === "female" && ageOf(p) >= 20 && ageOf(p) <= 40,
    {
      isPregnant: true,
      pregnancyWeeks: 16,
      isBreastfeeding: false,
      createdAt: pregnancyRecordedAt,
      updatedAt: pregnancyRecordedAt,
    },
  );
  const medicalHistoryRows = [...historyRows.values()];

  // ── Write — one atomic batch ──────────────────────────────────────────────
  const queries: [BatchItem<"pg">, ...BatchItem<"pg">[]] = [
    db
      .insert(user)
      .values(staffRows.map((s) => ({ ...s, isActive: true })))
      .onConflictDoUpdate({
        target: user.id,
        set: {
          name: sql.raw(`excluded.${user.name.name}`),
          email: sql.raw(`excluded.${user.email.name}`),
          role: sql.raw(`excluded.${user.role.name}`),
          isActive: sql.raw(`excluded.${user.isActive.name}`),
          title: sql.raw(`excluded.${user.title.name}`),
          inpe: sql.raw(`excluded.${user.inpe.name}`),
          color: sql.raw(`excluded.${user.color.name}`),
          updatedAt: new Date(),
        },
      }),
    db.execute(sql`TRUNCATE TABLE
      ${activityLog}, ${documents}, ${odontogramCharts}, ${payments}, ${treatments},
      ${appointments}, ${medicalHistories}, ${patientTags}, ${patients}, ${scheduleExceptions},
      ${practitionerSchedules}, ${appointmentTypes}, ${services}, ${tags}, ${insurers},
      ${expenses}, ${tasks}, ${clinicSettings}
      CASCADE`),
    db.insert(clinicSettings).values(clinic),
    db.insert(insurers).values(insurerRows),
    db.insert(tags).values(tagRows),
    db.insert(services).values(serviceRows.map((s) => ({ id: s.id, ...s.row }))),
    db.insert(appointmentTypes).values(
      typeRows.map((t) => ({ id: t.id, label: t.def.label, color: t.def.color, defaultDurationMinutes: t.def.duration })),
    ),
    db.insert(practitionerSchedules).values(scheduleRows),
    db.insert(scheduleExceptions).values(exceptionRows),
    db.insert(patients).values(patientRows),
    db.insert(patientTags).values(patientTagRows),
    db.insert(medicalHistories).values(medicalHistoryRows),
    db.insert(appointments).values(appointmentRows),
    db.insert(treatments).values(treatmentRows),
    db.insert(payments).values(paymentRows),
    db.insert(expenses).values(expenseRows),
    db.insert(tasks).values(taskRows),
  ];
  await db.batch(queries);

  // Counts and ids only — never a patient name (08-clinical.md §6).
  const billed = new Map<string, number>();
  for (const t of treatmentRows) {
    if (t.status === "completed" || t.status === "in_progress") {
      billed.set(t.patientId, (billed.get(t.patientId) ?? 0) + t.totalAmountCents);
    }
  }
  const paid = new Map<string, number>();
  for (const p of paymentRows) paid.set(p.patientId, (paid.get(p.patientId) ?? 0) + p.amountCents);
  const overpaid = [...paid].filter(([id, amount]) => amount > (billed.get(id) ?? 0)).map(([id]) => id);
  const statusCounts = appointmentRows.reduce<Record<string, number>>((acc, a) => {
    acc[a.status!] = (acc[a.status!] ?? 0) + 1;
    return acc;
  }, {});

  console.log("Seed terminé :");
  console.table({
    staff: staffRows.length,
    insurers: insurerRows.length,
    tags: tagRows.length,
    services: serviceRows.length,
    appointmentTypes: typeRows.length,
    practitionerSchedules: scheduleRows.length,
    scheduleExceptions: exceptionRows.length,
    patients: patientRows.length,
    patientTags: patientTagRows.length,
    medicalHistories: medicalHistoryRows.length,
    appointments: appointmentRows.length,
    treatments: treatmentRows.length,
    payments: paymentRows.length,
    insurancePayments: paymentRows.filter((p) => p.method === "insurance").length,
    expenses: expenseRows.length,
    tasks: taskRows.length,
  });
  console.log("Statuts des rendez-vous :", statusCounts);
  console.log("Patients en avance (ids) :", overpaid);
  // Ids only — open each at /patients/<id>?tab=medical_history to check its pill.
  const flagged = (holds: (h: NewMedicalHistory) => boolean) =>
    medicalHistoryRows.filter(holds).map((h) => h.patientId);
  console.log("Dossiers médicaux à alertes (ids) :", {
    anticoagulants: flagged((h) => !!h.onAnticoagulants),
    bisphosphonates: flagged((h) => !!h.onBisphosphonates),
    antibioprophylaxie: flagged((h) => !!h.needsAntibioticProphylaxis),
    enceinte: flagged((h) => h.isPregnant === true),
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
