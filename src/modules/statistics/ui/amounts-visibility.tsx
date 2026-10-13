"use client";

import { createContext, useContext, useMemo, useState } from "react";

import { formatDH } from "@/lib/format";
import { AMOUNT_MASK } from "../constants";
import { formatCompactDH } from "../rules";

/**
 * «Afficher les montants» — ONE page-level switch for every amount on
 * `/statistiques` (prompts/30, decision 7). `MaskedAmount` keeps its reveal
 * state per instance, which would mean a dozen eye buttons; this context
 * drives the KPI amounts, the chart axes and the tooltips together.
 *
 * Off by default and never remembered: every load starts masked. Masked,
 * an axis shows no amounts (the shapes stay), a tooltip and a card show
 * «•••• DH». Counts and percentages are never masked.
 */
interface AmountsVisibility {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
}

const AmountsVisibilityContext = createContext<AmountsVisibility | null>(null);

export const AmountsVisibilityProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const value = useMemo(() => ({ isVisible, setIsVisible }), [isVisible]);
  return (
    <AmountsVisibilityContext.Provider value={value}>
      {children}
    </AmountsVisibilityContext.Provider>
  );
};

export const useAmountsVisibility = () => {
  const context = useContext(AmountsVisibilityContext);
  if (!context) {
    throw new Error(
      "useAmountsVisibility must be used within <AmountsVisibilityProvider>",
    );
  }
  return context;
};

/** The three ways an amount renders on this page, masked or not. */
export const useAmountFormat = () => {
  const { isVisible } = useAmountsVisibility();
  return useMemo(
    () => ({
      isVisible,
      /** Cards and tooltips: «1 250,00 DH» or «•••• DH». */
      full: (cents: number) => (isVisible ? formatDH(cents) : AMOUNT_MASK),
      /** Axes: «12 k DH», or nothing at all. */
      axis: (cents: number) => (isVisible ? formatCompactDH(cents) : ""),
    }),
    [isVisible],
  );
};
