/**
 * Phone numbers as WhatsApp needs them (prompts/33, decision 5). Pure, and
 * never applied to the stored `patients.phone`: the dossier keeps what staff
 * typed, and only the send path reads it through here.
 */

export type WhatsAppNumber =
  | { ok: true; digits: string }
  | { ok: false; reason: "fixe" | "invalide" };

const SEPARATORS = /[\s.\-()]/g;
const MOROCCAN_MOBILE = /^212[67]\d{8}$/;
const MOROCCAN_LANDLINE = /^212[58]\d{8}$/;

/**
 * `+212 6…`, `00212 6…`, `212 6…` and the national `06…` / `07…` all become
 * `2126…` (212 + 9 digits). Moroccan landlines (`05…`, `08…`) are refused
 * `fixe` — WhatsApp runs on mobiles. Another country's `+` number passes when
 * it has an E.164 length (8–15 digits). Anything else is `invalide`.
 */
export const toWhatsAppNumber = (raw: string): WhatsAppNumber => {
  const compact = raw.trim().replace(SEPARATORS, "");
  if (compact === "") return { ok: false, reason: "invalide" };

  let digits: string;
  let international: boolean;
  if (compact.startsWith("+")) {
    digits = compact.slice(1);
    international = true;
  } else if (compact.startsWith("00")) {
    digits = compact.slice(2);
    international = true;
  } else if (/^0[5-8]\d{8}$/.test(compact)) {
    digits = `212${compact.slice(1)}`;
    international = false;
  } else {
    digits = compact;
    international = compact.startsWith("212");
  }

  if (!/^\d+$/.test(digits)) return { ok: false, reason: "invalide" };

  if (digits.startsWith("212")) {
    if (MOROCCAN_MOBILE.test(digits)) return { ok: true, digits };
    if (MOROCCAN_LANDLINE.test(digits)) return { ok: false, reason: "fixe" };
    return { ok: false, reason: "invalide" };
  }

  if (international && digits.length >= 8 && digits.length <= 15) {
    return { ok: true, digits };
  }
  return { ok: false, reason: "invalide" };
};

/**
 * What a screen may show of a number: «06 ** ** ** 78» for a Moroccan
 * mobile, the first and last two digits otherwise. Never the full number.
 */
export const maskPhone = (raw: string): string => {
  const parsed = toWhatsAppNumber(raw);
  const compact = raw.replace(/\D/g, "");
  if (parsed.ok && parsed.digits.startsWith("212")) {
    const national = `0${parsed.digits.slice(3)}`;
    return `${national.slice(0, 2)} ** ** ** ${national.slice(-2)}`;
  }
  if (compact.length < 4) return "**";
  return `${compact.slice(0, 2)} ** ** ${compact.slice(-2)}`;
};

/** `https://wa.me/<digits>?text=<encoded>` — the manual fallback. */
export const waMeLink = (digits: string, text: string) =>
  `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
