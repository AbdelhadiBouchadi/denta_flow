"use client";

import {
  useMutation,
  useQueryClient,
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
import {
  Suspense,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
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
import { OdontogramLayer, type OdontogramChart as StoredChart } from "../types";
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

const noopSubscribe = () => () => {};

/**
 * `false` on the server and during hydration, `true` after. The session is
 * client-only: reading it before hydration ends would render the toolbar on
 * the client but not on the server — a hydration mismatch.
 */
const useIsHydrated = () =>
  useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );

/**
 * Whether the stored chart has moved on since `loaded` was handed to the
 * engine: saved by someone else (a later `updatedAt`), created, or reset.
 */
const isNewerChart = (live: StoredChart, loaded: StoredChart) => {
  if (live === null) return loaded !== null;
  if (loaded === null) return true;
  return live.updatedAt.getTime() > loaded.updatedAt.getTime();
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
  const queryClient = useQueryClient();
  const invalidate = useInvalidateOdontogram();
  const { resolvedTheme } = useTheme();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const sessionKnown = useIsHydrated() && !sessionPending;

  // Prefetched by the dossier page: no request on first paint.
  const { data: chart } = useSuspenseQuery(
    trpc.odontogram.getChart.queryOptions({ patientId: patient.id }),
  );

  // The chart the engine was given: its document AND its version token,
  // kept together. The query may refetch at any time (focus, another
  // mutation); a newer stored chart is only ever adopted as a whole, never
  // by swapping the token under the drawing on screen.
  const [loaded, setLoaded] = useState<StoredChart>(chart);
  const [layer, setLayer] = useState(OdontogramLayer.Current);
  // Bumped to load a chart again (adopted version, conflict, retry, reset).
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
    // Unknown — no rights — until the client knows the session.
    role: sessionKnown ? session?.user.role : undefined,
    patientIsArchived: patient.isArchived,
  };
  const canWrite = canWriteOdontogram(actor);
  const canReset = canResetOdontogram(actor);
  const showingInitial = layer === OdontogramLayer.Initial;
  const readOnly = !canWrite || showingInitial;

  // The loaded envelope of the layer on screen, checked like the server
  // checks it. `null` — no chart yet — is a blank mouth, not an error.
  const stored =
    loaded === null ? null : showingInitial ? loaded.initial : loaded.current;
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
  const [DiscardConfirmation, confirmDiscard] = useConfirm(
    COPY.discardTitle,
    COPY.leaveDescription,
    "destructive",
  );
  useLeaveGuard(dirty, confirmLeave, scope);

  /** Hand the engine a chart — document and token together — from scratch. */
  const adopt = (next: StoredChart) => {
    setLoaded(next);
    setLoadFailed(false);
    setGeneration((g) => g + 1);
  };

  /** Fetch the stored chart and load it, whatever is on screen. */
  const reload = async () => {
    await invalidate();
    adopt(
      queryClient.getQueryData(
        trpc.odontogram.getChart.queryKey({ patientId: patient.id }),
      ) ?? null,
    );
  };

  /** «Recharger» on purpose: unsaved edits are lost, so ask first. */
  const reloadDiscarding = async () => {
    if (dirty && !(await confirmDiscard())) return;
    await reload();
  };

  const save = useMutation(
    trpc.odontogram.saveChart.mutationOptions({
      onSuccess: async ({ updatedAt }, { chart: saved }) => {
        // The drawing on screen is now the stored version: advance the
        // token WITH it, before the refetch, so the refetch reads as our
        // own save and not someone else's.
        setLoaded((previous) => ({
          initial: previous?.initial ?? saved,
          current: saved,
          updatedAt,
        }));
        await invalidate();
        toast.success(COPY.saved);
      },
      onError: (error) => {
        if (error.data?.code === "CONFLICT") {
          toast.error(error.message, {
            action: {
              label: COPY.reload,
              onClick: () => void reloadDiscarding(),
            },
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

  // Someone else saved, created or reset the chart since it was loaded.
  // Ignored while our own save or reset runs: their refetch is ours.
  const changedElsewhere =
    !save.isPending && !reset.isPending && isNewerChart(chart, loaded);
  // Nothing to lose: load the newer version now (state adjusted during
  // render — the condition is false on the next pass). With unsaved edits
  // the notice below asks instead; a save meanwhile still carries the old
  // token and is refused as CONFLICT.
  if (changedElsewhere && !dirty) adopt(chart);

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
        // The version of the drawing being saved — never the live query's.
        expectedUpdatedAt: loaded?.updatedAt ?? null,
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
    // The other layer comes from the latest stored chart, token included.
    setLoaded(chart);
    setLoadFailed(false);
  };

  const notice = showingInitial
    ? COPY.initialBanner
    : patient.isArchived
      ? COPY.readOnlyArchived
      : sessionKnown && !canWrite
        ? COPY.readOnlyRole
        : loaded === null
          ? COPY.emptyHint
          : null;

  return (
    <div ref={scope} className="flex min-w-0 flex-col gap-4">
      <LeaveConfirmation />
      <ResetConfirmation />
      <DiscardConfirmation />
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
          {loaded !== null && (
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
            {canReset && loaded !== null && (
              <ResetMenu
                disabled={reset.isPending}
                onReset={() => void handleReset()}
              />
            )}
          </div>
        )}
      </div>

      {notice && <p className="text-muted-foreground text-sm">{notice}</p>}

      {changedElsewhere && dirty && (
        <div
          role="status"
          className="bg-warning-subtle text-warning-strong flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm"
        >
          <span>{COPY.changedElsewhere}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void reloadDiscarding()}
          >
            <RotateCcwIcon />
            {COPY.reload}
          </Button>
        </div>
      )}

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
            {canReset && loaded !== null && (
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
      ) : !sessionKnown ? (
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
