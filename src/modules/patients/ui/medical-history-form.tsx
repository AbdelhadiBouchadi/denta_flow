"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  Controller,
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import {
  BLOOD_TYPE_OPTIONS,
  MEDICAL_ALERT_DESCRIPTIONS,
  MEDICAL_CONDITION_OPTIONS,
  SMOKING_STATUS_OPTIONS,
  TRI_STATE_LABELS,
} from "../constants";
import { getCurrentPregnancyWeeks, isMedicalCondition } from "../derived";
import { useInvalidatePatients } from "../hooks/use-invalidate-patients";
import {
  medicalHistorySchema,
  type MedicalHistoryFormValues,
  type MedicalHistoryValues,
} from "../schemas";
import {
  BloodType,
  Gender,
  MedicalAlert,
  SmokingStatus,
  type PatientGetOne,
  type PatientMedicalHistory,
} from "../types";

interface MedicalHistoryFormProps {
  /** The whole dossier: the form needs the history, the id and the sex. */
  patient: PatientGetOne;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/**
 * The saved history, as the form edits it. A never-filled dossier starts from
 * «nothing declared», which is what an untouched form would submit anyway.
 *
 * The term starts from today's figure, not the recorded one: saving the
 * dossier months later for an unrelated edit must not write the old term back
 * with a fresh `updatedAt` (see `getCurrentPregnancyWeeks`).
 */
const toFormValues = (
  history: PatientMedicalHistory,
): MedicalHistoryFormValues => ({
  conditions: history?.conditions.filter(isMedicalCondition) ?? [],
  onAnticoagulants: history?.onAnticoagulants ?? false,
  onBisphosphonates: history?.onBisphosphonates ?? false,
  needsAntibioticProphylaxis: history?.needsAntibioticProphylaxis ?? false,
  isPregnant: history?.isPregnant ?? null,
  pregnancyWeeks: history
    ? getCurrentPregnancyWeeks(history.pregnancyWeeks, history.updatedAt)
    : null,
  isBreastfeeding: history?.isBreastfeeding ?? null,
  currentMedications: history?.currentMedications ?? "",
  surgicalHistory: history?.surgicalHistory ?? "",
  anesthesiaReactions: history?.anesthesiaReactions ?? "",
  smoking: (history?.smoking as SmokingStatus) ?? SmokingStatus.None,
  bruxism: history?.bruxism ?? false,
  bloodType: (history?.bloodType as BloodType | null) ?? null,
  primaryDoctorName: history?.primaryDoctorName ?? "",
  primaryDoctorPhone: history?.primaryDoctorPhone ?? "",
  emergencyContactName: history?.emergencyContactName ?? "",
  emergencyContactPhone: history?.emergencyContactPhone ?? "",
  emergencyContactRelation: history?.emergencyContactRelation ?? "",
});

/** The critical flags, in the order the header shows their pills. */
const CRITICAL_FLAGS = [
  {
    name: "onAnticoagulants",
    title: "Sous anticoagulants",
    alert: MedicalAlert.Anticoagulants,
  },
  {
    name: "onBisphosphonates",
    title: "Sous bisphosphonates",
    alert: MedicalAlert.Bisphosphonates,
  },
  {
    name: "needsAntibioticProphylaxis",
    title: "Antibioprophylaxie requise",
    alert: MedicalAlert.AntibioticProphylaxis,
  },
] as const;

export const MedicalHistoryForm = ({
  patient,
  onSuccess,
  onCancel,
}: MedicalHistoryFormProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidatePatients();

  // Pregnancy does not apply to a patient recorded as a man. An unknown sex
  // keeps the section: hiding a critical question on a missing field is the
  // wrong way round.
  const canBePregnant = (patient.gender as Gender | null) !== Gender.Male;

  const form = useForm<MedicalHistoryFormValues, unknown, MedicalHistoryValues>(
    {
      resolver: zodResolver(medicalHistorySchema),
      defaultValues: toFormValues(patient.medicalHistory),
    },
  );

  const isPregnant = useWatch({ control: form.control, name: "isPregnant" });

  const upsert = useMutation(
    trpc.patients.upsertMedicalHistory.mutationOptions({
      onSuccess: async () => {
        // The slice's one invalidation block, like every patients mutation:
        // the header pills are read from the same getOne as this tab.
        await invalidateAll();
        toast.success("Dossier médical enregistré");
        onSuccess?.();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const isPending = upsert.isPending;

  const onSubmit = (values: MedicalHistoryValues) => {
    upsert.mutate({
      ...values,
      // The section was hidden, so whatever it held was never seen — clear it
      // rather than save an answer nobody could check.
      ...(canBePregnant
        ? {}
        : { isPregnant: null, pregnancyWeeks: null, isBreastfeeding: null }),
      patientId: patient.id,
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto px-4"
    >
      <FieldSet>
        <FieldLegend variant="label">Antécédents médicaux</FieldLegend>
        <Controller
          control={form.control}
          name="conditions"
          render={({ field, fieldState }) => {
            const selected = field.value ?? [];
            const toggle = (key: string, checked: boolean) =>
              field.onChange(
                checked
                  ? [...selected, key]
                  : selected.filter((value) => value !== key),
              );

            return (
              <Field data-invalid={fieldState.invalid}>
                <FieldGroup
                  data-slot="checkbox-group"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  {MEDICAL_CONDITION_OPTIONS.map((option) => {
                    const id = `condition-${option.value}`;
                    return (
                      <Field key={option.value} orientation="horizontal">
                        <Checkbox
                          id={id}
                          checked={selected.includes(option.value)}
                          onCheckedChange={(checked) =>
                            toggle(option.value, checked)
                          }
                          disabled={isPending}
                        />
                        <FieldLabel htmlFor={id} className="font-normal">
                          {option.label}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </FieldGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            );
          }}
        />

        <FieldGroup className="gap-4">
          <TextAreaField
            control={form.control}
            name="surgicalHistory"
            label="Antécédents chirurgicaux et hospitalisations"
            placeholder="ex. Appendicectomie (2015)"
            disabled={isPending}
          />

          <Controller
            control={form.control}
            name="bloodType"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Groupe sanguin</FieldLabel>
                <Select
                  id={field.name}
                  value={field.value ?? null}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending}
                  items={[
                    { label: TRI_STATE_LABELS.unknown, value: null },
                    ...BLOOD_TYPE_OPTIONS,
                  ]}
                >
                  <SelectTrigger size="default" className="h-9 w-full sm:w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>
                      {TRI_STATE_LABELS.unknown}
                    </SelectItem>
                    {BLOOD_TYPE_OPTIONS.map((option) => (
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
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Traitements & allergies</FieldLegend>
        <FieldDescription>
          Ces trois points s’affichent en rouge dans l’en-tête du dossier. Les
          allergies se modifient depuis la fiche du patient.
        </FieldDescription>
        <FieldGroup className="gap-3">
          {CRITICAL_FLAGS.map((flag) => (
            <Controller
              key={flag.name}
              control={form.control}
              name={flag.name}
              render={({ field }) => (
                // The whole card is the label, so the description is part of
                // the click target, and a ticked flag is tinted.
                <FieldLabel htmlFor={flag.name}>
                  <Field orientation="horizontal">
                    <Checkbox
                      id={flag.name}
                      checked={field.value}
                      onCheckedChange={(checked) => field.onChange(checked)}
                      disabled={isPending}
                    />
                    <FieldContent>
                      <FieldTitle>{flag.title}</FieldTitle>
                      <FieldDescription>
                        {MEDICAL_ALERT_DESCRIPTIONS[flag.alert]}
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </FieldLabel>
              )}
            />
          ))}

          <TextAreaField
            control={form.control}
            name="currentMedications"
            label="Traitements en cours"
            placeholder="ex. Metformine 850 mg, 2 fois par jour"
            disabled={isPending}
          />
          <TextAreaField
            control={form.control}
            name="anesthesiaReactions"
            label="Réactions à l’anesthésie"
            placeholder="ex. Malaise vagal lors d’une anesthésie locale"
            disabled={isPending}
          />
        </FieldGroup>
      </FieldSet>

      {canBePregnant && (
        <FieldSet>
          <FieldLegend variant="label">Grossesse</FieldLegend>
          <FieldGroup className="gap-4">
            <TriStateField
              control={form.control}
              name="isPregnant"
              label="Enceinte"
              disabled={isPending}
            />

            {isPregnant === true && (
              <Controller
                control={form.control}
                name="pregnancyWeeks"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Terme (semaines d’aménorrhée)
                    </FieldLabel>
                    <Input
                      id={field.name}
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value.trim();
                        // "" is «terme inconnu»; anything else must be a
                        // number, and Zod says so if it is not.
                        field.onChange(raw === "" ? null : Number(raw));
                      }}
                      inputMode="numeric"
                      disabled={isPending}
                      aria-invalid={fieldState.invalid}
                      placeholder="ex. 14"
                      className="h-9 sm:w-48"
                    />
                    <FieldDescription>
                      Laissez vide si le terme n’est pas connu.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            )}

            <TriStateField
              control={form.control}
              name="isBreastfeeding"
              label="Allaitement"
              disabled={isPending}
            />
          </FieldGroup>
        </FieldSet>
      )}

      <FieldSet>
        <FieldLegend variant="label">Habitudes</FieldLegend>
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="smoking"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel>Tabac</FieldLabel>
                <RadioGroup
                  value={field.value}
                  onValueChange={(value) => field.onChange(value)}
                  disabled={isPending}
                  className="flex flex-col gap-3 sm:flex-row sm:gap-6"
                >
                  {SMOKING_STATUS_OPTIONS.map((option) => {
                    const id = `smoking-${option.value}`;
                    return (
                      <Field
                        key={option.value}
                        orientation="horizontal"
                        className="w-auto"
                      >
                        <RadioGroupItem id={id} value={option.value} />
                        <FieldLabel htmlFor={id} className="font-normal">
                          {option.label}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </RadioGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="bruxism"
            render={({ field }) => (
              <Field orientation="horizontal">
                <Checkbox
                  id={field.name}
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                  disabled={isPending}
                />
                <FieldLabel htmlFor={field.name} className="font-normal">
                  Bruxisme (grincement ou serrement des dents)
                </FieldLabel>
              </Field>
            )}
          />
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Médecin traitant</FieldLegend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="primaryDoctorName"
            label="Nom"
            placeholder="ex. Dr Benjelloun"
            disabled={isPending}
          />
          <TextField
            control={form.control}
            name="primaryDoctorPhone"
            label="Téléphone"
            placeholder="ex. 05 28 84 32 17"
            inputMode="tel"
            disabled={isPending}
          />
        </div>
      </FieldSet>

      <FieldSet>
        <FieldLegend variant="label">Contact d’urgence</FieldLegend>
        <FieldGroup className="gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              control={form.control}
              name="emergencyContactName"
              label="Nom"
              placeholder="ex. Amina Benali"
              disabled={isPending}
            />
            <TextField
              control={form.control}
              name="emergencyContactRelation"
              label="Lien"
              placeholder="ex. Mère, conjoint"
              disabled={isPending}
            />
          </div>
          <TextField
            control={form.control}
            name="emergencyContactPhone"
            label="Téléphone"
            placeholder="ex. 06 12 34 56 78"
            inputMode="tel"
            disabled={isPending}
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
          {isPending && <Spinner aria-label="Enregistrement en cours" />}
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
};

// ── Repeating field shapes ──────────────────────────────────────────────────

type TextFieldName = Extract<
  FieldPath<MedicalHistoryFormValues>,
  | "primaryDoctorName"
  | "primaryDoctorPhone"
  | "emergencyContactName"
  | "emergencyContactPhone"
  | "emergencyContactRelation"
>;

interface TextFieldProps {
  control: Control<MedicalHistoryFormValues>;
  name: TextFieldName;
  label: string;
  placeholder: string;
  disabled: boolean;
  inputMode?: "tel";
}

const TextField = ({
  control,
  name,
  label,
  placeholder,
  disabled,
  inputMode,
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

interface TextAreaFieldProps {
  control: Control<MedicalHistoryFormValues>;
  name: "currentMedications" | "surgicalHistory" | "anesthesiaReactions";
  label: string;
  placeholder: string;
  disabled: boolean;
}

const TextAreaField = ({
  control,
  name,
  label,
  placeholder,
  disabled,
}: TextAreaFieldProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        <Textarea
          {...field}
          id={field.name}
          value={field.value ?? ""}
          disabled={disabled}
          aria-invalid={fieldState.invalid}
          placeholder={placeholder}
        />
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);

/** A nullable boolean as three radios — «Non renseigné» is not «Non». */
type TriState = keyof typeof TRI_STATE_LABELS;

const toTriState = (value: boolean | null | undefined): TriState =>
  value === true ? "yes" : value === false ? "no" : "unknown";

const fromTriState = (value: TriState): boolean | null =>
  value === "yes" ? true : value === "no" ? false : null;

const TRI_STATE_ORDER: TriState[] = ["unknown", "no", "yes"];

interface TriStateFieldProps {
  control: Control<MedicalHistoryFormValues>;
  name: "isPregnant" | "isBreastfeeding";
  label: string;
  disabled: boolean;
}

const TriStateField = ({
  control,
  name,
  label,
  disabled,
}: TriStateFieldProps) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel>{label}</FieldLabel>
        <RadioGroup
          value={toTriState(field.value)}
          onValueChange={(value) =>
            field.onChange(fromTriState(value as TriState))
          }
          disabled={disabled}
          className="flex flex-row flex-wrap gap-6"
        >
          {TRI_STATE_ORDER.map((state) => {
            const id = `${name}-${state}`;
            return (
              <Field key={state} orientation="horizontal" className="w-auto">
                <RadioGroupItem id={id} value={state} />
                <FieldLabel htmlFor={id} className="font-normal">
                  {TRI_STATE_LABELS[state]}
                </FieldLabel>
              </Field>
            );
          })}
        </RadioGroup>
        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
      </Field>
    )}
  />
);
