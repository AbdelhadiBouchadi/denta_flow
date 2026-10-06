"use client";

import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import { SCHEDULE_COPY } from "../constants";

/**
 * The «Horaires» section heading. A non-admin reads why nothing is editable;
 * the notice is cosmetic — every write is an `adminProcedure`. Until the
 * session resolves it does not show.
 */
const SchedulesListHeader = () => {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="font-heading text-h3 text-foreground">
          {SCHEDULE_COPY.sectionTitle}
        </h2>
        <p className="text-muted-foreground text-sm">
          {SCHEDULE_COPY.sectionDescription}
        </p>
      </div>

      {!isAdmin && !isSessionPending && (
        <p className="text-muted-foreground text-sm">
          {SCHEDULE_COPY.adminOnly}
        </p>
      )}
    </div>
  );
};

export default SchedulesListHeader;
