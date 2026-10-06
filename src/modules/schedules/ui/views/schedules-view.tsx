"use client";

import ErrorState from "@/components/shared/error-state";
import LoadingState from "@/components/shared/loading-state";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import { SCHEDULE_COPY } from "../../constants";
import { ExceptionsList } from "../exceptions-list";
import { WeeklyHours } from "../weekly-hours";

/**
 * The «Horaires» section of /parametres: one view, two stacked blocks, no
 * inner tabs. Every query is prefetched by the page.
 *
 * `isAdmin` is cosmetic only — every write is an `adminProcedure`. A
 * non-admin (or a session still resolving) gets the read-only rendering.
 */
const SchedulesView = () => {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;

  return (
    <div className="flex flex-col gap-8">
      <WeeklyHours isAdmin={isAdmin} />
      <Separator />
      <ExceptionsList isAdmin={isAdmin} />
    </div>
  );
};

export const SchedulesViewLoading = () => (
  <LoadingState
    title={SCHEDULE_COPY.loadingTitle}
    description={SCHEDULE_COPY.loadingDescription}
  />
);

export const SchedulesViewError = () => (
  <ErrorState
    title={SCHEDULE_COPY.errorTitle}
    description={SCHEDULE_COPY.errorDescription}
  />
);

export default SchedulesView;
