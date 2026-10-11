"use client";

import {
  useMutation,
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from "@tanstack/react-query";
import {
  EyeIcon,
  HistoryIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Suspense, useMemo, useRef, useState } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { toast } from "sonner";

import ErrorState from "@/components/shared/error-state";
import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/hooks/use-confirm";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/errors";
import type { PatientGetOne } from "@/modules/patients/types";
import NewTreatmentDialog from "@/modules/treatments/ui/new-treatment-dialog";
import { useTRPC } from "@/trpc/client";
import {
  ODONTOGRAM_COPY as COPY,
  ODONTOGRAM_ENVELOPE_VERSION,
  ODONTOGRAM_LIBRARY_VERSION,
  type ToothCode,
} from "../constants";
import { useInvalidateOdontogram } from "../hooks/use-invalidate-odontogram";
import { useLeaveGuard } from "../hooks/use-leave-guard";
import { canResetOdontogram, canWriteOdontogram } from "../rules";
import { odontogramEnvelopeSchema } from "../schemas";
import { OdontogramLayer } from "../types";
import OdontogramChart, { OdontogramSkeleton } from "./odontogram-chart";
import type { OdontogramEngineHandle } from "./odontogram-engine";

interface PatientOdontogramProps {
  patient: PatientGetOne;
}

/** The library's export is an object; anything else never reaches the server. */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * The envelope's own French message (size, format) when the procedure
 * refused it, rather than the generic «invalid fields» sentence.
 */
const saveErrorMessage = (error: unknown) => {
  const zodError = (error as { data?: { zodError?: unknown } | null }).data
    ?.zodError as { fieldErrors?: Record<string, string[] | undefined> } | null;
  return zodError?.fieldErrors?.chart?.[0] ?? getErrorMessage(error);
};

/**
 * The dossier's «Odontogramme» tab (prompts/28). The chart is the library's
 * (behind `odontogram-engine.tsx`); this owns everything around it: which
 * layer shows, who may edit, the explicit save with its version token, the
 * unsaved-changes guard, the reset, and the bridge to the actes.
 *
 * The acte list stays the record of truth (08-clinical.md §2 rule 4): the
 * chart never creates an acte and an acte never edits the chart. «Créer un
 * acte» only pre-fills the acte form with the selected teeth.
 */
const OdontogramPanel = ({ patient }: PatientOdontogramProps) => {
  const trpc = useTRPC();
  const invalidate = useInvalidateOdontogram();
  const { resolvedTheme } = useTheme();
  const { data: session, isPending: sessionPending } = authClient.useSession();

  // Prefetched by the dossier page: no request on first paint.
  const { data: chart } = useSuspenseQuery(
    trpc.odontogram.getChart.queryOptions({ patientId: patient.id }),
  );

  const [layer, setLayer] = useState(OdontogramLayer.Current);
  // Bumped to load the stored chart again (after a conflict, a retry, a reset).
  const [generation, setGeneration] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [teeth, setTeeth] = useState<ToothCode[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  // Mounted while open only: each opening is a fresh form on these teeth.
  const [acteTeeth, setActeTeeth] = useState<ToothCode[] | null>(null);
  const handle = useRef<OdontogramEngineHandle | null>(null);
  const scope = useRef<HTMLDivElement>(null);

  // Cosmetic: the procedures refuse whatever this shows (decision 4).
  const actor = {
    role: session?.user.role,
    patientIsArchived: patient.isArchived,
  };
  const canWrite = canWriteOdontogram(actor);
  const canReset = canResetOdontogram(actor);
  const showingInitial = layer === OdontogramLayer.Initial;
  const readOnly = !canWrite || showingInitial;

  // The stored envelope of the layer on screen, checked like the server
  // checks it. `null` — no chart yet — is a blank mouth, not an error.
  const stored =
    chart === null ? null : showingInitial ? chart.initial : chart.current;
  const parsed = useMemo(
    () => (stored === null ? null : odontogramEnvelopeSchema.safeParse(stored)),
    [stored],
  );
  const unreadable = loadFailed || (parsed !== null && !parsed.success);
  const storedDocument = parsed?.success ? parsed.data.data : null;

  const [LeaveConfirmation, confirmLeave] = useConfirm(
    COPY.leaveTitle,
    COPY.leaveDescription,
    "destructive",
  );
  const [ResetConfirmation, confirmReset] = useConfirm(
    COPY.resetTitle,
    COPY.resetDescription,
    "destructive",
  );
  useLeaveGuard(dirty, confirmLeave, scope);

  const reload = async () => {
    await invalidate();
    setLoadFailed(false);
    setGeneration((g) => g + 1);
  };

  const save = useMutation(
    trpc.odontogram.saveChart.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(COPY.saved);
      },
      onError: (error) => {
        if (error.data?.code === "CONFLICT") {
          toast.error(error.message, {
            action: { label: COPY.reload, onClick: () => void reload() },
          });
          return;
        }
        toast.error(saveErrorMessage(error));
      },
    }),
  );

  const reset = useMutation(
    trpc.odontogram.resetChart.mutationOptions({
      onSuccess: async () => {
        setLayer(OdontogramLayer.Current);
        await reload();
        toast.success(COPY.resetDone);
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const handleSave = () => {
    const data = handle.current?.exportChart();
    if (!isRecord(data)) return;
    save.mutate(
      {
        patientId: patient.id,
        chart: {
          version: ODONTOGRAM_ENVELOPE_VERSION,
          library: ODONTOGRAM_LIBRARY_VERSION,
          data,
        },
        expectedUpdatedAt: chart?.updatedAt ?? null,
      },
      { onSuccess: () => handle.current?.markClean(data) },
    );
  };

  const handleReset = async () => {
    if (!(await confirmReset())) return;
    reset.mutate({ patientId: patient.id });
  };

  const toggleLayer = async () => {
    if (dirty && !(await confirmLeave())) return;
    setLayer(
      showingInitial ? OdontogramLayer.Current : OdontogramLayer.Initial,
    );
  };

  const notice = showingInitial
    ? COPY.initialBanner
    : patient.isArchived
      ? COPY.readOnlyArchived
      : !sessionPending && !canWrite
        ? COPY.readOnlyRole
        : chart === null
          ? COPY.emptyHint
          : null;

  return (
    <div ref={scope} className="flex min-w-0 flex-col gap-4">
      <LeaveConfirmation />
      <ResetConfirmation />
      {acteTeeth && (
        <NewTreatmentDialog
          open
          onOpenChange={(open) => {
            if (!open) setActeTeeth(null);
          }}
          defaultValues={{ patient, teeth: acteTeeth }}
          lockPatient
        />
      )}

      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {chart !== null && (
            <Button
              variant="outline"
              size="lg"
              aria-pressed={showingInitial}
              onClick={() => void toggleLayer()}
            >
              {showingInitial ? <EyeIcon /> : <HistoryIcon />}
              {showingInitial ? COPY.showCurrent : COPY.showInitial}
            </Button>
          )}
          {dirty && <StatusBadge tone="warning" label={COPY.unsaved} />}
        </div>

        {!readOnly && (
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="text-muted-foreground text-sm tabular-nums"
              aria-live="polite"
            >
              {COPY.selectedTeeth(teeth.length)}
            </span>
            <Button
              variant="outline"
              size="lg"
              disabled={teeth.length === 0}
              title={teeth.length === 0 ? COPY.createActeHint : undefined}
              onClick={() => setActeTeeth(teeth)}
            >
              <PlusIcon />
              {COPY.createActe}
            </Button>
            <Button
              size="lg"
              disabled={!dirty || save.isPending || unreadable}
              onClick={handleSave}
            >
              <SaveIcon />
              {save.isPending ? COPY.saving : COPY.save}
            </Button>
            {canReset && chart !== null && (
              <ResetMenu
                disabled={reset.isPending}
                onReset={() => void handleReset()}
              />
            )}
          </div>
        )}
      </div>

      {notice && <p className="text-muted-foreground text-sm">{notice}</p>}

      {unreadable ? (
        <div className="flex flex-col items-center gap-4 py-6">
          <ErrorState
            title={COPY.loadErrorTitle}
            description={
              canReset
                ? `${COPY.loadErrorDescription} ${COPY.loadErrorResetHint}`
                : COPY.loadErrorDescription
            }
          />
          <div className="flex flex-wrap justify-center gap-2">
            {canReset && chart !== null && (
              <Button
                variant="destructive"
                size="lg"
                disabled={reset.isPending}
                onClick={() => void handleReset()}
              >
                <Trash2Icon />
                {COPY.resetChart}
              </Button>
            )}
            <Button variant="outline" size="lg" onClick={() => void reload()}>
              <RotateCcwIcon />
              {COPY.retry}
            </Button>
          </div>
        </div>
      ) : sessionPending ? (
        <OdontogramSkeleton withPanel={false} />
      ) : (
        <div className="bg-background min-w-0 rounded-2xl">
          <OdontogramChart
            // One engine per page: a new patient, layer or reload is a new
            // instance (docs/spikes/odontogram.md, gate 2).
            key={`${patient.id}:${layer}:${generation}`}
            data={storedDocument}
            readOnly={readOnly}
            darkMode={resolvedTheme === "dark"}
            onReady={(engine) => {
              handle.current = engine;
            }}
            onLoadError={() => setLoadFailed(true)}
            onDirtyChange={setDirty}
            onSelectionChange={setTeeth}
          />
        </div>
      )}
    </div>
  );
};

/** Destructive actions live in a «…» menu, never as a peer button (06-ui.md). */
const ResetMenu = ({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => void;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <Button
          variant="ghost"
          size="icon-lg"
          disabled={disabled}
          aria-label={COPY.moreActions}
        />
      }
    >
      <MoreHorizontalIcon />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-60">
      <DropdownMenuItem variant="destructive" onClick={onReset}>
        <Trash2Icon />
        {COPY.resetChart}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const OdontogramError = ({ resetErrorBoundary }: FallbackProps) => {
  const { reset } = useQueryErrorResetBoundary();

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <ErrorState title={COPY.errorTitle} description={COPY.errorDescription} />
      <Button
        variant="outline"
        size="lg"
        onClick={() => {
          reset();
          resetErrorBoundary();
        }}
      >
        <RotateCcwIcon />
        {COPY.retry}
      </Button>
    </div>
  );
};

/**
 * Its own boundaries: a failing chart query shows a retry in the tab and
 * leaves the rest of the dossier standing.
 */
const PatientOdontogram = ({ patient }: PatientOdontogramProps) => (
  <ErrorBoundary FallbackComponent={OdontogramError}>
    <Suspense fallback={<OdontogramSkeleton withPanel={false} />}>
      <OdontogramPanel patient={patient} />
    </Suspense>
  </ErrorBoundary>
);

export default PatientOdontogram;
