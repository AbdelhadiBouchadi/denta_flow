import type { ColumnDef } from "@tanstack/react-table";

import GeneratedAvatar from "@/components/shared/generated-avatar";
import type { DataTableFeatures } from "@/components/shared/data-table";
import { formatDateTime, formatDH } from "@/lib/format";
import { EMPTY_FIELD } from "../constants";
import { formatPatientName, getPaymentStatus } from "../derived";
import type { PatientListItem } from "../types";
import { PaymentAmount } from "./payment-amount";
import { PatientTags } from "./patient-tags";

const RightAligned = ({ children }: { children: React.ReactNode }) => (
  <div className="text-right">{children}</div>
);

/**
 * Column order and headers come from `prompt_material/10-patient-list.md`:
 * ID · CIN · Nom · Tags · Prochain rendez-vous · Reste à payer · Payé.
 *
 * v9 puts the features generic first — `ColumnDef<TFeatures, TData>`.
 */
export const columns: ColumnDef<DataTableFeatures, PatientListItem>[] = [
  {
    accessorKey: "shortCode",
    header: "ID",
    cell: ({ row }) => (
      <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
        {row.original.shortCode}
      </span>
    ),
  },
  {
    accessorKey: "cin",
    header: "CIN",
    cell: ({ row }) =>
      row.original.cin ?? (
        <span className="text-muted-foreground">{EMPTY_FIELD}</span>
      ),
  },
  {
    accessorKey: "lastName",
    header: "Nom",
    cell: ({ row }) => (
      <span className="flex items-center gap-2.5">
        {/* Seeded by the id: a patient who changes surname keeps their face. */}
        <GeneratedAvatar
          seed={row.original.id}
          name={formatPatientName(row.original)}
          birthDate={row.original.birthDate}
          gender={row.original.gender}
          className="size-8"
        />
        <span className="text-foreground font-medium">
          {formatPatientName(row.original)}
        </span>
      </span>
    ),
  },
  {
    id: "tags",
    header: "Tags",
    cell: ({ row }) => <PatientTags tags={row.original.tags} />,
  },
  {
    id: "nextAppointmentAt",
    header: "Prochain rendez-vous",
    cell: ({ row }) =>
      row.original.nextAppointmentAt ? (
        // Morocco's UTC offset rules move, and a browser's bundled tz database
        // lags Node's: for a date after a rule change the two render an hour
        // apart and React reports a hydration mismatch. The instant is the same
        // on both sides — only the wall clock they read it on differs — so the
        // warning is suppressed on this leaf rather than the value being frozen
        // into the payload. The browser's reading wins after hydration, which
        // is the one the clinic actually sees.
        <span suppressHydrationWarning className="tabular-nums">
          {formatDateTime(row.original.nextAppointmentAt)}
        </span>
      ) : (
        <span className="text-muted-foreground">Aucun</span>
      ),
  },
  {
    id: "remainingCents",
    header: () => <RightAligned>Reste à payer</RightAligned>,
    cell: ({ row }) => (
      <RightAligned>
        <PaymentAmount
          cents={row.original.remainingCents}
          status={getPaymentStatus(row.original)}
        />
      </RightAligned>
    ),
  },
  {
    id: "amountPaidCents",
    header: () => <RightAligned>Payé</RightAligned>,
    cell: ({ row }) => (
      <RightAligned>
        <span className="text-foreground-secondary tabular-nums">
          {formatDH(row.original.amountPaidCents)}
        </span>
      </RightAligned>
    ),
  },
];
