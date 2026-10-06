"use client";

import { useEffect, useState } from "react";

import { SEARCH_DEBOUNCE_MS } from "../constants";

/**
 * `value`, once it has stopped changing for `delay` ms. Feeds the NGAP
 * searches, so a typed word costs one request, not one per keystroke.
 */
export const useDebouncedValue = <T>(value: T, delay = SEARCH_DEBOUNCE_MS) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
};
