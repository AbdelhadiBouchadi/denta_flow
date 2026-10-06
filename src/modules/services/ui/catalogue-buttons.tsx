"use client";

import { FileDownIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SERVICE_COPY } from "../constants";
import ImportNgapDialog from "./import-ngap-dialog";
import NewServiceDialog from "./new-service-dialog";

/**
 * «Ajouter un acte» and «Importer depuis la NGAP», with their dialogs. The
 * section header and the empty catalogue both render them; callers show them
 * to admins only.
 */
const CatalogueButtons = () => {
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" variant="outline" onClick={() => setIsImportOpen(true)}>
        <FileDownIcon />
        {SERVICE_COPY.importNgap}
      </Button>
      <Button size="lg" onClick={() => setIsNewOpen(true)}>
        <PlusIcon />
        {SERVICE_COPY.add}
      </Button>

      <NewServiceDialog open={isNewOpen} onOpenChange={setIsNewOpen} />
      <ImportNgapDialog open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  );
};

export default CatalogueButtons;
