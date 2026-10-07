"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, ScanLineIcon, XIcon } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import CommandSelect from "@/components/shared/command-select";
import MoneyInput from "@/components/shared/money-input";
import { TimeField } from "@/components/shared/time-field";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
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
import { PRACTITIONER_ROLES, WEEK_STARTS_ON } from "@/constants";
import { authClient } from "@/lib/auth-client";
import { getErrorMessage } from "@/lib/errors";
import { formatCalendarDate, formatDateTime, formatDH } from "@/lib/format";
import { clinicNow } from "@/lib/time";
import { AppointmentStatus } from "@/modules/appointments/types";
import { formatPatientName } from "@/modules/patients/derived";
import { NGAP_XRAY_LABELS } from "@/modules/services/constants";
import {
  NgapXrayRequirement,
  ServiceStatusFilter,
} from "@/modules/services/types";
import { NgapReference } from "@/modules/services/ui/ngap-reference";
import { useTRPC } from "@/trpc/client";
import {
  suggestedTotalHint,
  TREATMENT_COPY as COPY,
  TREATMENT_FIELD_LABELS as L,
  TREATMENT_FIELD_PLACEHOLDERS as P,
  TREATMENT_STATUS_OPTIONS,
} from "../constants";
import {
  toFormValues,
  type TreatmentFormDefaults,
  type TreatmentPatientOption as PatientOption,
} from "../form-values";
import { useInvalidateTreatments } from "../hooks/use-invalidate-treatments";
import {
  treatmentFormSchema,
  type TreatmentFormValues,
  type TreatmentValues,
} from "../schemas";
import { suggestedTotalCents } from "../teeth";
import type { TreatmentListItem } from "../types";
import { ToothSelect } from "./tooth-select";

/** How many patients / services a typeahead offers at once. */
const SEARCH_LIMIT = 20;

interface TreatmentFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: TreatmentListItem;
  /** Create mode only — the dossier's patient, the odontogram's teeth. */
  defaultValues?: TreatmentFormDefaults;
  /** Create mode only: the patient is shown, not picked. */
  lockPatient?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const PatientLabel = ({ patient }: { patient: PatientOption }) => (
  <span className="flex min-w-0 items-center gap-2">
    <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
      {patient.shortCode}
    </span>
    <span className="truncate">{formatPatientName(patient)}</span>
  </span>
);

/** A catalogue entry as the picker shows it. */
interface ServiceOption {
  id: string;
  label: string;
  isActive: boolean;
  nomenclatureCode?: string | null;
  defaultPriceCents?: number;
}

const ServiceLabel = ({ service }: { service: ServiceOption }) => (
  <span className="flex min-w-0 items-center gap-2">
    {service.nomenclatureCode && (
      <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs">
        {service.nomenclatureCode}
      </span>
    )}
    <span className="truncate">{service.label}</span>
    {!service.isActive && (
      <span className="text-muted-foreground text-xs">
        ({COPY.inactiveService})
      </span>
    )}
    {service.defaultPriceCents !== undefined && (
      <span className="text-muted-foreground ml-auto pl-2 text-xs tabular-nums">
        {formatDH(service.defaultPriceCents)}
      </span>
    )}
  </span>
);

const isPractitionerRole = (role: string | null | undefined) =>
  (PRACTITIONER_ROLES as readonly (string | null | undefined)[]).includes(role);

