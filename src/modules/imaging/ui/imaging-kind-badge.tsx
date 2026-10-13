import StatusBadge from "@/components/shared/status-badge";
import {
  PATIENT_FILE_KIND_LABELS,
  PATIENT_FILE_KIND_TONES,
} from "../constants";
import type { PatientFileKind } from "../types";

interface ImagingKindBadgeProps {
  kind: PatientFileKind;
  className?: string;
}

/** The kind's pill — label and tone from the slice's maps only. */
const ImagingKindBadge = ({ kind, className }: ImagingKindBadgeProps) => (
  <StatusBadge
    label={PATIENT_FILE_KIND_LABELS[kind]}
    tone={PATIENT_FILE_KIND_TONES[kind]}
    className={className}
  />
);

export default ImagingKindBadge;
