import { personas } from "@dicebear/collection";
import { createAvatar, type Style, type StyleOptions } from "@dicebear/core";
import { differenceInYears, parseISO } from "date-fns";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { clinicNow } from "@/lib/time";
import { cn } from "@/lib/utils";

/**
 * The option type is inferred from the installed style rather than written out,
 * so a DiceBear upgrade that renames a value fails the typecheck instead of
 * silently falling back to the full default set.
 */
type PersonasOptions =
  typeof personas extends Style<infer O> ? StyleOptions<O> : never;

/**
 * Below this age the illustration is not used at all: the personas style draws
 * adults, and the one child-ish cue it has — the `pacifier` mouth — lands on
 * teenagers as readily as on infants.
 */
const ADULT_AVATAR_AGE = 18;

/**
 * Every value below is taken from the installed schema
 * (`node_modules/@dicebear/personas/lib/types.d.ts`), not from memory.
 *
 * `pacifier` is dropped from both mouths and `sleep` from both eye sets: a
 * dental record is not the place for a patient who appears to be asleep or
 * still on a dummy.
 */
const SHARED_TRAITS: PersonasOptions = {
  eyes: ["open", "happy", "wink", "glasses", "sunglasses"],
  body: ["squared", "rounded", "checkered"],
};

const MASCULINE_TRAITS: PersonasOptions = {
  ...SHARED_TRAITS,
  hair: [
    "shortCombover",
    "shortComboverChops",
    "buzzcut",
    "fade",
    "curlyHighTop",
    "balding",
    "bald",
    "mohawk",
    "cap",
    "beanie",
  ],
  facialHair: ["beardMustache", "goatee", "shadow", "soulPatch", "walrus"],
  facialHairProbability: 45,
  mouth: ["smile", "bigSmile", "smirk", "frown", "surprise"],
  nose: ["mediumRound", "smallRound", "wrinkles"],
};

const FEMININE_TRAITS: PersonasOptions = {
  ...SHARED_TRAITS,
  hair: [
    "long",
    "extraLong",
    "bobCut",
    "bobBangs",
    "curly",
    "curlyBun",
    "straightBun",
    "pigtails",
    "bunUndercut",
    "sideShave",
  ],
  facialHairProbability: 0,
  mouth: ["smile", "bigSmile", "smirk", "lips", "frown"],
  nose: ["mediumRound", "smallRound"],
};

// Token pairs only — no raw colour values (AGENTS #32).
const AVATAR_PALETTE = [
  "bg-teal-light text-teal-dark",
  "bg-success-subtle text-success-strong",
  "bg-warning-subtle text-warning-strong",
  "bg-info-subtle text-info-strong",
  "bg-muted text-muted-foreground",
] as const;

/**
 * FNV-1a. Deterministic and dependency-free: the server and the client must
 * derive the same colour from the same seed or hydration mismatches.
 */
function hashSeed(seed: string) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function getInitials(seed: string) {
  const words = seed.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : "";
  return `${first}${last}`.toLocaleUpperCase("fr-FR");
}

/**
 * Whole years on the clinic's wall clock. The patients slice's `getPatientAge`
 * applies the same rule for the «(9 ans)» the dossier prints; this copy stays
 * here because a shared component must not import from a slice (05-slice.md §6).
 */
function getAge(birthDate: string | null | undefined) {
  if (!birthDate) return null;
  const parsed = parseISO(birthDate);
  if (Number.isNaN(parsed.getTime())) return null;
  const age = differenceInYears(clinicNow(), parsed);
  return age >= 0 ? age : null;
}

/**
 * A deterministic avatar, generated at render time — no network, no upload, no
 * storage.
 *
 * `seed` should be a **stable identifier**, not a display name: a patient
 * marrying and changing surname must keep the same face, or the staff member
 * who recognises the dossier by its picture loses that cue.
 *
 * An illustrated persona is drawn only for an adult of known sex. A child, or
 * a record whose birth date or sex has not been entered, gets the initials
 * disc instead: guessing a face from a seed alone produced a nine-year-old girl
 * with a beard, which is worse than no picture at all.
 */
interface GeneratedAvatarProps {
  /** Stable identifier — a record id. Never a name. */
  seed: string;
  /** Display name, used for the initials. Defaults to the seed. */
  name?: string;
  /** ISO "yyyy-MM-dd". With `gender`, unlocks the illustrated persona. */
  birthDate?: string | null;
  gender?: "male" | "female" | null;
  className?: string;
}

const GeneratedAvatar = ({
  seed,
  name,
  birthDate,
  gender,
  className,
}: GeneratedAvatarProps) => {
  const initials = getInitials(name ?? seed);
  const age = getAge(birthDate);
  const traits =
    age !== null && age >= ADULT_AVATAR_AGE
      ? gender === "male"
        ? MASCULINE_TRAITS
        : gender === "female"
          ? FEMININE_TRAITS
          : null
      : null;

  if (!traits) {
    const palette = AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length];

    return (
      <Avatar className={className}>
        <AvatarFallback className={cn("font-medium", palette)}>
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }

  // Deterministic, so the server and the client produce the same data URI and
  // hydration matches.
  const src = createAvatar(personas, { seed, ...traits }).toDataUri();

  return (
    <Avatar className={cn("bg-muted ring-border ring-1", className)}>
      {/* Decorative: the patient's name is always written beside it. */}
      <AvatarImage src={src} alt="" />
      <AvatarFallback className="font-medium">{initials}</AvatarFallback>
    </Avatar>
  );
};

export default GeneratedAvatar;
