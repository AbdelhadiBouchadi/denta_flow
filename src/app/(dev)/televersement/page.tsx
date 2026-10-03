"use client";

// THROWAWAY — branch 11a round trip for ImageDropzone + clinic.uploadAsset.
// Sign in as the admin first (the procedure, not this page, enforces it).
// Deleted before the PR; branch 11 owns the real settings form.
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import ImageDropzone, {
  type ImageChange,
} from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import { ClinicAssetKind } from "@/modules/clinic/types";
import { useTRPC } from "@/trpc/client";

const UNCHANGED: ImageChange = { kind: "unchanged" };

export default function UploadRoundTripPage() {
  const trpc = useTRPC();
  const upload = useMutation(trpc.clinic.uploadAsset.mutationOptions());

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [letterheadUrl, setLetterheadUrl] = useState<string | null>(null);
  const [logoChange, setLogoChange] = useState<ImageChange>(UNCHANGED);
  const [letterheadChange, setLetterheadChange] =
    useState<ImageChange>(UNCHANGED);

  const send = async (kind: ClinicAssetKind, change: ImageChange) => {
    if (change.kind !== "replace") return undefined;
    const form = new FormData();
    form.set("kind", kind);
    form.set("file", change.file);
    const { url } = await upload.mutateAsync(form);
    return url;
  };

  const save = async () => {
    try {
      const nextLogo = await send(ClinicAssetKind.Logo, logoChange);
      const nextLetterhead = await send(
        ClinicAssetKind.Letterhead,
        letterheadChange,
      );
      if (nextLogo) setLogoUrl(nextLogo);
      else if (logoChange.kind === "remove") setLogoUrl(null);
      if (nextLetterhead) setLetterheadUrl(nextLetterhead);
      else if (letterheadChange.kind === "remove") setLetterheadUrl(null);
      setLogoChange(UNCHANGED);
      setLetterheadChange(UNCHANGED);
      toast.success("Images enregistrées");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erreur");
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <ImageDropzone
          id="logo"
          label="Logo du cabinet"
          hint="Carré de préférence"
          value={logoUrl}
          change={logoChange}
          onChange={setLogoChange}
          disabled={upload.isPending}
          aspectClassName="aspect-square"
        />
        <ImageDropzone
          id="letterhead"
          label="Papier à en-tête"
          hint="Format A5 portrait"
          value={letterheadUrl}
          change={letterheadChange}
          onChange={setLetterheadChange}
          disabled={upload.isPending}
          aspectClassName="aspect-[148/210]"
        />
      </div>
      <Button
        type="button"
        className="self-start"
        disabled={upload.isPending}
        onClick={save}
      >
        Enregistrer
      </Button>
      <pre className="text-muted-foreground text-xs break-all whitespace-pre-wrap">
        {JSON.stringify({ logoUrl, letterheadUrl }, null, 2)}
      </pre>
    </main>
  );
}
