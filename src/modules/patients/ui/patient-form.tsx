"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Controller, useForm, type Control } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { clinicNow } from "@/lib/time";
import { useTRPC } from "@/trpc/client";
import { GENDER_OPTIONS, NO_INSURER_LABEL } from "../constants";
import { useInvalidatePatients } from "../hooks/use-invalidate-patients";
import {
  patientInsertSchema,
  type PatientFormValues,
  type PatientInsertValues,
} from "../schemas";
import type { PatientGetOne } from "../types";
import { PatientTags } from "./patient-tags";

/** The oldest birth date the picker offers. */
const EARLIEST_BIRTH_YEAR = 1900;

interface PatientFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: PatientGetOne;
}

/** The dossier returns `null` for an unknown field; an input needs "". */
const toFormValues = (patient?: PatientGetOne): PatientFormValues => ({
  firstName: patient?.firstName ?? "",
  lastName: patient?.lastName ?? "",
  phone: patient?.phone ?? "",
  secondaryPhone: patient?.secondaryPhone ?? "",
  email: patient?.email ?? "",
  birthDate: patient?.birthDate ?? "",
  gender: patient?.gender ?? null,
  address: patient?.address ?? "",
  city: patient?.city ?? "",
  cin: patient?.cin ?? "",
  profession: patient?.profession ?? "",
  insurerId: patient?.insurerId ?? "",
  insuranceNumber: patient?.insuranceNumber ?? "",
  allergies: patient?.allergies ?? "",
  medicalNotes: patient?.medicalNotes ?? "",
  tagIds: patient?.tags.map((tag) => tag.id) ?? [],
});

