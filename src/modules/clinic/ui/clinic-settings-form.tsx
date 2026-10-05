"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { InfoIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, type Control } from "react-hook-form";

import ImageDropzone, {
  type ImageChange,
} from "@/components/shared/image-dropzone";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import { ADMIN_ROLE } from "@/modules/dashboard/constants";
import {
  CLINIC_ASSET_HINTS,
  CLINIC_FIELD_LABELS,
  CLINIC_FIELD_PLACEHOLDERS,
  CLINIC_SETTINGS_COPY,
} from "../constants";
import { useSaveClinicSettings } from "../hooks/use-save-clinic-settings";
import {
  clinicSettingsFormSchema,
  type ClinicSettingsFormValues,
  type ClinicSettingsValues,
} from "../schemas";
import type { ClinicSettings } from "../types";

const UNCHANGED: ImageChange = { kind: "unchanged" };

interface ClinicSettingsFormProps {
  clinic: ClinicSettings;
}

/** The row returns `null` for an unknown field; an input needs "". */
const toFormValues = (clinic: ClinicSettings): ClinicSettingsFormValues => ({
  name: clinic.name,
  address: clinic.address ?? "",
  city: clinic.city ?? "",
  phone: clinic.phone ?? "",
  email: clinic.email ?? "",
  ice: clinic.ice ?? "",
  patente: clinic.patente ?? "",
  fiscalId: clinic.fiscalId ?? "",
  cnssNumber: clinic.cnssNumber ?? "",
  inpe: clinic.inpe ?? "",
});

export const ClinicSettingsForm = ({ clinic }: ClinicSettingsFormProps) => {
  // Cosmetic only — `clinic.update` and `clinic.uploadAsset` are
  // `adminProcedure` and reject a non-admin whatever this shows (AGENTS.md
  // §1.5). Until the session resolves the form stays locked, without the
  // non-admin notice, so an admin never sees it flash.
  const { data: session, isPending: isSessionPending } =
    authClient.useSession();
  const isAdmin = session?.user.role === ADMIN_ROLE;
  const isReadOnly = !isAdmin;

  const [logoChange, setLogoChange] = useState<ImageChange>(UNCHANGED);
  const [letterheadChange, setLetterheadChange] =
    useState<ImageChange>(UNCHANGED);

  const form = useForm<ClinicSettingsFormValues, unknown, ClinicSettingsValues>(
    {
      resolver: zodResolver(clinicSettingsFormSchema),
      defaultValues: toFormValues(clinic),
    },
  );

  const resetAll = (next: ClinicSettings) => {
    form.reset(toFormValues(next));
    setLogoChange(UNCHANGED);
    setLetterheadChange(UNCHANGED);
  };

  const save = useSaveClinicSettings({ onSaved: resetAll });

  const isDisabled = isReadOnly || save.isPending;
  const hasChanges =
    form.formState.isDirty ||
    logoChange.kind !== "unchanged" ||
    letterheadChange.kind !== "unchanged";

  const onSubmit = (values: ClinicSettingsValues) =>
    save.mutate({ values, logo: logoChange, letterhead: letterheadChange });

  const textField = (name: TextFieldName, inputMode?: "tel" | "email") => (
    <TextField
      control={form.control}
      name={name}
      inputMode={inputMode}
      disabled={isDisabled}
    />
  );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex flex-col gap-6"
    >
      <p className="bg-info-subtle text-info-strong flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-medium">
        <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
        {CLINIC_SETTINGS_COPY.saveReminder}
      </p>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <FieldGroup className="gap-4">
          {textField("name")}
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("address")}
            {textField("city")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("ice")}
            {textField("patente")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("fiscalId")}
            {textField("cnssNumber")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {textField("inpe")}
            {textField("phone", "tel")}
          </div>
          {textField("email", "email")}
        </FieldGroup>

        <div className="grid content-start gap-6 sm:grid-cols-2 lg:grid-cols-1">
          <ImageDropzone
            id="logoUrl"
            label={CLINIC_FIELD_LABELS.logoUrl}
            hint={CLINIC_ASSET_HINTS.logo}
            value={clinic.logoUrl}
            change={logoChange}
            onChange={setLogoChange}
            disabled={isDisabled}
            aspectClassName="aspect-square"
          />
          <ImageDropzone
            id="letterheadUrl"
            label={CLINIC_FIELD_LABELS.letterheadUrl}
            hint={CLINIC_ASSET_HINTS.letterhead}
            value={clinic.letterheadUrl}
            change={letterheadChange}
            onChange={setLetterheadChange}
            disabled={isDisabled}
            // A5 portrait: 148 × 210 mm.
            aspectClassName="aspect-[148/210]"
          />
        </div>
      </div>

      {/* Below lg the form is longer than a phone screen: the bar sticks to
          the viewport's bottom edge so saving never needs a scroll. It bleeds
          over the section's padding to span the card, and pads for the iOS
          home indicator. ≥ lg it is an ordinary footer. */}
      {isAdmin && (
        <div className="bg-card/95 sticky bottom-0 z-10 -mx-4 grid grid-cols-2 gap-2 border-t px-4 pt-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] backdrop-blur md:-mx-6 md:px-6 lg:static lg:mx-0 lg:flex lg:justify-end lg:bg-transparent lg:px-0 lg:pt-4 lg:pb-0 lg:backdrop-blur-none">
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={save.isPending || !hasChanges}
            onClick={() => resetAll(clinic)}
            className="w-full lg:w-auto"
          >
            {CLINIC_SETTINGS_COPY.reset}
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={save.isPending || !hasChanges}
            className="w-full lg:w-auto"
          >
            {save.isPending && (
              <Spinner aria-label={CLINIC_SETTINGS_COPY.saving} />
            )}
            {save.isPending
              ? CLINIC_SETTINGS_COPY.saving
              : CLINIC_SETTINGS_COPY.save}
          </Button>
        </div>
      )}

      {!isAdmin && !isSessionPending && (
        <p className="text-muted-foreground border-t pt-4 text-sm">
          {CLINIC_SETTINGS_COPY.adminOnly}
        </p>
      )}
    </form>
  );
};

type TextFieldName = keyof ClinicSettingsFormValues;

interface TextFieldProps {
  control: Control<ClinicSettingsFormValues>;
  name: TextFieldName;
  disabled: boolean;
  inputMode?: "tel" | "email";
}

/** The five-part field shape — label, input, error — for every text field. */
const TextField = ({ control, name, disabled, inputMode }: TextFieldProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>
          {CLINIC_FIELD_LABELS[name]}
          {name === "name" && (
            <span aria-hidden="true" className="text-destructive">
              *
            </span>
          )}
        </FieldLabel>
        <Input
          {...field}
          id={field.name}
          value={field.value ?? ""}
          inputMode={inputMode}
          disabled={disabled}
          required={name === "name"}
          aria-invalid={fieldState.invalid}
          placeholder={CLINIC_FIELD_PLACEHOLDERS[name]}
          className="h-9"
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);
