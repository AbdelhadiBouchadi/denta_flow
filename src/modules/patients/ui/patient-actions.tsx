"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/lib/auth-client";
import NewAppointmentDialog from "@/modules/appointments/ui/new-appointment-dialog";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import NewPaymentDialog from "@/modules/payments/ui/new-payment-dialog";
import { useTRPC } from "@/trpc/client";
import { useInvalidatePatients } from "../hooks/use-invalidate-patients";
import type { PatientGetOne } from "../types";
import UpdatePatientDialog from "./update-patient-dialog";

/** The header's quick actions — the reference's «+ Paiement», «+ Rendez-vous». */
const COPY = {
  payment: "Paiement",
  appointment: "Rendez-vous",
  /** The same actions, spelled out, inside the overflow menu on a phone. */
  newPayment: "Nouveau paiement",
  newAppointment: "Nouveau rendez-vous",
} as const;

interface PatientActionsProps {
  patient: PatientGetOne;
}

/**
 * The dossier's actions: «Modifier» in reach, the lifecycle ones a click deeper.
 * Archiving is the everyday action; the hard delete is an admin's, and the list
 * rows carry neither (08-clinical.md §6).
 *
 * «+ Paiement» and «+ Rendez-vous» open the payments and appointments slices’
 * OWN dialogs, patient locked — reused, never forked — so each keeps its own
 * rules and its own invalidation (both refresh `patients.pathFilter()`, so
 * the header's balance and counters move without a reload). Neither is
 * disabled for an archived patient: payments accept one by rule (branch 20),
 * and appointments has no archived rule at all; this branch changes neither.
 *
 * Below `sm` the two buttons collapse into the overflow menu: «Modifier» and
 * the menu are all that fit beside the header on a 360 px phone.
 */
const PatientActions = ({ patient }: PatientActionsProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const invalidateAll = useInvalidatePatients();
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Dialog state, not page state.
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isAppointmentOpen, setIsAppointmentOpen] = useState(false);

  // Cosmetic only. `patients.remove` is an adminProcedure and refuses a
  // non-admin whatever this menu shows (AGENTS.md §2).
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  const [ArchiveConfirmation, confirmArchive] = useConfirm(
    patient.isArchived ? "Réactiver ce patient ?" : "Archiver ce patient ?",
    patient.isArchived
      ? "Le dossier réapparaîtra dans la liste des patients. Aucune donnée n’est modifiée."
      : "Le dossier sort de la liste des patients, mais rien n’est supprimé : rendez-vous, actes, paiements et documents sont conservés, et vous pouvez le réactiver à tout moment.",
  );

  const [RemoveConfirmation, confirmRemove] = useConfirm(
    "Supprimer définitivement ce patient ?",
    "Cette action est irréversible. Le dossier sera supprimé, ainsi que ses actes, ses paiements, ses rendez-vous, ses documents et son odontogramme.",
    "destructive",
  );

  const archivePatient = useMutation(
    trpc.patients.archive.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success("Patient archivé");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const unarchivePatient = useMutation(
    trpc.patients.unarchive.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success("Patient réactivé");
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const removePatient = useMutation(
    trpc.patients.remove.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success("Patient supprimé");
        router.push("/patients");
      },
      // A secretary who reaches this by any route reads the procedure's own
      // French refusal — never a silent no-op (06-ui.md §6).
      onError: (error) => toast.error(error.message),
    }),
  );

  const isPending =
    archivePatient.isPending ||
    unarchivePatient.isPending ||
    removePatient.isPending;

  const handleArchive = async () => {
    const confirmed = await confirmArchive();
    if (!confirmed) return;

    if (patient.isArchived) {
      unarchivePatient.mutate({ id: patient.id });
      return;
    }
    archivePatient.mutate({ id: patient.id });
  };

  const handleRemove = async () => {
    const confirmed = await confirmRemove();
    if (!confirmed) return;
    removePatient.mutate({ id: patient.id });
  };

  return (
    <>
      <ArchiveConfirmation />
      <RemoveConfirmation />
      <UpdatePatientDialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        initialValues={patient}
      />
      <NewPaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        defaultValues={{ patient }}
        lockPatient
      />
      <NewAppointmentDialog
        open={isAppointmentOpen}
        onOpenChange={setIsAppointmentOpen}
        defaultValues={{ patient }}
        lockPatient
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="lg"
          disabled={isPending}
          onClick={() => setIsEditOpen(true)}
        >
          <PencilIcon />
          Modifier
        </Button>

        <Button
          variant="outline"
          size="lg"
          className="hidden sm:inline-flex"
          disabled={isPending}
          onClick={() => setIsPaymentOpen(true)}
        >
          <PlusIcon />
          {COPY.payment}
        </Button>

        <Button
          size="lg"
          className="hidden sm:inline-flex"
          disabled={isPending}
          onClick={() => setIsAppointmentOpen(true)}
        >
          <PlusIcon />
          {COPY.appointment}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                disabled={isPending}
                aria-label="Autres actions sur le dossier"
              />
            }
          >
            <MoreHorizontalIcon />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-60">
            {/* Phone only: the quick actions the header has no room for. */}
            <DropdownMenuItem
              className="sm:hidden"
              onClick={() => setIsPaymentOpen(true)}
            >
              <PlusIcon />
              {COPY.newPayment}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="sm:hidden"
              onClick={() => setIsAppointmentOpen(true)}
            >
              <PlusIcon />
              {COPY.newAppointment}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="sm:hidden" />

            <DropdownMenuItem onClick={handleArchive}>
              {patient.isArchived ? <ArchiveRestoreIcon /> : <ArchiveIcon />}
              {patient.isArchived ? "Réactiver" : "Archiver"}
            </DropdownMenuItem>

            {isAdmin && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={handleRemove}>
                  <Trash2Icon />
                  Supprimer définitivement
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  );
};

export default PatientActions;
