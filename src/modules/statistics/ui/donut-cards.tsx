"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { SERVICE_CATEGORY_LABELS } from "@/modules/services/constants";
import type { ServiceCategory } from "@/modules/services/types";
import { useTRPC } from "@/trpc/client";
import { CHART_COPY as C, METHOD_LABELS } from "../constants";
import type { PeriodInput } from "../period";
import { useAmountFormat } from "./amounts-visibility";
import { DonutChart } from "./donut-chart";
import { SectionCard } from "./section";

/** Counts are never masked. */
const formatCount = (value: number) => String(value);

/** «Modes de paiement» — encaissé per method; five methods, five slices. */
export const PaymentMethodsCard = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getPaymentMethodBreakdown.queryOptions(input),
  );
  const amount = useAmountFormat();

  return (
    <SectionCard title={C.methodsTitle} description={C.methodsDescription}>
      <DonutChart
        ariaLabel={C.methodsTitle}
        total={data.totalCents}
        totalLabel={C.methodsTotal}
        formatValue={amount.full}
        slices={data.slices.map((slice) => ({
          id: slice.method,
          label: METHOD_LABELS[slice.method],
          value: slice.amountCents,
        }))}
      />
    </SectionCard>
  );
};

/** «Production par catégorie d'acte» — produit by catalogue category. */
export const CategoriesCard = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getActesByCategory.queryOptions(input),
  );
  const amount = useAmountFormat();

  return (
    <SectionCard
      title={C.categoriesTitle}
      description={C.categoriesDescription}
    >
      <DonutChart
        ariaLabel={C.categoriesTitle}
        total={data.totalCents}
        totalLabel={C.categoriesTotal}
        formatValue={amount.full}
        slices={data.slices.map((slice) => ({
          id: slice.key,
          isOthers: slice.isOthers,
          label: slice.isOthers
            ? C.others
            : (SERVICE_CATEGORY_LABELS[slice.key as ServiceCategory] ??
              C.otherCategory),
          value: slice.productionCents,
        }))}
      />
    </SectionCard>
  );
};

/** «Patients par assurance» — people, not money; current insurer. */
export const InsurersCard = ({ input }: { input: PeriodInput }) => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.statistics.getInsurerBreakdown.queryOptions(input),
  );

  return (
    <SectionCard title={C.insurersTitle} description={C.insurersDescription}>
      <DonutChart
        ariaLabel={C.insurersTitle}
        total={data.totalPatients}
        totalLabel={C.insurersTotal}
        formatValue={formatCount}
        slices={data.slices.map((slice) => ({
          id: slice.key,
          isOthers: slice.isOthers,
          label: slice.isOthers
            ? C.others
            : slice.isUninsured
              ? C.noInsurer
              : (slice.name ?? C.others),
          value: slice.patients,
        }))}
      />
    </SectionCard>
  );
};
