"use client";

import { useEffect, useRef } from "react";
import {
  formatToothLabel,
  getStatusChart,
  importStatus,
  OdontogramChartSurface,
  OdontogramProvider,
  onStateChange,
  resetMouth,
  setHealthyPulpVisible,
  setOcclusalVisible,
  setReadOnly,
  setShowBase,
  setWisdomVisible,
  ToothControlsSurface,
} from "react-advanced-odontogram";
import "react-advanced-odontogram/style.css";

import { ALL_TEETH, type ToothCode } from "../constants";

/**
 * THE boundary with `react-advanced-odontogram` (MIT, pinned in
 * package.json, see docs/third-party.md). No other file imports the library:
 * this one is loaded only through `next/dynamic({ ssr: false })` by
 * `odontogram-chart.tsx`, so its 3 MB of engine, artwork and translations
 * never reach the first paint of any other screen.
 *
 * The engine is a module-level singleton that owns the DOM it draws into.
 * Rules this adapter enforces (docs/spikes/odontogram.md, gate 2):
 *
 * - one instance per page — the caller keys it by patient and view, so a
 *   change of either unmounts it (the provider calls `destroyOdontogram()`,
 *   which clears both charts) and mounts a fresh one;
 * - every mount LOADS explicitly, a document or a blank mouth. Never relies
 *   on the engine being empty: the view globals (wisdom teeth, bone, pulp,
 *   occlusal tiles) and the edentulous flag survive `destroyOdontogram()`;
 * - the load waits for the grid. `initOdontogram()` is async and not
 *   awaited by the provider; its last act is a state notification, which is
 *   when the tiles exist. Importing earlier would paint nothing.
 */

/** What the toolbar may ask of the chart on screen. */
export interface OdontogramEngineHandle {
  /** The library's own export of the chart (opaque to everything else). */
  exportChart: () => unknown;
  /** Mark the saved export clean, or use the current chart when omitted. */
  markClean: (data?: unknown) => void;
}

export interface OdontogramEngineProps {
  /** The library document to show; `null` is a blank mouth, not an error. */
  data: unknown;
  readOnly: boolean;
  darkMode: boolean;
  onReady: (handle: OdontogramEngineHandle) => void;
  onLoadError: (error: unknown) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSelectionChange: (teeth: ToothCode[]) => void;
}

const isToothCode = (code: string): code is ToothCode =>
  (ALL_TEETH as readonly string[]).includes(code);

/**
 * The selected teeth as FDI codes. The library has no selection getter
 * (gate 8): selected tiles carry `.active` and `data-tooth`, the engine's
 * internal number, which `formatToothLabel` maps to the displayed FDI code —
 * a primary tooth drawn on 55's position reads «55», not «15».
 */
const readSelection = (root: HTMLElement): ToothCode[] => {
  const tiles = root.querySelectorAll<HTMLElement>(
    "#toothGrid .tooth-tile.active[data-tooth]",
  );
  const codes = new Set<string>();
  tiles.forEach((tile) => {
    const internal = Number(tile.dataset.tooth);
    if (Number.isInteger(internal)) codes.add(formatToothLabel(internal));
  });
  return ALL_TEETH.filter((code) => codes.has(code) && isToothCode(code));
};

/** A document worth handing to `importStatus`: an object with its teeth map. */
const isChartDocument = (data: unknown): data is Record<string, unknown> =>
  typeof data === "object" &&
  data !== null &&
  !Array.isArray(data) &&
  typeof (data as { teeth?: unknown }).teeth === "object" &&
  (data as { teeth?: unknown }).teeth !== null;

/** A blank mouth through the public API — no hand-written library JSON. */
const loadBlank = () => {
  resetMouth();
  setWisdomVisible(true);
  setShowBase(true);
  setOcclusalVisible(true);
  setHealthyPulpVisible(true);
};

const serialize = () => JSON.stringify(getStatusChart());

/**
 * Lives inside the provider and renders nothing: a child's effects run
 * before its parent's, so this subscribes before `initOdontogram()` starts
 * and catches the notification that ends it — in React 19 StrictMode too,
 * where init, destroy and init run back to back (the first build is
 * superseded by the engine's token and never notifies).
 */
