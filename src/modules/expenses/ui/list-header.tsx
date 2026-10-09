"use client";

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
import { EXPENSE_CATEGORY_OPTIONS, EXPENSE_COPY as COPY } from "../constants";
import { useExpensesFilters } from "../hooks/use-expenses-filters";
import NewExpenseDialog from "./new-expense-dialog";

/**
 * No reference screen exists for `/charges`: built from the `/paiements`
 * header — title and primary action, then the filter row. The summary strip
 * sits in the view, inside the Suspense boundary, with the list.
 *
 * The controls are hidden once the session says «not admin» — cosmetic: the
 * view below shows the procedure's forbidden state, and every procedure is
 * `adminProcedure`. While the session loads they are shown: only an admin is
 * offered the link.
 */
const ExpensesListHeader = () => {
  const [filters, setFilters] = useExpensesFilters();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);

  // A filter change re-keys the list query, which suspends. Inside a
  // transition React keeps the current table on screen meanwhile.
  const [isFiltering, startTransition] = useTransition();

  const { data: session } = authClient.useSession();
  const isNonAdmin = !!session && session.user.role !== ADMIN_ROLE;

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

  const hasFilters = Boolean(
    filters.search || filters.category || filters.from || filters.to,
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
        {!isNonAdmin && (
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
            <PlusIcon />
            {COPY.newButton}
          </Button>
        )}
      </div>

      {!isNonAdmin && (
        <div
          data-pending={isFiltering ? "" : undefined}
          className="flex flex-wrap items-center gap-2 data-pending:opacity-70"
        >
          <InputGroup className="h-9 w-full sm:max-w-xs">
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
            value={filters.category}
            onValueChange={(value) => narrow({ category: value })}
            items={[
              { label: COPY.allCategories, value: null },
              ...EXPENSE_CATEGORY_OPTIONS,
            ]}
          >
            <SelectTrigger size="default" className="h-9 max-w-full min-w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>{COPY.allCategories}</SelectItem>
              {EXPENSE_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
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
                narrow({ search: "", category: null, from: "", to: "" });
              }}
            >
              <XIcon />
              {COPY.clearFilters}
            </Button>
          )}
        </div>
      )}

      <NewExpenseDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>
  );
};

export default ExpensesListHeader;
