"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CLINIC_SETTINGS_COPY } from "../constants";
import { useClinicFilters } from "../hooks/use-clinic-filters";

/**
 * One entry of the /parametres section list. `icon` and `content` are
 * elements, not component references: the list is declared in the server
 * `page.tsx`, and only elements cross into a client component.
 */
export interface SettingsSection {
  /** English URL value of `?section=` (AGENTS.md §5). */
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
}

interface SettingsShellProps {
  sections: readonly [SettingsSection, ...SettingsSection[]];
}

/**
 * The /parametres frame: one level of sections, the active one in nuqs as
 * `section`. Later settings branches each add one entry to the list in
 * `page.tsx`; none adds a route, and none touches this file.
 *
 * One card, as in prompt_material/11-parametres-cabinet.webp. ≥ lg: a 240px
 * rail divided from the content by a rule; below lg the same list becomes a
 * horizontally scrolling pill row at the top of the card, so a label is never
 * truncated the way an icon rail truncates it on a phone.
 *
 * The card never sets `overflow`: a section's sticky footer pins to the
 * viewport, and any clipping ancestor would turn that off.
 */
const SettingsShell = ({ sections }: SettingsShellProps) => {
  const [{ section }, setFilters] = useClinicFilters();

  // An unknown `?section=` (a stale link, a removed section) shows the first.
  const active = sections.find(({ id }) => id === section) ?? sections[0];

  return (
    <div className="bg-card text-card-foreground flex flex-1 flex-col rounded-xl border shadow-sm">
      <h1 className="font-heading text-h1 text-foreground px-4 pt-4 md:px-6 md:pt-6">
        {CLINIC_SETTINGS_COPY.pageTitle}
      </h1>

      <div className="flex min-w-0 flex-1 flex-col lg:flex-row">
        <nav
          aria-label={CLINIC_SETTINGS_COPY.sectionsNav}
          className="min-w-0 [scrollbar-width:none] overflow-x-auto border-b px-4 py-4 md:px-6 lg:w-60 lg:shrink-0 lg:overflow-visible lg:border-r lg:border-b-0 lg:px-4 lg:py-6 [&::-webkit-scrollbar]:hidden"
        >
          <ul className="flex w-max gap-2 lg:w-full lg:flex-col lg:gap-1">
            {sections.map(({ id, label, icon }) => {
              const isActive = id === active.id;

              return (
                <li key={id}>
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => void setFilters({ section: id })}
                    className={cn(
                      "text-ui focus-visible:ring-ring/50 flex h-9 items-center gap-2 rounded-full border px-4 font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-3 lg:h-10 lg:w-full lg:rounded-lg lg:border-transparent lg:px-3 [&_svg]:size-4 [&_svg]:shrink-0",
                      isActive
                        ? "bg-accent text-accent-foreground border-transparent"
                        : "text-foreground-secondary hover:bg-muted hover:text-foreground border-border",
                    )}
                  >
                    {icon}
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section
          aria-label={active.label}
          className="min-w-0 flex-1 p-4 md:p-6"
        >
          {active.content}
        </section>
      </div>
    </div>
  );
};

export default SettingsShell;