export const TreatmentForm = ({
  initialValues,
  defaultValues,
  lockPatient = false,
  onSuccess,
  onCancel,
}: TreatmentFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateAll = useInvalidateTreatments();
  const isEdit = !!initialValues;
  const lockedPatient =
    !isEdit && lockPatient ? (defaultValues?.patient ?? null) : null;

  // The default practitioner is the signed-in one when they are eligible.
  // The session is already cached by the shell when the dialog opens.
  const { data: session } = authClient.useSession();
  const sessionPractitionerId =
    session?.user.isActive && isPractitionerRole(session.user.role)
      ? session.user.id
      : null;

  // Typeahead state of a dialog, not page filter state — never part of a
  // prefetched query key.
  const [patientSearch, setPatientSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [pickedPatient, setPickedPatient] = useState<PatientOption | null>(
    initialValues?.patient ?? defaultValues?.patient ?? null,
  );
  const [pickedService, setPickedService] = useState<ServiceOption | null>(
    initialValues?.service ?? null,
  );
  // The catalogue price per tooth, known only once a service is PICKED here.
  // An edited acte keeps its snapshot: nothing is re-suggested from today's
  // catalogue price unless the staff member picks a service again.
  const [unitPriceCents, setUnitPriceCents] = useState<number | null>(null);
  // Typing an amount by hand stops the per-tooth suggestion from overwriting it.
  const [amountTouched, setAmountTouched] = useState(isEdit);
  // The version token of the row being edited — moved only by a reload after
  // a CONFLICT, never by a background refetch.
  const [version, setVersion] = useState<Date | undefined>(
    initialValues?.updatedAt,
  );

  const form = useForm<TreatmentFormValues, unknown, TreatmentValues>({
    resolver: zodResolver(treatmentFormSchema),
    defaultValues: toFormValues(
      initialValues,
      initialValues
        ? undefined
        : {
            ...defaultValues,
            practitionerId:
              defaultValues?.practitionerId ?? sessionPractitionerId,
          },
    ),
  });

  const [patientId, teeth, nomenclatureCode, totalAmountCents] = useWatch({
    control: form.control,
    name: ["patientId", "teeth", "nomenclatureCode", "totalAmountCents"],
  });
  const teethCount = teeth?.length ?? 0;
  const code = nomenclatureCode?.trim() ?? "";

  // Options for a dialog, not a page: plain useQuery (04-hydration.md §4 rule 8).
  const { data: patients } = useQuery({
    ...trpc.patients.getMany.queryOptions({
      search: patientSearch,
      pageSize: SEARCH_LIMIT,
    }),
    enabled: !lockedPatient,
  });
  const { data: services } = useQuery(
    trpc.services.getMany.queryOptions({
      search: serviceSearch,
      status: ServiceStatusFilter.Active,
      pageSize: SEARCH_LIMIT,
    }),
  );
  const { data: practitioners } = useQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );
  const { data: patientAppointments } = useQuery({
    ...trpc.appointments.getManyByPatient.queryOptions({ patientId }),
    enabled: !!patientId,
  });
  // The NGAP line for whatever code is in the field — looked up on the
  // server, so the dataset never ships to the browser.
  const { data: ngap } = useQuery({
    ...trpc.treatments.ngapLookup.queryOptions({ code }),
    enabled: code !== "",
  });

  // The picked patient stays selectable even once the search moves on.
  const patientOptions: PatientOption[] = [
    ...(pickedPatient &&
    !patients?.items.some((patient) => patient.id === pickedPatient.id)
      ? [pickedPatient]
      : []),
    ...(patients?.items ?? []),
  ];

  // Active services, plus the acte's own even if since deactivated.
  const serviceOptions: ServiceOption[] = [
    ...(pickedService &&
    !services?.items.some((service) => service.id === pickedService.id)
      ? [pickedService]
      : []),
    ...(services?.items ?? []),
  ];

  // Active practitioners, plus the one the acte already names.
  const practitionerOptions = [
    ...(practitioners?.items ?? []),
    ...(initialValues?.practitioner &&
    !practitioners?.items.some((p) => p.id === initialValues.practitioner?.id)
      ? [initialValues.practitioner]
      : []),
  ];

  // The patient's appointments still on the books or done, plus the one the
  // acte is already linked to.
  const appointmentOptions = (patientAppointments?.items ?? []).filter(
    (appointment) =>
      appointment.status !== AppointmentStatus.Canceled ||
      appointment.id === initialValues?.appointmentId,
  );

  const suggestion =
    unitPriceCents !== null
      ? suggestedTotalCents(unitPriceCents, teethCount)
      : null;

  const applySuggestion = (cents: number | null) => {
    if (cents === null) return;
    form.setValue("totalAmountCents", cents, { shouldValidate: true });
  };

  const handleTeethChange = (next: string[]) => {
    form.setValue("teeth", next as TreatmentFormValues["teeth"], {
      shouldValidate: true,
    });
    if (!amountTouched && unitPriceCents !== null) {
      applySuggestion(suggestedTotalCents(unitPriceCents, next.length));
    }
  };

  const handleServicePick = (serviceId: string) => {
    const service = services?.items.find((item) => item.id === serviceId);
    form.setValue("serviceId", serviceId);
    if (!service) return;
    // The snapshot: label, code and price — all still editable.
    setPickedService(service);
    setUnitPriceCents(service.defaultPriceCents);
    setAmountTouched(false);
    form.setValue("label", service.label, { shouldValidate: true });
    form.setValue("nomenclatureCode", service.nomenclatureCode ?? "");
    applySuggestion(
      suggestedTotalCents(service.defaultPriceCents, teethCount),
    );
  };

  const handleSuccess = async (message: string) => {
    await invalidateAll();
    toast.success(message);
    onSuccess?.();
  };

  const createTreatment = useMutation(
    trpc.treatments.create.mutationOptions({
      onSuccess: () => handleSuccess(COPY.created),
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const updateTreatment = useMutation(
    trpc.treatments.update.mutationOptions({
      // The same invalidation as create — one block, both branches.
      onSuccess: () => handleSuccess(COPY.updated),
      onError: async (error, variables) => {
        toast.error(getErrorMessage(error));
        if (error.data?.code !== "CONFLICT") return;
        // Someone saved this acte since the editor loaded it: reload the
        // saved version — «Rechargez-le avant de réessayer».
        await invalidateAll();
        const fresh = await queryClient
          .fetchQuery(trpc.treatments.getOne.queryOptions({ id: variables.id }))
          .catch(() => null);
        if (!fresh) return;
        setVersion(fresh.updatedAt);
        setPickedService(fresh.service);
        setUnitPriceCents(null);
        setAmountTouched(true);
        form.reset(toFormValues(fresh));
      },
    }),
  );

  const isPending = createTreatment.isPending || updateTreatment.isPending;

  const onSubmit = (values: TreatmentValues) => {
    if (isEdit) {
      updateTreatment.mutate({
        ...values,
        id: initialValues.id,
        expectedUpdatedAt: version ?? initialValues.updatedAt,
      });
      return;
    }
    createTreatment.mutate(values);
  };

  const submitLabel = isPending
    ? isEdit
      ? COPY.updating
      : COPY.saving
    : isEdit
      ? COPY.update
      : COPY.save;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      // A size container: the rows switch on the FORM's width — the same form
      // sits in a 32rem dialog and a phone-width drawer.
      className="@container flex min-h-0 flex-1 flex-col gap-4"
    >
      <div className="flex max-h-[70vh] min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4">
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="patientId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.patient}</FieldLabel>
                {lockedPatient ? (
                  <div
                    id={field.name}
                    aria-readonly="true"
                    className="border-input bg-muted/50 flex h-9 w-full min-w-0 items-center rounded-md border px-3 text-sm"
                  >
                    <PatientLabel patient={lockedPatient} />
                  </div>
                ) : (
                  <CommandSelect
                    value={field.value}
                    placeholder={P.patient}
                    onSearch={setPatientSearch}
                    onSelect={(value) => {
                      setPickedPatient(
                        patientOptions.find((p) => p.id === value) ?? null,
                      );
                      field.onChange(value);
                      // An appointment belongs to one patient.
                      if (value !== field.value) {
                        form.setValue("appointmentId", null);
                      }
                    }}
                    options={patientOptions.map((patient) => ({
                      id: patient.id,
                      value: patient.id,
                      children: <PatientLabel patient={patient} />,
                    }))}
                    className="w-full"
                  />
                )}
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            control={form.control}
            name="serviceId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.service}</FieldLabel>
                <CommandSelect
                  value={field.value ?? ""}
                  placeholder={P.service}
                  onSearch={setServiceSearch}
                  onSelect={handleServicePick}
                  options={serviceOptions.map((service) => ({
                    id: service.id,
                    value: service.id,
                    children: <ServiceLabel service={service} />,
                  }))}
                  className="w-full min-w-0"
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 @md:grid-cols-[minmax(0,1fr)_8rem] [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="label"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.label}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    autoComplete="off"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    placeholder={P.label}
                    className="h-9"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
            <Controller
              control={form.control}
              name="nomenclatureCode"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.code}</FieldLabel>
                  <Input
                    {...field}
                    id={field.name}
                    value={field.value ?? ""}
                    autoComplete="off"
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    placeholder={P.code}
                    className="h-9 font-mono"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          {ngap && (
            <div className="-mt-2 flex flex-col gap-1">
              <NgapReference
                letter={ngap.letter}
                coefficient={ngap.coefficient}
                referenceTariffCents={ngap.referenceTariffCents}
                onQuote={ngap.onQuote}
              />
              {ngap.xrayRequired && (
                <span className="text-warning-strong flex items-center gap-1.5 text-xs">
                  <ScanLineIcon aria-hidden="true" className="size-3.5" />
                  {NGAP_XRAY_LABELS[ngap.xrayRequired as NgapXrayRequirement]}
                </span>
              )}
            </div>
          )}

          <Controller
            control={form.control}
            name="teeth"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.teeth}</FieldLabel>
                <ToothSelect
                  id={field.name}
                  value={field.value ?? []}
                  onChange={handleTeethChange}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <div className="grid gap-4 @md:grid-cols-2 [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="totalAmountCents"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.amount}</FieldLabel>
                  <MoneyInput
                    id={field.name}
                    name={field.name}
                    value={field.value ?? null}
                    onChange={(cents) => {
                      setAmountTouched(true);
                      field.onChange(cents);
                    }}
                    onBlur={field.onBlur}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                  />
                  {unitPriceCents !== null && teethCount > 0 && (
                    <FieldDescription className="flex flex-wrap items-center gap-x-2 tabular-nums">
                      {suggestedTotalHint(formatDH(unitPriceCents), teethCount)}
                      {suggestion !== null &&
                        suggestion !== totalAmountCents && (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto p-0"
                            onClick={() => {
                              setAmountTouched(false);
                              applySuggestion(suggestion);
                            }}
                          >
                            {COPY.applySuggestion} {formatDH(suggestion)}
                          </Button>
                        )}
                    </FieldDescription>
                  )}
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="status"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.status}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value}
                    onValueChange={(value) => value && field.onChange(value)}
                    disabled={isPending}
                    items={TREATMENT_STATUS_OPTIONS}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TREATMENT_STATUS_OPTIONS.map((option) => (
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

          <div className="grid gap-4 @md:grid-cols-2 [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="practitionerId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.practitioner}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={isPending}
                    items={[
                      { label: P.practitioner, value: null },
                      ...practitionerOptions.map((p) => ({
                        label: p.name,
                        value: p.id,
                      })),
                    ]}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>{P.practitioner}</SelectItem>
                      {practitionerOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
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

            <Controller
              control={form.control}
              name="appointmentId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.appointment}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value ?? null}
                    onValueChange={(value) => field.onChange(value)}
                    disabled={isPending || !patientId}
                    items={[
                      { label: P.appointment, value: null },
                      ...appointmentOptions.map((a) => ({
                        label: formatDateTime(a.startsAt),
                        value: a.id,
                      })),
                    ]}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>{P.appointment}</SelectItem>
                      {appointmentOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          <span className="tabular-nums">
                            {formatDateTime(a.startsAt)}
                          </span>
                          {a.type && (
                            <span className="text-muted-foreground truncate">
                              {a.type.label}
                            </span>
                          )}
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

          {/* Narrow: the date on its own row, then the time. From 28rem of
              form width: side by side. */}
          <div className="grid grid-cols-1 gap-4 @md:grid-cols-[minmax(0,1fr)_auto] [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="performedDate"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {L.performedDate}
                  </FieldLabel>
                  <div className="flex gap-1">
                    {/* The picker's Dates are only read for their calendar
                        fields; the instant is resolved on the server through
                        the clinic timezone. */}
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
                            className="min-w-0 flex-1 justify-between font-normal tabular-nums"
                          />
                        }
                      >
                        {field.value ? (
                          formatCalendarDate(field.value)
                        ) : (
                          <span className="text-muted-foreground">
                            {P.date}
                          </span>
                        )}
                        <CalendarIcon className="text-muted-foreground" />
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          locale={fr}
                          weekStartsOn={WEEK_STARTS_ON}
                          defaultMonth={
                            field.value ? parseISO(field.value) : clinicNow()
                          }
                          selected={
                            field.value ? parseISO(field.value) : undefined
                          }
                          onSelect={(day) =>
                            field.onChange(
                              day ? format(day, "yyyy-MM-dd") : "",
                            )
                          }
                        />
                      </PopoverContent>
                    </Popover>
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        aria-label={COPY.clearDate}
                        disabled={isPending}
                        onClick={() => {
                          field.onChange("");
                          form.setValue("performedTime", "");
                        }}
                      >
                        <XIcon />
                      </Button>
                    )}
                  </div>
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="performedTime"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>
                    {L.performedTime}
                  </FieldLabel>
                  <TimeField
                    id={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    aria-label={L.performedTime}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="notes"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.notes}</FieldLabel>
                <Textarea
                  {...field}
                  id={field.name}
                  value={field.value ?? ""}
                  rows={3}
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder={P.notes}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </div>

      <div className="flex flex-col-reverse gap-2 px-4 @md:flex-row @md:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onCancel}
            className="w-full @md:w-auto"
          >
            {COPY.cancel}
          </Button>
        )}
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="w-full @md:w-auto"
        >
          {isPending && <Spinner aria-label={submitLabel} />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
