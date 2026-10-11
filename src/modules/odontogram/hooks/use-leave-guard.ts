"use client";

import { useEffect, useRef } from "react";

/**
 * Asks before unsaved chart changes are lost (prompts/28, decision 3).
 *
 * - Closing or reloading the tab: the browser's own `beforeunload` prompt.
 * - Leaving inside the app: a click on a link, or on another dossier tab,
 *   is held in the capture phase, `confirmLeave()` is awaited, and on «yes»
 *   the same element is clicked again with the guard lifted — so Next's
 *   `<Link>` and the Tabs component navigate exactly as they would have.
 *
 * Not covered, and said so in docs/spikes/odontogram.md: the browser's back
 * button (App Router has no blocking hook for it) and `router.push` calls
 * made without a click, such as the patient search.
 */
export const useLeaveGuard = (
  dirty: boolean,
  confirmLeave: () => Promise<boolean>,
  /** Clicks inside this element never leave (the chart's own controls). */
  scope: React.RefObject<HTMLElement | null>,
) => {
  const confirmRef = useRef(confirmLeave);
  useEffect(() => {
    confirmRef.current = confirmLeave;
  });

  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };

    let passing = false;
    const onClick = (event: MouseEvent) => {
      if (passing || event.defaultPrevented || event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      if (scope.current?.contains(event.target)) return;

      const link = event.target.closest<HTMLAnchorElement>("a[href]");
      const leavesByLink =
        link !== null &&
        link.target !== "_blank" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.shiftKey &&
        new URL(link.href, window.location.href).origin ===
          window.location.origin;
      // Another dossier tab unmounts this one, and the chart with it.
      const tab = event.target.closest<HTMLElement>(
        '[role="tab"]:not([data-active])',
      );
      const target = leavesByLink ? link : tab;
      if (!target) return;

      event.preventDefault();
      event.stopPropagation();
      void confirmRef.current().then((ok) => {
        if (!ok) return;
        passing = true;
        try {
          target.click();
        } finally {
          passing = false;
        }
      });
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, scope]);
};
