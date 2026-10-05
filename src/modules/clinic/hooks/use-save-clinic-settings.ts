"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ImageChange } from "@/components/shared/image-dropzone";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import { CLINIC_SETTINGS_COPY } from "../constants";
import type { ClinicSettingsValues } from "../schemas";
import { ClinicAssetKind, type ClinicSettings } from "../types";

interface SaveClinicSettingsInput {
  values: ClinicSettingsValues;
  logo: ImageChange;
  letterhead: ImageChange;
}

interface UseSaveClinicSettingsOptions {
  /** Runs after the cache holds the saved row — reset the form to it here. */
  onSaved: (saved: ClinicSettings) => void;
}

/**
 * The 11a save contract. Nothing uploads on drop: on «Enregistrer», each
 * staged replacement is uploaded first, then one `clinic.update` writes the
 * row. Uploads run one after the other, so a failed logo upload stops before
 * the letterhead is ever sent.
 *
 * Any failure — upload or update — toasts and rejects without touching the
 * form or the staged images, so the user can retry as is. A failed update
 * after a successful upload leaves one orphan blob: an accepted gap.
 */
export const useSaveClinicSettings = ({
  onSaved,
}: UseSaveClinicSettingsOptions) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const uploadAsset = useMutation(trpc.clinic.uploadAsset.mutationOptions());
  const updateClinic = useMutation(trpc.clinic.update.mutationOptions());

  /** `url` for a replacement, `null` for a removal, `undefined` to keep. */
  const resolveAsset = async (kind: ClinicAssetKind, change: ImageChange) => {
    if (change.kind === "unchanged") return undefined;
    if (change.kind === "remove") return null;

    const formData = new FormData();
    formData.set("kind", kind);
    formData.set("file", change.file);
    const { url } = await uploadAsset.mutateAsync(formData);
    return url;
  };

  return useMutation({
    mutationFn: async ({
      values,
      logo,
      letterhead,
    }: SaveClinicSettingsInput) => {
      const logoUrl = await resolveAsset(ClinicAssetKind.Logo, logo);
      const letterheadUrl = await resolveAsset(
        ClinicAssetKind.Letterhead,
        letterhead,
      );

      return updateClinic.mutateAsync({
        ...values,
        ...(logoUrl !== undefined && { logoUrl }),
        ...(letterheadUrl !== undefined && { letterheadUrl }),
      });
    },
    onSuccess: async (saved) => {
      // Refreshes the sidebar brand too — it reads the same query.
      await queryClient.invalidateQueries(trpc.clinic.get.queryFilter());
      onSaved(saved);
      toast.success(CLINIC_SETTINGS_COPY.saved);
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
};
