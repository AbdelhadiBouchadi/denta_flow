import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

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

interface GeneratedAvatarProps {
  /** Full name — the initials and the colour are both derived from it. */
  seed: string;
  className?: string;
}

const GeneratedAvatar = ({ seed, className }: GeneratedAvatarProps) => {
  const palette = AVATAR_PALETTE[hashSeed(seed) % AVATAR_PALETTE.length];

  return (
    <Avatar className={className}>
      <AvatarFallback className={cn("font-medium", palette)}>
        {getInitials(seed)}
      </AvatarFallback>
    </Avatar>
  );
};

export default GeneratedAvatar;
