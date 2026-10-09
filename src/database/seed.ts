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
  getDaysInMonth,
  parseISO,
  startOfMonth,
} from "date-fns";
import { eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { nanoid } from "nanoid";

import { CLINIC_TIMEZONE } from "../constants";
import { clinicInstant, toClinicDate } from "../lib/time";
import { buildDocumentFileName } from "../modules/documents/file-name";
import { nextDocumentNumber } from "../modules/documents/numbering";
import {
  buildDocumentSnapshot,
  pickPractitionerId,
  type BuildSnapshotInput,
} from "../modules/documents/snapshot";
import { DocumentType } from "../modules/documents/types";
import { getNgapAct } from "../modules/services/ngap";
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
const int = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));
const chance = (p: number) => rand() < p;
const pick = <T>(items: readonly T[]): T =>
  items[Math.floor(rand() * items.length)];
const digits = (n: number) =>
  Array.from({ length: n }, () => int(0, 9)).join("");
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
const roundDH = (cents: number, stepDH: number) =>
  Math.floor(cents / (stepDH * 100)) * stepDH * 100;

// ── Clinic time ─────────────────────────────────────────────────────────────
const now = new Date();
const today = TZDate.tz(CLINIC_TIMEZONE);
today.setHours(0, 0, 0, 0);

/** An instant at wall-clock `hh:mm` on `day`, resolved in the clinic timezone. */
function at(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  const local = new TZDate(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    h,
    m,
    CLINIC_TIMEZONE,
  );
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
const notAfterNow = (instant: Date) =>
  instant > now ? new Date(now.getTime() - 60_000) : instant;

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
  throw new Error(
    "BOOTSTRAP_ADMIN_EMAIL must be set: the seeded admin uses it as their email.",
  );
}
if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Refusing to seed with NODE_ENV=production: the seed truncates clinical tables.",
  );
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
const INSURER_NAMES = [
  "CNSS",
  "CNOPS",
  "SANLAM",
  "RMA",
  "AXA Assurance",
] as const;

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
  /** The NGAP code, or null for an act the nomenclature does not cover. */
  code: string | null;
  child?: boolean; // suitable for a child patient (adult-eligible unless childOnly)
  childOnly?: boolean;
};

// Common acts, by NGAP code. Label, category and price come from the dataset:
// the price is the NGAP REFERENCE tariff, used here only as a placeholder fee.
// The clinic's real fees are entered in Paramètres › Actes before go-live.
type NgapServiceDef = Pick<ServiceDef, "duration" | "teeth" | "child" | "childOnly"> & {
  code: string;
};
const NGAP_SERVICE_DEFS: NgapServiceDef[] = [
  { code: "C", duration: 30, teeth: "none", child: true },
  { code: "D700", duration: 30, teeth: "one", child: true },
  { code: "D701", duration: 30, teeth: "one", child: true },
  { code: "D702", duration: 45, teeth: "one" },
  { code: "D703", duration: 30, teeth: "one", child: true },
  { code: "D704", duration: 60, teeth: "anterior" },
  { code: "D705", duration: 75, teeth: "one" },
  { code: "D706", duration: 90, teeth: "one" },
  { code: "D707", duration: 45, teeth: "one" },
  { code: "D708", duration: 45, teeth: "none", child: true },
  { code: "D712", duration: 15, teeth: "one", child: true },
  { code: "D713", duration: 30, teeth: "one" },
  { code: "D714", duration: 15, teeth: "one" },
  { code: "D717", duration: 45, teeth: "one" },
  { code: "D720", duration: 90, teeth: "wisdom" },
  { code: "D725", duration: 60, teeth: "wisdom" },
  { code: "D743", duration: 60, teeth: "none" },
  { code: "D748", duration: 60, teeth: "one" },
  { code: "D749", duration: 60, teeth: "one" },
  { code: "D754", duration: 60, teeth: "one" },
  { code: "D761", duration: 45, teeth: "none" },
  { code: "D773", duration: 60, teeth: "none" },
  { code: "D774", duration: 60, teeth: "none" },
  { code: "D900", duration: 60, teeth: "one" },
  { code: "D910", duration: 45, teeth: "anterior" },
  { code: "D626", duration: 45, teeth: "none", child: true },
  { code: "D629", duration: 60, teeth: "none", child: true },
  { code: "T151", duration: 15, teeth: "none" },
  { code: "T153", duration: 15, teeth: "none", child: true },
  { code: "T156", duration: 15, teeth: "one", child: true },
];

// Acts the NGAP does not cover — implantology and cosmetic stay represented.
// `code: null`, and the price is an invented placeholder like every seed fee.
const CLINIC_SERVICE_DEFS: ServiceDef[] = [
  {
    label: "Pose d’implant dentaire",
    category: "implantology",
    priceCents: 800000,
    duration: 90,
    teeth: "one",
    code: null,
  },
  {
    label: "Couronne sur implant",
    category: "implantology",
    priceCents: 350000,
    duration: 60,
    teeth: "one",
    code: null,
  },
  {
    label: "Blanchiment dentaire",
    category: "cosmetic",
    priceCents: 250000,
    duration: 60,
    teeth: "none",
    code: null,
  },
  {
    label: "Composite esthétique antérieur",
    category: "cosmetic",
    priceCents: 60000,
    duration: 45,
    teeth: "anterior",
    code: null,
  },
  {
    label: "Facette composite",
    category: "cosmetic",
    priceCents: 120000,
    duration: 60,
    teeth: "anterior",
    code: null,
  },
];

const SERVICE_DEFS: ServiceDef[] = [
  ...NGAP_SERVICE_DEFS.map(({ code, ...def }) => {
    const act = getNgapAct(code);
    if (!act) throw new Error(`Seed: NGAP code ${code} is not in the dataset`);
    return {
      ...def,
      code,
      label: act.designation,
      category: act.suggestedCategory,
      priceCents: act.referenceTariffCents,
    };
  }),
  ...CLINIC_SERVICE_DEFS,
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
  {
    label: "Consultation Initiale",
    color: "#0D9488",
    duration: 30,
    weight: 5,
    reasons: [
      "Premier examen",
      "Bilan bucco-dentaire",
      "Douleur dentaire",
      "Contrôle annuel",
    ],
  },
  {
    label: "Consultation de Retour",
    color: "#0891B2",
    duration: 15,
    weight: 5,
    reasons: [
      "Contrôle post-opératoire",
      "Suivi de traitement",
      "Contrôle cicatrisation",
    ],
  },
  {
    label: "Détartrage",
    color: "#16A34A",
    duration: 45,
    weight: 4,
    reasons: ["Détartrage et polissage", "Saignement des gencives"],
  },
  {
    label: "Soin",
    color: "#2563EB",
    duration: 45,
    weight: 7,
    reasons: [
      "Carie molaire",
      "Obturation composite",
      "Traitement de racine — séance",
      "Sensibilité au froid",
    ],
  },
  {
    label: "Extraction",
    color: "#DC2626",
    duration: 30,
    weight: 2,
    reasons: [
      "Extraction dent délabrée",
      "Extraction dent de lait",
      "Dent mobile",
    ],
  },
  {
    label: "Chirurgie",
    color: "#9333EA",
    duration: 90,
    weight: 1,
    reasons: [
      "Dent de sagesse incluse",
      "Pose d’implant",
      "Élévation sinusienne",
    ],
  },
  {
    label: "Prothèse",
    color: "#D97706",
    duration: 60,
    weight: 2,
    reasons: [
      "Empreinte couronne",
      "Essayage prothèse",
      "Pose couronne",
      "Scellement bridge",
    ],
  },
  {
    label: "Orthodontie",
    color: "#DB2777",
    duration: 30,
    weight: 1,
    reasons: [
      "Activation appareil",
      "Pose des attaches",
      "Contrôle orthodontique",
    ],
  },
] as const;

