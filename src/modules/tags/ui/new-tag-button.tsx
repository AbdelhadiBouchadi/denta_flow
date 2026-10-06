"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { TAG_COPY } from "../constants";
import NewTagDialog from "./new-tag-dialog";

/**
 * «Ajouter» and the dialog it opens. The section header and the empty state
 * both render it; callers show it to admins only.
 */
const NewTagButton = () => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button size="lg" onClick={() => setIsDialogOpen(true)}>
        <PlusIcon />
        {TAG_COPY.add}
      </Button>
      <NewTagDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </>
  );
};

export default NewTagButton;
