"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { APPOINTMENT_TYPE_COPY } from "../constants";
import NewAppointmentTypeDialog from "./new-appointment-type-dialog";

/**
 * «Ajouter» and the dialog it opens. The section header and the empty state
 * both render it; callers show it to admins only.
 */
const NewAppointmentTypeButton = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button size="lg" onClick={() => setIsDialogOpen(true)}>
        <PlusIcon />
        {APPOINTMENT_TYPE_COPY.add}
      </Button>
      <NewAppointmentTypeDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
};

export default NewAppointmentTypeButton;