// ── Names & addresses (invented) ────────────────────────────────────────────
const MALE_FIRST = [
  "Youssef",
  "Mohamed",
  "Ahmed",
  "Omar",
  "Hamza",
  "Mehdi",
  "Karim",
  "Rachid",
  "Hassan",
  "Brahim",
  "Lahcen",
  "Mustapha",
  "Abdellah",
  "Said",
  "Anas",
  "Ayoub",
  "Ilyas",
  "Zakaria",
  "Soufiane",
  "Adil",
  "Hicham",
  "Driss",
  "Jamal",
  "Nabil",
];
const FEMALE_FIRST = [
  "Fatima Zahra",
  "Khadija",
  "Salma",
  "Meryem",
  "Imane",
  "Hajar",
  "Sanaa",
  "Nadia",
  "Latifa",
  "Zineb",
  "Asmae",
  "Houda",
  "Siham",
  "Loubna",
  "Ghizlane",
  "Kawtar",
  "Aicha",
  "Rachida",
  "Samira",
  "Hanane",
  "Oumaima",
  "Douae",
  "Yasmine",
  "Malika",
];
const LAST_NAMES = [
  "Alaoui",
  "Benali",
  "El Idrissi",
  "Bennani",
  "Tazi",
  "Chraibi",
  "El Fassi",
  "Ouazzani",
  "Lahlou",
  "Benkirane",
  "Ait Lhaj",
  "Id Bella",
  "Boutaleb",
  "Bouzid",
  "El Ouardi",
  "Amzil",
  "Oukacha",
  "Belhaj",
  "Hmidouch",
  "Ait Ouahmane",
  "Ezzahiri",
  "Rhouni",
  "Sebti",
  "Kettani",
  "Marzouki",
  "Najjar",
  "Filali",
  "Cherkaoui",
  "Ouhammou",
  "Aboulfath",
  "Afkir",
  "Boukhris",
  "Nait Brahim",
  "El Mansouri",
  "Aglou",
  "Ait Taleb",
  "Bouhlal",
  "Essaadi",
];
const QUARTIERS = [
  "Talborjt",
  "Dakhla",
  "Hay Mohammadi",
  "Les Amicales",
  "Founty",
  "Charaf",
  "Salam",
  "Tilila",
  "Anza",
  "Bensergao",
  "Hay Al Houda",
  "Nouveau Talborjt",
];
const STREETS = ["Rue", "Avenue", "Boulevard", "Impasse"];
const CITIES = [
  ["Agadir", 14],
  ["Inezgane", 3],
  ["Aït Melloul", 2],
  ["Dcheira El Jihadia", 1],
  ["Taghazout", 1],
] as const;
const ALLERGIES = [
  "Pénicilline",
  "Latex",
  "Aspirine",
  "Iode",
  "Amoxicilline",
  "Ibuprofène (AINS)",
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
  "Sous anticoagulant (acénocoumarol) — demander un INR récent avant tout acte chirurgical.":
    {
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
  "diabetes",
  "hypertension",
  "asthma",
  "thyroid",
  "kidney_disease",
  "epilepsy",
  "hepatitis",
] as const;
const PROFESSIONS = [
  "Enseignant(e)",
  "Commerçant(e)",
  "Fonctionnaire",
  "Infirmier(ère)",
  "Agriculteur(trice)",
  "Ingénieur(e)",
  "Étudiant(e)",
  "Chauffeur",
  "Artisan",
  "Retraité(e)",
  "Sans profession",
  "Comptable",
  "Pêcheur",
  "Employé(e) de banque",
  "Guide touristique",
];
const SURGERIES = [
  "Appendicectomie.",
  "Césarienne.",
  "Cholécystectomie.",
  "Amygdalectomie dans l’enfance.",
  "Fracture du poignet opérée.",
  "Hospitalisation pour pneumopathie.",
];
const ADULT_RELATIONS = [
  "Conjoint(e)",
  "Fils",
  "Fille",
  "Frère",
  "Sœur",
  "Mère",
  "Père",
];
const BLOOD_TYPES = [
  ["o_pos", 40],
  ["a_pos", 30],
  ["b_pos", 12],
  ["ab_pos", 4],
  ["o_neg", 6],
  ["a_neg", 5],
  ["b_neg", 2],
  ["ab_neg", 1],
] as const;

// FDI codes (see docs/architecture/08-clinical.md §1).
const quadrant = (q: number, n: number) =>
  Array.from({ length: n }, (_, i) => `${q}${i + 1}`);
const ADULT_TEETH = [
  ...quadrant(1, 8),
  ...quadrant(2, 8),
  ...quadrant(3, 8),
  ...quadrant(4, 8),
];
const CHILD_TEETH = [
  ...quadrant(5, 5),
  ...quadrant(6, 5),
  ...quadrant(7, 5),
  ...quadrant(8, 5),
];
function teethFor(mode: TeethMode, isChild: boolean): string[] {
  switch (mode) {
    case "none":
      return [];
    case "one":
      return [
        pick(
          isChild ? CHILD_TEETH : ADULT_TEETH.filter((t) => !t.endsWith("8")),
        ),
      ];
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
    code = Array.from({ length: 4 }, () => pick([...SHORT_CODE_ALPHABET])).join(
      "",
    );
  } while (shortCodes.has(code));
  shortCodes.add(code);
  return code;
}
const mobile = () => `+212${pick(["6", "7"])}${digits(8)}`;
const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, "");

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
type NewAppointment = typeof appointments.$inferInsert & {
  id: string;
  startsAt: Date;
  endsAt: Date;
};
type NewTreatment = typeof treatments.$inferInsert & {
  id: string;
  totalAmountCents: number;
};
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
  const tagId = (label: (typeof TAG_DEFS)[number]["label"]) =>
    tagRows.find((t) => t.label === label)!.id;

  // Services
  const serviceRows = SERVICE_DEFS.map((s) => ({
    id: nanoid(),
    def: s,
    row: {
      label: s.label,
      category: s.category,
      defaultPriceCents: s.priceCents,
      durationMinutes: s.duration,
      nomenclatureCode: s.code,
    },
  }));

  // Appointment types
  const typeRows = APPOINTMENT_TYPE_DEFS.map((t) => ({ id: nanoid(), def: t }));

  // Practitioner schedules
  const scheduleRows: (typeof practitionerSchedules.$inferInsert)[] =
    dentistIds.flatMap((practitionerId) =>
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
  const holidayCandidates = [-1, 0, 1]
    .flatMap((dy) =>
      HOLIDAYS.map(([md, reason]) => {
        const [m, d] = md.split("-").map(Number);
        const day = new TZDate(
          today.getFullYear() + dy,
          m - 1,
          d,
          CLINIC_TIMEZONE,
        );
        return { day, reason, distance: differenceInCalendarDays(day, today) };
      }),
    )
    .filter((h) => isoWeekday(h.day) !== 7 && h.distance !== 0);
  const holiday = holidayCandidates.sort(
    (a, b) =>
      Math.abs(a.distance) - Math.abs(b.distance) || b.distance - a.distance,
  )[0];
  const leaveStart = addDays(clinicDay(21), 1 - isoWeekday(clinicDay(21))); // a Monday, 3 weeks out
  const leaveEnd = addDays(leaveStart, 6); // up to Sunday 00:00
  const exceptionRows: (typeof scheduleExceptions.$inferInsert)[] = [
    {
      practitionerId: null,
      startsAt: at(holiday.day, "00:00"),
      endsAt: at(addDays(holiday.day, 1), "00:00"),
      reason: `Jour férié — ${holiday.reason}`,
    },
    {
      practitionerId: STAFF.dentist.id,
      startsAt: at(leaveStart, "00:00"),
      endsAt: at(leaveEnd, "00:00"),
      reason: "Congé annuel",
    },
  ];
  const isClosed = (practitionerId: string, day: Date) =>
    dayKey(day) === dayKey(holiday.day) ||
    (practitionerId === STAFF.dentist.id &&
      day >= leaveStart &&
      day < leaveEnd);

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
    const birthDate = format(
      addDays(addMonths(today, -12 * age), -int(0, 364)),
      "yyyy-MM-dd",
    );
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
      email:
        !isChild && chance(0.45)
          ? `${slug(firstName)}.${slug(lastName)}${int(1, 99)}@example.com`
          : null,
      birthDate,
      address: `${int(1, 180)}, ${pick(STREETS)} ${int(1, 60)}, ${pick(QUARTIERS)}`,
      city,
      cin: isChild
        ? null
        : `${pick(["J", "JA", "JB", "JC", "JH"])}${digits(6)}`,
      insurerId: insurer?.id ?? null,
      insuranceNumber: insurer
        ? insurer.name === "CNSS"
          ? digits(9)
          : insurer.name === "CNOPS"
            ? `${digits(3)}-${digits(6)}`
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
    for (const label of labels)
      patientTagRows.push({ patientId: p.id, tagId: tagId(label) });
  }
  // Recently created patients are tagged «Nouveau».
  for (const p of activePatients) {
    const isRecent = (p.createdAt as Date) > at(clinicDay(-30), "00:00");
    if (
      isRecent &&
      !patientTagRows.some(
        (r) => r.patientId === p.id && r.tagId === tagId("Nouveau"),
      )
    ) {
      patientTagRows.push({ patientId: p.id, tagId: tagId("Nouveau") });
    }
  }

  // Appointments — walk each working session with a cursor, so a practitioner's
  // appointments can never overlap. Denser around today so the day and week views are full.
  const appointmentRows: NewAppointment[] = [];
  for (let offset = -91; offset <= 91; offset++) {
    // Today is planned below, slot by slot, relative to the seeding instant.
    if (offset === 0) continue;
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
          const type = weighted(
            typeRows.map((t) => [t, t.def.weight] as const),
          );
          const duration = type.def.duration;
          if (cursor + duration > minutesOf(end)) break;
          const patient =
            offset < 0
              ? pick(activePatients)
              : pick(
                  activePatients.filter(
                    (p) => !childIds.has(p.id) || chance(0.5),
                  ),
                );
          appointmentRows.push({
            id: nanoid(),
            patientId: patient.id,
            practitionerId,
            typeId: type.id,
            startsAt: at(day, hhmmOf(cursor)),
            endsAt: at(day, hhmmOf(cursor + duration)),
            reason: pick(type.def.reasons),
            notes: chance(0.1)
              ? pick([
                  "Patient anxieux.",
                  "Prévoir radiographie.",
                  "Rappeler la veille.",
                  "Accompagné d’un parent.",
                ])
              : null,
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
      a.status = weighted([
        ["completed", 78],
        ["canceled", 12],
        ["no_show", 10],
      ] as const);
    } else if (a.startsAt <= now) {
      a.status = "arrived";
    } else {
      a.status = weighted([
        ["planned", 50],
        ["confirmed", 40],
        ["canceled", 10],
      ] as const);
    }
  }
  // Today — the dashboard's day (prompts/22). Placed relative to the seeding
  // instant, on a 15-minute grid, so it reads as a clinic in mid-day whatever
  // the hour: settled appointments END before now, two patients are in the
  // waiting room (prompts/24), the rest is booked later today, one is canceled. Each
  // practitioner keeps their own lane, so nothing overlaps (the exclusion
  // constraint). Bookings are allowed outside hours (08-clinical.md §4 rule
  // 7), so this holds on a Sunday or a closure too. A slot that would start
  // outside today — a run close to midnight — is skipped, never moved to
  // another day.
  const SLOT_MS = 15 * 60_000;
  const pivot = new Date(Math.floor(now.getTime() / SLOT_MS) * SLOT_MS); // ≤ now
  const todayStart = at(today, "00:00");
  const tomorrowStart = at(clinicDay(1), "00:00");
  const TODAY_PLAN: [
    lane: 0 | 1,
    startMinutes: number,
    durationMinutes: number,
    status: NonNullable<NewAppointment["status"]>,
  ][] = [
    [0, -150, 30, "completed"],
    [0, -75, 30, "completed"],
    [0, -30, 30, "no_show"],
    [0, 0, 30, "arrived"],
    [0, 45, 30, "confirmed"],
    [0, 90, 45, "planned"],
    [1, -120, 45, "completed"],
    [1, -60, 45, "completed"],
    [1, -15, 30, "arrived"],
    [1, 15, 30, "canceled"],
    [1, 60, 30, "confirmed"],
    [1, 105, 45, "planned"],
  ];
  const todayPatients = shuffle(
    activePatients.filter((p) => !childIds.has(p.id)),
  );
  TODAY_PLAN.forEach(([lane, startMinutes, duration, status], index) => {
    const startsAt = new Date(pivot.getTime() + startMinutes * 60_000);
    if (startsAt < todayStart || startsAt >= tomorrowStart) return;
    const type =
      typeRows.find((t) => t.def.duration === duration) ?? typeRows[0];
    appointmentRows.push({
      id: nanoid(),
      patientId: todayPatients[index % todayPatients.length].id,
      practitionerId: dentistIds[lane],
      typeId: type.id,
      startsAt,
      endsAt: new Date(startsAt.getTime() + duration * 60_000),
      reason: pick(type.def.reasons),
      notes: null,
      status,
      createdByStaffId: pick([STAFF.secretary.id, STAFF.assistant.id]),
      createdAt: at(clinicDay(-int(1, 20)), "10:00"),
    });
  });

  // Guarantee every status is represented whatever the hour the seed runs at.
  const upcoming = appointmentRows.filter(
    (a) => a.startsAt > now && a.status !== "canceled",
  );
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
      const target =
        appointmentRows.find(
          (a) =>
            a.endsAt <= now &&
            a.status !== "completed" &&
            a.status !== "no_show",
        ) ?? appointmentRows.find((a) => a.endsAt <= now);
      if (target) target.status = status;
    }
  }

  // The waiting room (prompts/24), relative to the seeding instant. Today's
  // arrivals, earliest booking first, came in 27 then 12 minutes ago — one
  // already past the warning threshold, one not. Any other arrived row (the
  // guarantee above, near midnight) arrived at its start.
  const WAITING_MINUTES_AGO = [27, 12];
  appointmentRows
    .filter(
      (a) =>
        a.status === "arrived" &&
        a.startsAt >= todayStart &&
        a.startsAt < tomorrowStart,
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .forEach((a, index) => {
      const minutesAgo = WAITING_MINUTES_AGO[index];
      if (minutesAgo !== undefined) {
        a.arrivedAt = new Date(now.getTime() - minutesAgo * 60_000);
      }
    });
  // An arrival never closed yesterday: still `arrived`, NOT in today's
  // waiting room. 07:30 is before every session, so it overlaps nothing; it
  // is added after the status guarantees so none of them can rewrite it.
  const yesterday = clinicDay(-1);
  const staleType = typeRows.find((t) => t.def.duration === 30) ?? typeRows[0];
  appointmentRows.push({
    id: nanoid(),
    patientId: pick(activePatients).id,
    practitionerId: dentistIds[0],
    typeId: staleType.id,
    startsAt: at(yesterday, "07:30"),
    endsAt: at(yesterday, "08:00"),
    reason: pick(staleType.def.reasons),
    notes: null,
    status: "arrived",
    arrivedAt: at(yesterday, "07:20"),
    createdByStaffId: STAFF.secretary.id,
    createdAt: at(clinicDay(-int(2, 20)), "10:00"),
  });
  // The CHECK `appointments_arrived_at_matches_status`: every arrived row
  // has its arrival.
  for (const a of appointmentRows) {
    if (a.status === "arrived" && !a.arrivedAt) {
      a.arrivedAt = a.startsAt < now ? a.startsAt : now;
    }
  }

  // Treatments — 2–6 per active patient, label + price snapshotted from the service.
  const completedByPatient = new Map<string, NewAppointment[]>();
  for (const a of appointmentRows) {
    if (a.status !== "completed") continue;
    completedByPatient.set(a.patientId, [
      ...(completedByPatient.get(a.patientId) ?? []),
      a,
    ]);
  }
  const treatmentRows: NewTreatment[] = [];
  for (const patient of activePatients) {
    const eligible = serviceRows.filter((s) =>
      childIds.has(patient.id) ? s.def.child : !s.def.childOnly,
    );
    const visits = completedByPatient.get(patient.id) ?? [];
    for (let n = int(2, 6); n > 0; n--) {
      const service = weighted(
        eligible.map((s) => [s, CATEGORY_WEIGHT[s.def.category]] as const),
      );
      const status = weighted([
        ["completed", 55],
        ["in_progress", 15],
        ["planned", 22],
        ["canceled", 8],
      ] as const);
      const visit =
        status !== "planned" && visits.length > 0 && chance(0.8)
          ? pick(visits)
          : null;
      const performedAt =
        status === "planned"
          ? null
          : visit
            ? visit.startsAt
            : workingInstant(clinicDay(-int(1, 90)));
      treatmentRows.push({
        id: nanoid(),
        patientId: patient.id,
        appointmentId: visit?.id ?? null,
        serviceId: service.id,
        practitionerId:
          (visit?.practitionerId as string | undefined) ?? pick(dentistIds),
        label: service.row.label,
        // Snapshot, like label and price (prompts/19-actes.md).
        nomenclatureCode: service.row.nomenclatureCode,
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

  // Every case the actes screens must render, whatever the dice gave — fixed
  // up BEFORE payments are built, so the balances stay consistent.
  const adultActs = treatmentRows.filter((t) => !childIds.has(t.patientId));
  const unused = (t: NewTreatment) => !guaranteed.has(t.id);
  const guaranteed = new Set<string>();
  const ensure = (
    holds: (t: NewTreatment) => boolean,
    candidate: (t: NewTreatment) => boolean,
    apply: (t: NewTreatment) => void,
  ) => {
    const found = treatmentRows.find(holds);
    if (found) {
      guaranteed.add(found.id);
      return;
    }
    const target = adultActs.find((t) => unused(t) && candidate(t));
    if (!target) throw new Error("Seed: no acte to guarantee a case on");
    apply(target);
    guaranteed.add(target.id);
  };
  ensure(
    (t) => t.status === "canceled",
    (t) => t.status === "completed",
    (t) => {
      t.status = "canceled";
      t.notes = "Annulé à la demande du patient.";
    },
  );
  ensure(
    (t) => t.status === "planned",
    (t) => t.status === "completed" && !t.appointmentId,
    (t) => {
      t.status = "planned";
      t.performedAt = null;
    },
  );
  ensure(
    (t) => (t.teeth as string[]).length === 0,
    () => true,
    (t) => {
      t.teeth = [];
    },
  );
  ensure(
    (t) =>
      !!t.appointmentId &&
      appointmentRows.some(
        (a) => a.id === t.appointmentId && a.status === "completed",
      ),
    (t) =>
      t.status === "completed" && (completedByPatient.get(t.patientId) ?? []).length > 0,
    (t) => {
      const visit = completedByPatient.get(t.patientId)![0];
      t.appointmentId = visit.id;
      t.practitionerId = visit.practitionerId;
      t.performedAt = visit.startsAt;
      t.createdAt = visit.startsAt;
    },
  );
  // Exactly two adjacent teeth, priced per tooth — «Dent 26, Dent 27».
  ensure(
    (t) => (t.teeth as string[]).length === 2,
    (t) => t.status === "completed" && (t.teeth as string[]).length === 1,
    (t) => {
      t.teeth = ["26", "27"];
      t.totalAmountCents *= 2;
    },
  );

  // A patient's file is opened before their first appointment or acte.
  for (const patient of patientRows) {
    const firstActivity = [
      ...appointmentRows
        .filter((a) => a.patientId === patient.id)
        .map((a) => a.createdAt as Date),
      ...treatmentRows
        .filter((t) => t.patientId === patient.id)
        .map((t) => t.createdAt as Date),
    ].sort((a, b) => a.getTime() - b.getTime())[0];
    if (firstActivity && firstActivity < (patient.createdAt as Date)) {
      // Back-date through workingInstant so the file is opened on an open day, in opening hours.
      const firstDay = new TZDate(firstActivity.getTime(), CLINIC_TIMEZONE);
      patient.createdAt = workingInstant(addDays(firstDay, -int(1, 30)));
    }
  }

  // Payments — full, partial, unpaid, and overpaid («Avance») accounts.
  // Built against the BILLABLE total only (in progress + completed, the rule
  // of src/database/sql/billable.ts), never against planned or canceled
  // actes. EXACTLY TWO patients end in «Avance», deliberately — the first two
  // payers below; everyone else ends between 0 and their billable total.
  // Asserted after the batch is built.
  const paymentRows: NewPayment[] = [];
  const METHODS = [
    ["cash", 55],
    ["card", 18],
    ["check", 17],
    ["transfer", 10],
  ] as const;
  const referenceFor = (method: NewPayment["method"]) =>
    method === "check"
      ? `Chèque n° ${digits(7)}`
      : method === "transfer"
        ? `VIR-${digits(8)}`
        : method === "card"
          ? `TPE ${digits(6)}`
          : method === "insurance"
            ? `Dossier n° ${digits(8)}`
            : null;
  const paidAfter = (performedAt: Date) => {
    const from = Math.max(0, differenceInCalendarDays(performedAt, today) * -1);
    return notAfterNow(workingInstant(clinicDay(-int(0, Math.min(from, 20)))));
  };
  const pay = (p: Omit<NewPayment, "reference" | "createdByStaffId">) =>
    paymentRows.push({
      ...p,
      reference: referenceFor(p.method),
      createdByStaffId: STAFF.secretary.id,
    });

  const billable = (patientId: string) =>
    treatmentRows.filter(
      (t) =>
        t.patientId === patientId &&
        (t.status === "completed" || t.status === "in_progress"),
    );
  const payers = shuffle(
    activePatients.filter((p) => billable(p.id).length > 0),
  );
  let insuranceCount = 0;
  payers.forEach((patient, i) => {
    const acts = billable(patient.id);
    const profile =
      i < 2
        ? "overpaid"
        : i < 2 + payers.length * 0.4
          ? "full"
          : i < 2 + payers.length * 0.72
            ? "partial"
            : "unpaid";
    if (profile === "unpaid") return;

    const settled =
      profile === "partial"
        ? acts.slice(0, Math.max(0, acts.length - 1))
        : acts;
    for (const act of settled) {
      const paidAt = paidAfter(act.performedAt as Date);
      const insurer =
        patient.insurerId && (insuranceCount < 3 || chance(0.08))
          ? patient.insurerId
          : null;
      if (insurer) {
        // The insurer reimburses part of the acte; the patient pays the rest.
        insuranceCount++;
        const reimbursed = roundDH(act.totalAmountCents * 0.6, 10);
        pay({
          patientId: patient.id,
          treatmentId: act.id,
          amountCents: act.totalAmountCents - reimbursed,
          method: weighted(METHODS),
          paidAt,
        });
        pay({
          patientId: patient.id,
          treatmentId: act.id,
          insurerId: insurer,
          amountCents: reimbursed,
          method: "insurance",
          paidAt: notAfterNow(
            workingInstant(
              clinicDay(
                Math.min(
                  0,
                  differenceInCalendarDays(paidAt, today) + int(7, 21),
                ),
              ),
            ),
          ),
        });
      } else if (act.totalAmountCents >= 300000) {
        // Large actes are paid in two instalments.
        const first = roundDH(act.totalAmountCents / 2, 100);
        pay({
          patientId: patient.id,
          treatmentId: act.id,
          amountCents: first,
          method: weighted(METHODS),
          paidAt,
        });
        pay({
          patientId: patient.id,
          treatmentId: act.id,
          amountCents: act.totalAmountCents - first,
          method: weighted(METHODS),
          paidAt: paidAfter(paidAt),
        });
      } else {
        pay({
          patientId: patient.id,
          treatmentId: act.id,
          amountCents: act.totalAmountCents,
          method: weighted(METHODS),
          paidAt,
        });
      }
    }
    if (profile === "partial") {
      // An unallocated deposit on the last, unsettled acte.
      const open = acts[acts.length - 1];
      const deposit = roundDH(open.totalAmountCents * 0.4, 50);
      if (deposit > 0) {
        pay({
          patientId: patient.id,
          amountCents: deposit,
          method: "cash",
          paidAt: paidAfter(open.performedAt as Date),
          notes: "Acompte",
        });
      }
    }
    if (profile === "overpaid") {
      // Paid ahead of the treatment plan: exceeds every non-canceled acte, planned ones included.
      const planned = treatmentRows
        .filter((t) => t.patientId === patient.id && t.status === "planned")
        .reduce((sum, t) => sum + t.totalAmountCents, 0);
      pay({
        patientId: patient.id,
        amountCents: planned + 100000,
        method: "cash",
        paidAt: workingInstant(clinicDay(-int(1, 10))),
        notes: "Avance sur plan de traitement",
      });
    }
  });

  // Today's takings (prompts/22): at least three payments dated today, before
  // now, one of them an insurance reimbursement. Only `paidAt` moves — no
  // amount — so every balance, the two «Avance» patients included, stays
  // exactly as built above.
  const paidToday = (p: NewPayment) =>
    (p.paidAt as Date) >= todayStart && (p.paidAt as Date) <= now;
  const todayPaidAt = (step: number) =>
    new Date(Math.max(todayStart.getTime(), now.getTime() - (step + 1) * 37 * 60_000));
  const moveToToday = (holds: (p: NewPayment) => boolean, step: number) => {
    if (paymentRows.some((p) => paidToday(p) && holds(p))) return;
    const target = [...paymentRows].reverse().find((p) => !paidToday(p) && holds(p));
    if (target) target.paidAt = todayPaidAt(step);
  };
  moveToToday((p) => p.method === "insurance", 0);
  moveToToday((p) => p.method === "cash", 1);
  moveToToday((p) => p.method === "card" || p.method === "check", 2);

  // Expenses — a cabinet in Agadir, the current month and the two before,
  // spread across every category. `spentAt` is a clinic DATE stored as the
  // clinic-midnight instant of that day (prompts/26, decision 3) — the same
  // conversion the form uses, so a seeded charge reads exactly like a typed
  // one. Days later than today are skipped: the current month is partial.
  const expenseRows: (typeof expenses.$inferInsert)[] = [];
  for (let m = 0; m < 3; m++) {
    const month = startOfMonth(addMonths(today, -m));
    const spend = (
      dayOfMonth: number,
      row: Omit<typeof expenses.$inferInsert, "spentAt" | "createdByStaffId">,
    ) => {
      // «Le 30» in February is its last day, never 1–2 March.
      const lastDay = getDaysInMonth(month);
      const day = addDays(month, Math.min(dayOfMonth, lastDay) - 1);
      if (day > today) return;
      expenseRows.push({
        ...row,
        spentAt: clinicInstant(dayKey(day)),
        createdByStaffId: adminId,
      });
    };
    spend(2, {
      label: "Loyer du cabinet",
      category: "rent",
      amountCents: 800000,
      supplier: "SCI Résidence Souss",
    });
    spend(28, {
      label: "Salaire assistante dentaire",
      category: "salaries",
      amountCents: 450000,
      supplier: null,
    });
    spend(30, {
      label: "Salaire secrétaire médicale",
      category: "salaries",
      amountCents: 400000,
      supplier: null,
    });
    spend(10, {
      label: "Cotisations CNSS employeur",
      category: "taxes",
      amountCents: int(170000, 185000),
      supplier: "CNSS",
    });
    spend(12, {
      label: "Facture d’électricité",
      category: "utilities",
      amountCents: int(90000, 140000),
      supplier: "ONEE",
    });
    spend(12, {
      label: "Facture d’eau",
      category: "utilities",
      amountCents: int(15000, 25000),
      supplier: "RAMSA",
    });
    spend(5, {
      label: "Internet et téléphone",
      category: "utilities",
      amountCents: 49900,
      supplier: "Maroc Telecom",
    });
    spend(int(3, 9), {
      label: "Consommables (gants, compresses, aspiration)",
      category: "supplies",
      amountCents: int(150000, 300000),
      supplier: "Souss Dental Distribution",
    });
    spend(int(15, 22), {
      label: "Composites et anesthésiques",
      category: "supplies",
      amountCents: int(200000, 400000),
      supplier: "Atlas Médical Fournitures",
    });
    spend(int(18, 26), {
      label: "Travaux de prothèse (couronnes, bridges)",
      category: "lab",
      amountCents: int(250000, 600000),
      supplier: "Laboratoire Prothèse Argana",
    });
  }
  const oneOff = (
    offset: number,
    row: Omit<typeof expenses.$inferInsert, "spentAt" | "createdByStaffId">,
  ) =>
    expenseRows.push({
      ...row,
      spentAt: clinicInstant(dayKey(clinicDay(offset))),
      createdByStaffId: adminId,
    });
  oneOff(-64, {
    label: "Lampe à photopolymériser LED",
    category: "equipment",
    amountCents: 350000,
    supplier: "Atlas Médical Fournitures",
  });
  oneOff(-41, {
    label: "Révision annuelle du compresseur",
    category: "maintenance",
    amountCents: 120000,
    supplier: "Souss Technique Dentaire",
    notes: "Contrat de maintenance 2026",
  });
  oneOff(-23, {
    label: "Taxe professionnelle",
    category: "taxes",
    amountCents: 250000,
    supplier: "Commune d’Agadir",
  });
  oneOff(-9, {
    label: "Blouses et tenues du personnel",
    category: "other",
    amountCents: 60000,
    supplier: null,
  });

  // Tasks — clinic-wide. Open: one overdue, one due today, important ones,
  // one without a date. Done over the last 6 weeks, two of them older than the
  // 30-day window so `/taches` exercises its cut. `completedAt` is set on every
  // done row: the CHECK `tasks_completed_at_matches_is_done` requires it.
  const due = (offset: number) => format(clinicDay(offset), "yyyy-MM-dd");
  const completed = (offset: number, hhmm: string) =>
    notAfterNow(at(clinicDay(offset), hhmm));
  const taskRows: (typeof tasks.$inferInsert)[] = [
    {
      content: "Relancer le laboratoire pour les couronnes en attente",
      dueDate: due(1),
      isImportant: true,
      isDone: false,
      createdByStaffId: adminId,
    },
    {
      content: "Rappeler le fournisseur : la livraison de composite est en retard",
      dueDate: due(-2),
      isImportant: false,
      isDone: false,
      createdByStaffId: STAFF.secretary.id,
    },
    {
      content: "Confirmer les rendez-vous de demain par téléphone",
      dueDate: due(0),
      isImportant: false,
      isDone: false,
      createdByStaffId: STAFF.secretary.id,
    },
    {
      content: "Commander des gants nitrile taille M et des compresses",
      dueDate: due(3),
      isImportant: false,
      isDone: false,
      createdByStaffId: STAFF.assistant.id,
    },
    {
      content: "Renouveler le contrat de maintenance de l’autoclave",
      dueDate: due(12),
      isImportant: true,
      isDone: false,
      createdByStaffId: adminId,
    },
    {
      content: "Mettre à jour l’affichage des tarifs en salle d’attente",
      dueDate: null,
      isImportant: false,
      isDone: false,
      createdByStaffId: STAFF.dentist.id,
    },
    {
      content: "Envoyer les dossiers de remboursement CNOPS du mois",
      dueDate: due(-3),
      isImportant: false,
      isDone: true,
      completedAt: completed(-2, "17:40"),
      createdByStaffId: STAFF.secretary.id,
    },
    {
      content: "Vérifier les dates de péremption des anesthésiques",
      dueDate: null,
      isImportant: false,
      isDone: true,
      completedAt: completed(-12, "11:20"),
      createdByStaffId: STAFF.assistant.id,
    },
    {
      content: "Faire réviser le compresseur",
      dueDate: due(-36),
      isImportant: true,
      isDone: true,
      completedAt: completed(-38, "15:05"),
      createdByStaffId: adminId,
    },
    {
      content: "Archiver les radiographies papier de l’année dernière",
      dueDate: null,
      isImportant: false,
      isDone: true,
      completedAt: completed(-41, "10:30"),
      createdByStaffId: STAFF.assistant.id,
    },
  ];

  // ── Dossier médical ──────────────────────────────────────────────────────
  // Its own random stream: drawing from `rand` here would reshuffle every
  // appointment, acte and payment the seed produced before this block existed.
  const mh = mulberry32(20261010);
  const mhInt = (min: number, max: number) =>
    min + Math.floor(mh() * (max - min + 1));
  const mhChance = (p: number) => mh() < p;
  const mhPick = <T>(items: readonly T[]): T =>
    items[Math.floor(mh() * items.length)];
  function mhWeighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = mh() * total;
    for (const [value, w] of entries) {
      r -= w;
      if (r < 0) return value;
    }
    return entries[entries.length - 1][0];
  }
  const mhDigits = (n: number) =>
    Array.from({ length: n }, () => mhInt(0, 9)).join("");
  const mhMobile = () => `+212${mhPick(["6", "7"])}${mhDigits(8)}`;
  const ageOf = (p: NewPatient) =>
    differenceInYears(today, parseISO(p.birthDate!));

  for (const p of patientRows) {
    if (!childIds.has(p.id) && mhChance(0.65))
      p.profession = mhPick(PROFESSIONS);
  }

  /** When the dossier was last saved: some day since the patient was created. */
  const savedAt = (p: NewPatient, maxDaysAgo: number) => {
    const age = Math.max(
      0,
      differenceInCalendarDays(today, p.createdAt as Date),
    );
    return notAfterNow(
      at(
        clinicDay(-mhInt(0, Math.min(age, maxDaysAgo))),
        hhmmOf(mhInt(9 * 60, 18 * 60)),
      ),
    );
  };

  const historyFor = (
    p: NewPatient,
    facts: HistoryFacts,
  ): NewMedicalHistory => {
    const isChild = childIds.has(p.id);
    const canBePregnant = p.gender === "female" && !isChild && ageOf(p) <= 45;
    const drawn = isChild
      ? []
      : BACKGROUND_CONDITIONS.filter(() => mhChance(0.06));
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
      anesthesiaReactions: mhChance(0.05)
        ? "Malaise vagal lors d’une anesthésie locale."
        : null,
      smoking: isChild
        ? "none"
        : mhWeighted([
            ["none", 70],
            ["occasional", 12],
            ["regular", 18],
          ] as const),
      bruxism: mhChance(0.15),
      bloodType: mhChance(0.6) ? mhWeighted(BLOOD_TYPES) : null,
      primaryDoctorName: mhChance(0.5) ? `Dr ${mhPick(LAST_NAMES)}` : null,
      primaryDoctorPhone: mhChance(0.5) ? `+2125288${mhDigits(5)}` : null,
      // A child's emergency contact is the other parent.
      emergencyContactName: hasContact
        ? `${mhPick(mhChance(0.5) ? FEMALE_FIRST : MALE_FIRST)} ${isChild ? p.lastName : mhPick(LAST_NAMES)}`
        : null,
      emergencyContactPhone: hasContact ? mhMobile() : null,
      emergencyContactRelation: hasContact
        ? isChild
          ? mhPick(["Mère", "Père"])
          : mhPick(ADULT_RELATIONS)
        : null,
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
  const noteFacts = (p: NewPatient) =>
    p.medicalNotes ? NOTE_FACTS[p.medicalNotes] : undefined;
  const noteDriven = adults.filter((p) => noteFacts(p) !== undefined);
  const filled = [
    ...noteDriven,
    ...shuffle(adults.filter((p) => !noteDriven.includes(p))).slice(
      0,
      Math.max(0, target - noteDriven.length),
    ),
  ];
  const historyRows = new Map<string, NewMedicalHistory>();
  for (const p of filled)
    historyRows.set(p.id, historyFor(p, noteFacts(p) ?? {}));
  for (const p of patientRows) {
    if (childIds.has(p.id)) historyRows.set(p.id, historyFor(p, {}));
  }
  // A pregnancy note only becomes a pregnancy for a woman who can be pregnant.
  for (const p of noteDriven) {
    const row = historyRows.get(p.id)!;
    if (p.medicalNotes!.startsWith("Grossesse") && row.isPregnant === false) {
      const recordedAt = savedAt(p, 14);
      Object.assign(row, {
        isPregnant: true,
        pregnancyWeeks: mhInt(10, 24),
        createdAt: recordedAt,
        updatedAt: recordedAt,
      });
    }
  }

  // Guarantee one active patient per header pill, so each can be checked on
  // screen. A pregnancy is recorded recently, so its aged term stays plausible.
  const isActive = (patientId: string) =>
    activePatients.some((p) => p.id === patientId);
  const guarantee = (
    holds: (h: NewMedicalHistory) => boolean,
    eligible: (p: NewPatient) => boolean,
    facts: HistoryFacts,
  ) => {
    if (
      [...historyRows.values()].some((h) => holds(h) && isActive(h.patientId))
    )
      return;
    const candidate = activePatients.find((p) => {
      const h = historyRows.get(p.id);
      // One critical flag per guaranteed patient, so each pill is seen alone too.
      const isFlagged =
        !!h &&
        (!!h.onAnticoagulants ||
          !!h.onBisphosphonates ||
          !!h.needsAntibioticProphylaxis ||
          h.isPregnant === true);
      return !childIds.has(p.id) && !isFlagged && eligible(p);
    });
    if (!candidate)
      throw new Error(
        "Seed : aucun patient éligible pour une alerte médicale garantie.",
      );
    const existing = historyRows.get(candidate.id) ?? historyFor(candidate, {});
    historyRows.set(candidate.id, {
      ...existing,
      ...facts,
      conditions: [
        ...new Set([
          ...(existing.conditions ?? []),
          ...(facts.conditions ?? []),
        ]),
      ],
    });
  };
  guarantee(
    (h) => !!h.onAnticoagulants,
    () => true,
    {
      onAnticoagulants: true,
      conditions: ["heart_disease"],
      currentMedications: "Acénocoumarol (Sintrom) 4 mg, dose adaptée à l’INR",
    },
  );
  guarantee(
    (h) => !!h.needsAntibioticProphylaxis,
    () => true,
    {
      needsAntibioticProphylaxis: true,
      conditions: ["heart_disease"],
    },
  );
  guarantee(
    (h) => !!h.onBisphosphonates,
    (p) => ageOf(p) >= 55,
    {
      onBisphosphonates: true,
      conditions: ["osteoporosis"],
      currentMedications: "Alendronate 70 mg, 1 fois par semaine",
    },
  );
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

  // Balances per patient, checked BEFORE anything is written.
  const billed = new Map<string, number>();
  for (const t of treatmentRows) {
    if (t.status === "completed" || t.status === "in_progress") {
      billed.set(
        t.patientId,
        (billed.get(t.patientId) ?? 0) + t.totalAmountCents,
      );
    }
  }
  const paid = new Map<string, number>();
  for (const p of paymentRows)
    paid.set(p.patientId, (paid.get(p.patientId) ?? 0) + p.amountCents);
  const overpaid = [...paid]
    .filter(([id, amount]) => amount > (billed.get(id) ?? 0))
    .map(([id]) => id);
  // The cases /paiements and the dossier must render, whatever the dice gave.
  if (overpaid.length !== 2) {
    throw new Error(`Seed: ${overpaid.length} patients en avance, 2 attendus`);
  }
  if (
    !paymentRows.some((p) => p.method === "insurance" && p.insurerId) ||
    !paymentRows.some((p) => p.method === "check" && p.reference) ||
    !paymentRows.some((p) => p.treatmentId) ||
    !paymentRows.some((p) => !p.treatmentId) ||
    paymentRows.some(
      (p) => p.amountCents <= 0 || (p.method === "insurance") !== !!p.insurerId,
    )
  ) {
    throw new Error("Seed: paiements incohérents avec les règles de la branche 20");
  }

  // The dashboard's day (prompts/22), whatever the dice and the hour gave.
  const todayAppointments = appointmentRows.filter(
    (a) => a.startsAt >= todayStart && a.startsAt < tomorrowStart,
  );
  const todayPractitioners = new Set(
    todayAppointments.map((a) => a.practitionerId),
  );
  const positiveBalances = [...billed]
    .map(([id, amount]) => amount - (paid.get(id) ?? 0))
    .filter((remaining) => remaining > 0);
  const todayPayments = paymentRows.filter(paidToday);
  const waitingToday = todayAppointments.filter((a) => a.status === "arrived");
  if (
    todayAppointments.length < 6 ||
    waitingToday.length !== 2 ||
    !appointmentRows.some(
      (a) => a.status === "arrived" && a.startsAt < todayStart,
    ) ||
    todayPractitioners.size < 2 ||
    !todayPayments.some((p) => p.method === "insurance") ||
    new Set(positiveBalances).size < 5
  ) {
    throw new Error("Seed: la journée du tableau de bord est incomplète");
  }

  // ── Documents (prompts/21) ────────────────────────────────────────────────
  // Generated through the documents slice's OWN snapshot builder, numbering
  // and file-name rules, so a seeded facture is a real one. Every table is
  // truncated above, so the numbering restarts at 0001 on each run.
  // One facture shows an «Avance»; one is a partial selection; two devis.
  const documentRows: (typeof documents.$inferInsert)[] = [];
  const issuedNumbers: string[] = [];
  const staffById = new Map(staffRows.map((s) => [s.id, s]));
  const isBilled = (t: NewTreatment) =>
    t.status === "completed" || t.status === "in_progress";

  const addDocument = (
    type: DocumentType.Invoice | DocumentType.Quote,
    patient: NewPatient,
    lines: NewTreatment[],
    issuedAt: Date,
  ) => {
    const number = nextDocumentNumber(type, issuedAt, issuedNumbers);
    issuedNumbers.push(number);
    const practitioner = staffById.get(pickPractitionerId(
      lines.map((t) => ({ practitionerId: t.practitionerId ?? null })),
      adminId,
    ))!;
    const billedCents = billed.get(patient.id) ?? 0;
    const paidCents = paid.get(patient.id) ?? 0;
    const base = {
      number,
      issuedAt,
      clinic: {
        name: clinic.name,
        address: clinic.address ?? null,
        city: clinic.city ?? null,
        phone: clinic.phone ?? null,
        email: clinic.email ?? null,
        ice: clinic.ice ?? null,
        patente: clinic.patente ?? null,
        fiscalId: clinic.fiscalId ?? null,
        cnssNumber: clinic.cnssNumber ?? null,
        inpe: clinic.inpe ?? null,
        logoUrl: clinic.logoUrl ?? null,
      },
      patient: {
        id: patient.id,
        shortCode: patient.shortCode,
        firstName: patient.firstName,
        lastName: patient.lastName,
        cin: patient.cin ?? null,
        phone: patient.phone,
      },
      practitioner: {
        name: practitioner.name,
        title: practitioner.title ?? null,
        inpe: practitioner.inpe ?? null,
      },
      lines: lines.map((t) => ({
        id: t.id,
        performedAt: t.performedAt ?? null,
        createdAt: t.createdAt as Date,
        label: t.label,
        nomenclatureCode: t.nomenclatureCode ?? null,
        teeth: t.teeth as string[],
        totalAmountCents: t.totalAmountCents,
      })),
    };
    // The account as the SQL computes it: billable actes − payments.
    const input: BuildSnapshotInput =
      type === DocumentType.Invoice
        ? {
            ...base,
            type,
            account: {
              totalAmountCents: billedCents,
              amountPaidCents: paidCents,
              remainingCents: billedCents - paidCents,
            },
          }
        : {
            ...base,
            type,
            validUntil: toClinicDate(addDays(issuedAt, 30)),
          };
    documentRows.push({
      id: nanoid(),
      patientId: patient.id,
      type,
      number,
      fileName: buildDocumentFileName({
        type,
        firstName: patient.firstName,
        lastName: patient.lastName,
        issuedAt,
      }),
      storageUrl: null,
      snapshot: buildDocumentSnapshot(input) as Record<string, unknown>,
      generatedByStaffId: adminId,
      createdAt: issuedAt,
    });
  };

  const actsOf = (patientId: string, holds: (t: NewTreatment) => boolean) =>
    treatmentRows.filter((t) => t.patientId === patientId && holds(t));
  const patientById = new Map(patientRows.map((p) => [p.id, p]));
  // Issued in date order, so numbers and dates agree.
  const issuedOn = (daysAgo: number, hhmm: string) =>
    notAfterNow(at(clinicDay(-daysAgo), hhmm));

  const advancePatient = patientById.get(overpaid[0])!;
  const advanceActs = actsOf(advancePatient.id, isBilled);
  const owing = patientRows.filter(
    (p) =>
      !overpaid.includes(p.id) &&
      actsOf(p.id, isBilled).length >= 2 &&
      (billed.get(p.id) ?? 0) > (paid.get(p.id) ?? 0),
  );
  const planning = patientRows.filter(
    (p) => actsOf(p.id, (t) => t.status === "planned").length > 0,
  );
  if (advanceActs.length === 0 || owing.length < 2 || planning.length < 2) {
    throw new Error("Seed: pas assez d’actes pour générer les documents de démonstration");
  }

  addDocument(DocumentType.Invoice, owing[0], actsOf(owing[0].id, isBilled), issuedOn(12, "10:15"));
  addDocument(
    DocumentType.Quote,
    planning[0],
    actsOf(planning[0].id, (t) => t.status === "planned"),
    issuedOn(9, "11:40"),
  );
  // A partial selection: the first billable acte only.
  addDocument(DocumentType.Invoice, owing[1], actsOf(owing[1].id, isBilled).slice(0, 1), issuedOn(6, "16:05"));
  addDocument(
    DocumentType.Quote,
    planning[1],
    actsOf(planning[1].id, (t) => t.status === "planned"),
    issuedOn(3, "09:30"),
  );
  // The patient in credit: this facture must read «Avance».
  addDocument(DocumentType.Invoice, advancePatient, advanceActs, issuedOn(1, "17:20"));

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
    db
      .insert(services)
      .values(serviceRows.map((s) => ({ id: s.id, ...s.row }))),
    db
      .insert(appointmentTypes)
      .values(
        typeRows.map((t) => ({
          id: t.id,
          label: t.def.label,
          color: t.def.color,
          defaultDurationMinutes: t.def.duration,
        })),
      ),
    db.insert(practitionerSchedules).values(scheduleRows),
    db.insert(scheduleExceptions).values(exceptionRows),
    db.insert(patients).values(patientRows),
    db.insert(patientTags).values(patientTagRows),
    db.insert(medicalHistories).values(medicalHistoryRows),
    db.insert(appointments).values(appointmentRows),
    db.insert(treatments).values(treatmentRows),
    db.insert(payments).values(paymentRows),
    db.insert(documents).values(documentRows),
    db.insert(expenses).values(expenseRows),
    db.insert(tasks).values(taskRows),
  ];
  // SEED_DRY_RUN=1 builds and checks everything, writes nothing.
  const isDryRun = process.env.SEED_DRY_RUN === "1";
  if (!isDryRun) await db.batch(queries);

  // Counts and ids only — never a patient name (08-clinical.md §6).
  const statusCounts = appointmentRows.reduce<Record<string, number>>(
    (acc, a) => {
      acc[a.status!] = (acc[a.status!] ?? 0) + 1;
      return acc;
    },
    {},
  );

  console.log(isDryRun ? "Seed (essai, rien n’est écrit) :" : "Seed terminé :");
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
    documents: documentRows.length,
    insurancePayments: paymentRows.filter((p) => p.method === "insurance")
      .length,
    expenses: expenseRows.length,
    tasks: taskRows.length,
  });
  console.log("Statuts des rendez-vous :", statusCounts);
  console.log("Patients en avance (ids) :", overpaid);
  // The dashboard's day — counts only.
  console.log("Tableau de bord, aujourd’hui :", {
    rendezVous: todayAppointments.reduce<Record<string, number>>((acc, a) => {
      acc[a.status!] = (acc[a.status!] ?? 0) + 1;
      return acc;
    }, {}),
    salleDAttente: waitingToday.map((a) =>
      Math.round((now.getTime() - a.arrivedAt!.getTime()) / 60_000),
    ),
    praticiens: todayPractitioners.size,
    paiements: todayPayments.length,
    paiementsAssurance: todayPayments.filter((p) => p.method === "insurance")
      .length,
    soldesPositifsDistincts: new Set(positiveBalances).size,
  });
  // Numbers and ids only — never a patient name.
  console.log(
    "Documents (numéro → patient id) :",
    documentRows.map((d) => `${d.number} → ${d.patientId}`),
  );
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