export const PatientForm = ({
  onSuccess,
  onCancel,
  initialValues,
}: PatientFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidatePatients();

  // Options for a dialog, not a page: plain useQuery, and `data` may be
  // undefined for a moment (04-hydration.md §4 rule 8). Both lists are
  // prefetched by the route, so in practice they resolve from the cache.
  const { data: tags } = useQuery(trpc.tags.getMany.queryOptions());
  const { data: insurers } = useQuery(trpc.insurers.getMany.queryOptions());

  const isEdit = !!initialValues?.id;

  const form = useForm<PatientFormValues, unknown, PatientInsertValues>({
    resolver: zodResolver(patientInsertSchema),
    defaultValues: toFormValues(initialValues),
  });

  const createPatient = useMutation(
    trpc.patients.create.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success("Patient enregistré");
        onSuccess?.();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const updatePatient = useMutation(
    trpc.patients.update.mutationOptions({
      onSuccess: async () => {
        // The same block as create: an update that refreshed less than a
        // create would leave the dossier showing the old figures.
        await invalidateAll();
        toast.success("Patient mis à jour");
        onSuccess?.();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const isPending = createPatient.isPending || updatePatient.isPending;

  const onSubmit = (values: PatientInsertValues) => {
    if (isEdit) {
      updatePatient.mutate({ ...values, id: initialValues.id });
      return;
    }
    createPatient.mutate(values);
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldSet>
        <FieldLegend variant="label">Identité</FieldLegend>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="lastName"
              label="Nom"
              placeholder="ex. Benali"
              disabled={isPending}
              autoFocus
            />
            <TextField
              control={form.control}
              name="firstName"
              label="Prénom"
              placeholder="ex. Karim"
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="birthDate"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    Date de naissance
                  </FieldLabel>
                  <Popover>
                    <PopoverTrigger
                      render={
                        <Button
                          id={field.name}
                          type="button"
                          variant="outline"
                          size="lg"
                          disabled={isPending}
                          aria-invalid={fieldState.invalid}
                          className="w-full justify-between font-normal"
                        />
                      }
                    >
                      {field.value ? (
                        formatDate(field.value)
                      ) : (
                        <span className="text-muted-foreground">
                          Choisir une date
                        </span>
                      )}
                      <CalendarIcon className="text-muted-foreground" />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        locale={fr}
                        captionLayout="dropdown"
                        startMonth={new Date(EARLIEST_BIRTH_YEAR, 0)}
                        endMonth={clinicNow()}
                        defaultMonth={
                          field.value ? parseISO(field.value) : undefined
                        }
                        selected={
                          field.value ? parseISO(field.value) : undefined
                        }
                        onSelect={(date) =>
                          field.onChange(date ? format(date, "yyyy-MM-dd") : "")
                        }
                      />
                    </PopoverContent>
                  </Popover>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="gender"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Sexe</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={isPending}
                    items={[
                      { label: "Non précisé", value: null },
                      ...GENDER_OPTIONS,
                    ]}
                  >
                    <SelectTrigger size="default" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>Non précisé</SelectItem>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="cin"
              label="CIN"
              placeholder="ex. JK012938"
              disabled={isPending}
            />
            <TextField
              control={form.control}
              name="profession"
              label="Profession"
              placeholder="ex. Enseignante"
              disabled={isPending}
            />
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Contact</FieldLegend>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="phone"
              label="Téléphone"
              placeholder="ex. 06 12 34 56 78"
              inputMode="tel"
              disabled={isPending}
            />
            <TextField
              control={form.control}
              name="secondaryPhone"
              label="Téléphone secondaire"
              placeholder="ex. 05 28 84 32 17"
              inputMode="tel"
              disabled={isPending}
            />
          </div>

          <TextField
            control={form.control}
            name="email"
            label="Adresse e-mail"
            placeholder="ex. karim.benali@example.ma"
            inputMode="email"
            disabled={isPending}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="address"
              label="Adresse"
              placeholder="ex. 14, rue Ibn Sina"
              disabled={isPending}
            />
            <TextField
              control={form.control}
              name="city"
              label="Ville"
              placeholder="ex. Agadir"
              disabled={isPending}
            />
          </div>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Couverture</FieldLegend>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              control={form.control}
              name="insurerId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Assurance</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    disabled={isPending || !insurers}
                    items={[
                      { label: NO_INSURER_LABEL, value: null },
                      ...(insurers?.items.map((insurer) => ({
                        label: insurer.name,
                        value: insurer.id,
                      })) ?? []),
                    ]}
                  >
                    <SelectTrigger size="default" className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>{NO_INSURER_LABEL}</SelectItem>
                      {insurers?.items.map((insurer) => (
                        <SelectItem key={insurer.id} value={insurer.id}>
                          {insurer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <TextField
              control={form.control}
              name="insuranceNumber"
              label="Numéro d’assuré"
              placeholder="ex. 7392146"
              disabled={isPending}
            />
          </div>

          <Controller
            control={form.control}
            name="tagIds"
            render={({ field, fieldState }) => {
              const selected = field.value ?? [];

              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>Tags</FieldLabel>
                  <Select
                    multiple
                    id={field.name}
                    value={selected}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={isPending || !tags}
                  >
                    <SelectTrigger size="default" className="h-9 w-full">
                      <SelectValue>
                        {() =>
                          selected.length === 0 ? (
                            <span className="text-muted-foreground">
                              Aucun tag
                            </span>
                          ) : (
                            <PatientTags
                              max={selected.length}
                              tags={
                                tags?.items.filter((tag) =>
                                  selected.includes(tag.id),
                                ) ?? []
                              }
                            />
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {tags?.items.map((tag) => (
                        <SelectItem key={tag.id} value={tag.id}>
                          {tag.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              );
            }}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        {/* Not «Dossier médical»: that is the structured tab and its own form.
            These two stay on the patient row, where the header reads them. */}
        <FieldLegend variant="label">Allergies et notes</FieldLegend>
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="allergies"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Allergies</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  value={field.value ?? ""}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder="ex. Pénicilline, latex"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="medicalNotes"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Notes médicales</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  value={field.value ?? ""}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder="Remarques libres — les antécédents se saisissent dans l’onglet Dossier médical"
                  className="min-h-24"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending && (
            <Spinner
              aria-label={
                isEdit ? "Mise à jour en cours" : "Enregistrement en cours"
              }
            />
          )}
          {isPending
            ? isEdit
              ? "Mise à jour…"
              : "Enregistrement…"
            : isEdit
              ? "Mettre à jour"
              : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
};

/** The five-part field shape, for the plain text inputs that repeat. */
interface TextFieldProps {
  control: Control<PatientFormValues>;
  name:
    | "firstName"
    | "lastName"
    | "phone"
    | "secondaryPhone"
    | "email"
    | "address"
    | "city"
    | "cin"
    | "profession"
    | "insuranceNumber";
  label: string;
  placeholder: string;
  disabled: boolean;
  inputMode?: "tel" | "email";
  autoFocus?: boolean;
}

const TextField = ({
  control,
  name,
  label,
  placeholder,
  disabled,
  inputMode,
  autoFocus,
}: TextFieldProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Input
          {...field}
          id={field.name}
          value={field.value ?? ""}
          inputMode={inputMode}
          autoFocus={autoFocus}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          placeholder={placeholder}
          className="h-9"
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);