const EngineBridge = ({
  rootRef,
  data,
  readOnly,
  onReady,
  onLoadError,
  onDirtyChange,
  onSelectionChange,
}: Omit<OdontogramEngineProps, "darkMode"> & {
  rootRef: React.RefObject<HTMLDivElement | null>;
}) => {
  // The callbacks change identity with every parent render; the
  // subscription below must not, or it would reload the chart.
  const callbacks = useRef({
    onReady,
    onLoadError,
    onDirtyChange,
    onSelectionChange,
  });
  useEffect(() => {
    callbacks.current = {
      onReady,
      onLoadError,
      onDirtyChange,
      onSelectionChange,
    };
  });

  const initial = useRef({ data, readOnly });

  useEffect(() => {
    let loaded = false;
    let failed = false;
    let baseline = "";
    // `null` until the first report: a fresh chart always tells the parent
    // «clean, nothing selected», whatever the previous instance had said.
    let dirty: boolean | null = null;
    let selection: string | null = null;

    const report = () => {
      const root = rootRef.current;
      if (!root || failed) return;

      const nowDirty = serialize() !== baseline;
      if (nowDirty !== dirty) {
        dirty = nowDirty;
        callbacks.current.onDirtyChange(dirty);
      }

      const teeth = readSelection(root);
      const key = teeth.join(",");
      if (key !== selection) {
        selection = key;
        callbacks.current.onSelectionChange(teeth);
      }
    };

    const load = () => {
      if (loaded) return;
      const root = rootRef.current;
      if (!root?.querySelector("#toothGrid .tooth-tile")) return;
      // Set before importing: the import notifies, re-entering here.
      loaded = true;

      const { data: document, readOnly: locked } = initial.current;
      try {
        if (document === null || document === undefined) loadBlank();
        else if (isChartDocument(document)) importStatus(document);
        else throw new Error("Unrecognised odontogram document");
        // The grid did not exist when the provider applied read-only:
        // re-apply so the fresh tiles leave the tab order too.
        setReadOnly(locked);
        baseline = serialize();
      } catch (error) {
        failed = true;
        callbacks.current.onLoadError(error);
        return;
      }

      callbacks.current.onReady({
        exportChart: () => getStatusChart(),
        markClean: (data) => {
          baseline = data === undefined ? serialize() : JSON.stringify(data);
          report();
        },
      });
      report();
    };

    const unsubscribe = onStateChange(() => {
      if (!loaded) load();
      else report();
    });
    load();

    return unsubscribe;
  }, [rootRef]);

  return null;
};

/**
 * The chart and, when editable, the library's control panel — its
 * Odontogramme view only. The periodontal chart, the diagnoses pop-up and the
 * top bar (language, numbering, import/export, settings) are never rendered;
 * the ICD-10 card and the Status/Plan toggle are hidden by the odontogram
 * block of globals.css (gate 3).
 */
const OdontogramEngine = ({ darkMode, ...props }: OdontogramEngineProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <OdontogramProvider
      language="fr"
      numberingSystem="FDI"
      // Controlled: the provider never touches <html class="dark">, which
      // next-themes owns.
      darkMode={darkMode}
      readOnly={props.readOnly}
      enableNotes={false}
      enableIcdas={false}
    >
      <EngineBridge rootRef={rootRef} {...props} />
      <div
        ref={rootRef}
        className={props.readOnly ? undefined : "layout odontogram-layout"}
      >
        {/* The tooth grid is 16 tiles of at least 36 px: on a phone it
            scrolls inside this box, never the page. */}
        <div className="chart-column min-w-0">
          <div className="min-w-0 overflow-x-auto overscroll-x-contain">
            <div className="min-w-fit">
              <OdontogramChartSurface />
            </div>
          </div>
        </div>
        {!props.readOnly && (
          // `.panel` is what the engine's read-only switch dims.
          <aside className="panel">
            <ToothControlsSurface />
          </aside>
        )}
      </div>
    </OdontogramProvider>
  );
};

export default OdontogramEngine;
