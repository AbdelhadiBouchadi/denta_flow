"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { STAFF_COPY } from "../constants";
import { StaffRole, type StaffCreated } from "../types";
import NewStaffDialog from "./new-staff-dialog";
import TemporaryPasswordDialog from "./temporary-password-dialog";

/**
 * The «Utilisateurs» section heading. Admins get «Ajouter un utilisateur»;
 * everyone else reads why there is no button. Both are cosmetic — `staff.*`
 * writes are `adminProcedure`. Until the session resolves neither shows, so an
 * admin never sees the notice flash.
 */
const StaffListHeader = () => {
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const isAdmin = session?.user.role === StaffRole.Admin;

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [created, setCreated] = useState<StaffCreated | null>(null);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="font-heading text-h3 text-foreground">
            {STAFF_COPY.sectionTitle}
          </h2>
          <p className="text-muted-foreground text-sm">
            {STAFF_COPY.sectionDescription}
          </p>
        </div>

        {isAdmin && (
          <Button size="lg" onClick={() => setIsDialogOpen(true)}>
            <PlusIcon />
            {STAFF_COPY.add}
          </Button>
        )}
      </div>

      {!isAdmin && !isSessionPending && (
        <p className="text-muted-foreground text-sm">{STAFF_COPY.adminOnly}</p>
      )}

      {isAdmin && (
        <>
          <NewStaffDialog
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            onCreated={setCreated}
          />
          <TemporaryPasswordDialog
            result={created}
            onClose={() => setCreated(null)}
          />
        </>
      )}
    </div>
  );
};

export default StaffListHeader;
