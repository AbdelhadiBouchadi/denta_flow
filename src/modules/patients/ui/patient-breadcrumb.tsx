import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface PatientBreadcrumbProps {
  /**
   * The name only, not the patient row: the crumb has no reason to re-render
   * with the dossier query, and nothing else on it comes from the record.
   */
  patientName: string;
}

/**
 * Hierarchy, not history. «Patients» points at the bare list — the filters the
 * user arrived with are deliberately not carried back, because a breadcrumb
 * answers «where am I in the app», and the browser's back button already
 * answers «take me to the view I just left».
 *
 * It stays at the list's own `text-sm text-muted-foreground`: the dossier's
 * `h1` carries the patient's name a few pixels below, and a heading-sized
 * crumb would print that name twice at competing weights.
 */
const PatientBreadcrumb = ({ patientName }: PatientBreadcrumbProps) => (
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        {/* Base UI composes through `render`, not Radix's `asChild` — the
            latter would leave an unknown attribute on the <a> and nest a
            second anchor inside it. */}
        <BreadcrumbLink render={<Link href="/patients" />}>
          Patients
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator>
        <ChevronRightIcon />
      </BreadcrumbSeparator>
      <BreadcrumbItem>
        <BreadcrumbPage className="font-medium">{patientName}</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
);

export default PatientBreadcrumb;
