import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { toClinicTime } from "@/lib/time";
import { CHIP_SAMPLES } from "./constants";
import { MessageChip } from "./types";

/**
 * The five values a message may carry (prompts/33, decision 1; the
 * editor's chips since 33b) — and NOTHING else: no surname, no treatment, no practitioner,
 * no amount. Date and time are read on the clinic's wall clock.
 */
export interface MessageParams {
  /** «Prénom» — the patient's first name only. */
  firstName: string;
  /** «Date» — «mercredi 15 octobre». */
  date: string;
  /** «Heure» — «14:30». */
  time: string;
  /** «Cabinet» — the clinic's name. */
  clinicName: string;
  /** «Téléphone» — the clinic's phone, as a patient would dial it. */
  clinicPhone: string;
}

/** "+212528843217" → "05 28 84 32 17"; anything else unchanged. */
export const formatClinicPhone = (phone: string) => {
  const compact = phone.replace(/[\s.\-()]/g, "");
  const moroccan = /^(?:\+212|00212|0)(\d{9})$/.exec(compact);
  if (!moroccan) return phone.trim();
  const national = `0${moroccan[1]}`;
  return national.replace(/(\d{2})(?=\d)/g, "$1 ");
};

/**
 * The variables for one message. `startsAt` is the slot the message is
 * ABOUT: the new slot for a reschedule, the canceled slot for a cancellation.
 */
export const buildMessageParams = ({
  firstName,
  startsAt,
  clinicName,
  clinicPhone,
}: {
  firstName: string;
  startsAt: Date;
  clinicName: string;
  clinicPhone: string;
}): MessageParams => {
  const local = toClinicTime(startsAt);
  return {
    firstName: firstName.trim(),
    date: format(local, "EEEE d MMMM", { locale: fr }),
    time: format(local, "HH:mm", { locale: fr }),
    clinicName: clinicName.trim(),
    clinicPhone: formatClinicPhone(clinicPhone),
  };
};

/** The sample values the editor previews with. */
export const SAMPLE_PARAMS: MessageParams = {
  firstName: CHIP_SAMPLES[MessageChip.FirstName],
  date: CHIP_SAMPLES[MessageChip.Date],
  time: CHIP_SAMPLES[MessageChip.Time],
  clinicName: CHIP_SAMPLES[MessageChip.ClinicName],
  clinicPhone: CHIP_SAMPLES[MessageChip.ClinicPhone],
};
