"use client";

import { authClient } from "@/lib/auth-client";
import { StaffRole } from "@/modules/staff/types";
import { TAG_COPY } from "../constants";
import NewTagButton from "./new-tag-button";

/**
 * The «Tags» section heading. Admins get «Ajouter»; everyone else reads why
 * there is no button. Both are cosmetic — `tags.*` writes are
 * `adminProcedure`. Until the session resolves neither shows.
 */
const TagsListHeader = () => {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-h3 text-foreground">
            {TAG_COPY.sectionTitle}
          </h2>
          <p className="text-muted-foreground text-sm">
            {TAG_COPY.sectionDescription}
          </p>
        </div>

        {isAdmin && <NewTagButton />}
      </div>

      {!isAdmin && !isSessionPending && (
        <p className="text-muted-foreground text-sm">{TAG_COPY.adminOnly}</p>
      )}
    </div>
  );
};

export default TagsListHeader;
