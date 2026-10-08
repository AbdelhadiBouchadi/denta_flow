"use client";

import { useQuery } from "@tanstack/react-query";
import { PlusIcon, SearchIcon, XIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import DayFilter from "@/components/shared/day-filter";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEFAULT_PAGE } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import { insurerOptionLabel } from "@/modules/insurers/options";
import { useTRPC } from "@/trpc/client";
import { PAYMENT_COPY as COPY, PAYMENT_METHOD_OPTIONS } from "../constants";
import { usePaymentsFilters } from "../hooks/use-payments-filters";
import NewPaymentDialog from "./new-payment-dialog";
import PaymentSummary from "./payment-summary";

/**
 * No reference screen exists for `/paiements`: built from the `/patients`,
 * `/rendez-vous` and `/actes` headers — title and primary action, the admin
 * totals, then the filter row.
 */
const PaymentsListHeader = () => {
  const trpc = useTRPC();
  const [filters, setFilters] = usePaymentsFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);

  // A filter change re-keys the list query, which suspends. Inside a
  // transition React keeps the current table on screen meanwhile.
  const [isFiltering, startTransition] = useTransition();

  // Cosmetic only: getSummary is an adminProcedure (AGENTS.md §2).
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;

  // The URL's search changed from elsewhere (back button, «Effacer»): re-seed
  // the input during render rather than in an effect.
  const [syncedSearch, setSyncedSearch] = useState(filters.search);
  if (syncedSearch !== filters.search) {
    setSyncedSearch(filters.search);
    setSearchInput(filters.search);
  }

  // Debounced: the URL — and the query key — follow the input 300 ms later,
  // back on page 1.
  useEffect(() => {
    if (searchInput === filters.search) return;
    const id = window.setTimeout(
      () =>
        startTransition(() => {
          void setFilters({ search: searchInput, page: DEFAULT_PAGE });
        }),
      300,
    );
    return () => window.clearTimeout(id);
  }, [searchInput, filters.search, setFilters]);

  // Prefetched by the route; every insurer, inactive ones included — old
  // reimbursements still name them.
  const { data: insurers } = useQuery(trpc.insurers.getMany.queryOptions());

  const hasFilters = Boolean(
    filters.search ||
      filters.method ||
      filters.insurerId ||
      filters.from ||
      filters.to,
  );

  // Every narrowing change goes back to page 1 (05-slice.md §4).
  const narrow = (next: Omit<Partial<typeof filters>, "page">) =>
    startTransition(() => {
      void setFilters({ ...next, page: DEFAULT_PAGE });
    });

  return (
    <div className="flex flex-col gap-4 px-4 pt-6 pb-4 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-h1 text-foreground">
          {COPY.pageTitle}
        </h1>
        <Button size="lg" onClick={() => setIsDialogOpen(true)}>
          <PlusIcon />
          {COPY.newButton}
        </Button>
      </div>

      {isAdmin && <PaymentSummary />}

      <div
        data-pending={isFiltering ? "" : undefined}
        className="flex flex-wrap items-center gap-2 data-pending:opacity-70"
      >
        <InputGroup className="h-9 w-full max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            type="search"
            aria-label={COPY.searchLabel}
            placeholder={COPY.searchPlaceholder}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </InputGroup>

        <Select
          value={filters.method}
          onValueChange={(value) => narrow({ method: value })}
          items={[
            { label: COPY.allMethods, value: null },
            ...PAYMENT_METHOD_OPTIONS,
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allMethods}</SelectItem>
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.insurerId || null}
          onValueChange={(value) => narrow({ insurerId: value ?? "" })}
          items={[
            { label: COPY.allInsurers, value: null },
            ...(insurers?.items.map((insurer) => ({
              label: insurerOptionLabel(insurer),
              value: insurer.id,
            })) ?? []),
          ]}
        >
          <SelectTrigger size="default" className="h-9 min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>{COPY.allInsurers}</SelectItem>
            {insurers?.items.map((insurer) => (
              <SelectItem key={insurer.id} value={insurer.id}>
                {insurerOptionLabel(insurer)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DayFilter
          label={COPY.from}
          value={filters.from}
          onChange={(from) => narrow({ from })}
        />
        <DayFilter
          label={COPY.to}
          value={filters.to}
          onChange={(to) => narrow({ to })}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="lg"
            onClick={() => {
              setSearchInput("");
              narrow({
                search: "",
                method: null,
                insurerId: "",
                from: "",
                to: "",
              });
            }}
          >
            <XIcon />
            {COPY.clearFilters}
          </Button>
        )}
      </div>

      <NewPaymentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default PaymentsListHeader;
