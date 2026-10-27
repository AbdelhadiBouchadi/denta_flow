import { format } from "date-fns";
import { fr } from "date-fns/locale";

import { toClinicTime } from "@/lib/time";
import { MESSAGE_VARIABLES } from "./constants";

/**
 * The five positional variables every template uses (prompts/33,
 * decision 1) — and NOTHING else: no surname, no treatment, no practitioner,
 * no amount. Date and time are read on the clinic's wall clock.
 */
export interface MessageParams {
  /** {{1}} — the patient's first name only. */
  firstName: string;
  /** {{2}} — «mercredi 15 octobre». */
  date: string;
  /** {{3}} — «14:30». */
  time: string;
  /** {{4}} — the clinic's name. */
  clinicName: string;
  /** {{5}} — the clinic's phone, as a patient would dial it. */
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

const ordered = (params: MessageParams) => [
  params.firstName,
  params.date,
  params.time,
  params.clinicName,
  params.clinicPhone,
];

/** Twilio's `ContentVariables`: a JSON string `{"1":"…","2":"…",…}`. */
export const toContentVariables = (params: MessageParams) =>
  JSON.stringify(
    Object.fromEntries(
      ordered(params).map((value, index) => [String(index + 1), value]),
    ),
  );

/** A manual text with `{prenom}`… replaced — manual mode and the sandbox. */
export const renderManualText = (text: string, params: MessageParams) => {
  const values = ordered(params);
  return MESSAGE_VARIABLES.reduce(
    (result, variable, index) => result.split(variable.token).join(values[index]),
    text,
  );
};

/** The sample values the templates tab previews with. */
export const SAMPLE_PARAMS: MessageParams = {
  firstName: MESSAGE_VARIABLES[0].sample,
  date: MESSAGE_VARIABLES[1].sample,
  time: MESSAGE_VARIABLES[2].sample,
  clinicName: MESSAGE_VARIABLES[3].sample,
  clinicPhone: MESSAGE_VARIABLES[4].sample,
};
