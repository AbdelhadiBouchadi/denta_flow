import {
  BabyIcon,
  BoneIcon,
  DropletIcon,
  ShieldPlusIcon,
  type LucideIcon,
} from "lucide-react";

import { MEDICAL_ALERT_DESCRIPTIONS } from "../constants";
import { getMedicalAlerts } from "../derived";
import { MedicalAlert, type PatientMedicalHistory } from "../types";

interface MedicalAlertPillsProps {
  history: PatientMedicalHistory;
}

const MEDICAL_ALERT_ICONS: Record<MedicalAlert, LucideIcon> = {
  [MedicalAlert.Anticoagulants]: DropletIcon,
  [MedicalAlert.Bisphosphonates]: BoneIcon,
  [MedicalAlert.AntibioticProphylaxis]: ShieldPlusIcon,
  [MedicalAlert.Pregnancy]: BabyIcon,
};

/**
 * One compact danger pill per critical flag, on the name row beside the
 * allergy. The text is always visible — the tooltip only adds the why — since
 * a fact that changes what the dentist may do must not depend on a hover a
 * touch screen cannot make.
 *
 * `display: contents` on the list keeps the pills in the name row's own flex
 * wrap, while screen readers still hear them announced as one list.
 */
const MedicalAlertPills = ({ history }: MedicalAlertPillsProps) => {
  const alerts = getMedicalAlerts(history);
  if (alerts.length === 0) return null;

  return (
    <ul aria-label="Alertes médicales" className="contents">
      {alerts.map(({ alert, label }) => {
        const Icon = MEDICAL_ALERT_ICONS[alert];
        return (
          <li
            key={alert}
            title={MEDICAL_ALERT_DESCRIPTIONS[alert]}
            className="border-danger/30 bg-danger-subtle text-danger-strong text-label inline-flex items-center gap-1.5 rounded-md border px-2 py-1"
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0" />
            {label}
          </li>
        );
      })}
    </ul>
  );
};

export default MedicalAlertPills;
