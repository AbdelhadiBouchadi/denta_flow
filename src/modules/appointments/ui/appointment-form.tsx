"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, TriangleAlertIcon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import CommandSelect from "@/components/shared/command-select";
import { TimeField } from "@/components/shared/time-field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Field,
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
import { AGENDA_SLOT_MINUTES, WEEK_STARTS_ON } from "@/constants";
import { getErrorMessage } from "@/lib/errors";
import { formatCalendarDate } from "@/lib/format";
import { clinicNow } from "@/lib/time";
import { formatPatientName } from "@/modules/patients/derived";
import { useTRPC } from "@/trpc/client";
import {
  APPOINTMENT_COPY,
  APPOINTMENT_DURATION_MAX,
  APPOINTMENT_DURATION_MIN,
  APPOINTMENT_DURATION_STEP,
  APPOINTMENT_FIELD_LABELS as L,
  APPOINTMENT_FIELD_PLACEHOLDERS as P,
  BOOKING_WARNING_LABELS,
} from "../constants";
import {
  toFormValues,
  type AppointmentFormDefaults,
  type AppointmentPatientOption as PatientOption,
} from "../form-values";
import { useInvalidateAppointments } from "../hooks/use-invalidate-appointments";
import {
  appointmentFormSchema,
  type AppointmentFormValues,
  type AppointmentValues,
} from "../schemas";
import type { AppointmentListItem, BookingWarning } from "../types";

/** How many patients the typeahead offers at once. */
const PATIENT_SEARCH_LIMIT = 20;

interface AppointmentFormProps {
  /** Present ⇒ edit mode. One form, two modes (06-ui.md §5). */
  initialValues?: AppointmentListItem;
  /** Create mode only; ignored when `initialValues` is present. */
  defaultValues?: AppointmentFormDefaults;
  /**
   * Create mode only: the patient comes from `defaultValues.patient` and is
   * shown, not picked — the dossier books for the patient it is open on.
   */
  lockPatient?: boolean;
  onSuccess?: () => void;
  onCancel?: () => void;
}

/** The fields that make up a slot: a warning is only valid for this slot. */
type SlotFields = Pick<
  AppointmentFormValues,
  "practitionerId" | "date" | "time" | "durationMinutes"
>;

const slotKey = ({ practitionerId, date, time, durationMinutes }: SlotFields) =>
  [practitionerId, date, time, durationMinutes].join("|");

const fromNumberInput = (value: string) =>
  value.trim() === "" ? Number.NaN : Number(value);

const PatientLabel = ({ patient }: { patient: PatientOption }) => (
  <span className="flex items-center gap-2">
    <span className="bg-muted text-muted-foreground rounded-md px-1.5 py-0.5 font-mono text-xs tracking-wider">
      {patient.shortCode}
    </span>
    {formatPatientName(patient)}
  </span>
);

export const AppointmentForm = ({
  initialValues,
  defaultValues,
  lockPatient = false,
  onSuccess,
  onCancel,
}: AppointmentFormProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidateAll = useInvalidateAppointments();
  const isEdit = !!initialValues;
  const lockedPatient =
    !isEdit && lockPatient ? (defaultValues?.patient ?? null) : null;

  // Typeahead state of a dialog, not page filter state — it is never part of
  // a prefetched query key.
  const [patientSearch, setPatientSearch] = useState("");
  const [pickedPatient, setPickedPatient] = useState<PatientOption | null>(
    initialValues?.patient ?? defaultValues?.patient ?? null,
  );
  // The version token of the row being edited: the `updatedAt` the editor
  // loaded. It moves only when the editor is reloaded onto a newer version
  // after a CONFLICT, never on its own — a refetch of the list in the
  // background must not silently re-arm an overwrite.
  const [version, setVersion] = useState<Date | undefined>(
    initialValues?.updatedAt,
  );
  // The out-of-hours warnings the server answered for one exact slot.
  const [pendingWarnings, setPendingWarnings] = useState<{
    key: string;
    warnings: BookingWarning[];
  } | null>(null);

  // Options for a dialog, not a page: plain useQuery, and `data` may be
  // undefined for a moment (04-hydration.md §4 rule 8).
  const { data: patients } = useQuery(
    trpc.patients.getMany.queryOptions({
      search: patientSearch,
      pageSize: PATIENT_SEARCH_LIMIT,
    }),
  );
  const { data: practitioners } = useQuery(
    trpc.schedules.getPractitioners.queryOptions(),
  );
  const { data: types } = useQuery(
    trpc.appointmentTypes.getMany.queryOptions(),
  );

  const form = useForm<AppointmentFormValues, unknown, AppointmentValues>({
    resolver: zodResolver(appointmentFormSchema),
    defaultValues: toFormValues(
      initialValues,
      initialValues ? undefined : defaultValues,
    ),
  });

  const [practitionerId, date, time, durationMinutes] = useWatch({
    control: form.control,
    name: ["practitionerId", "date", "time", "durationMinutes"],
  });
  const currentKey = slotKey({ practitionerId, date, time, durationMinutes });
  // Changing the slot after a warning drops it: the new slot is checked anew.
  const warnings =
    pendingWarnings?.key === currentKey ? pendingWarnings.warnings : [];

  // The picked patient stays selectable even once the search moves on.
  const patientOptions: PatientOption[] = [
    ...(pickedPatient &&
    !patients?.items.some((patient) => patient.id === pickedPatient.id)
      ? [pickedPatient]
      : []),
    ...(patients?.items ?? []),
  ];

  // Active practitioners, plus the one the booking already names even if
  // since deactivated: otherwise the select opens empty.
  const practitionerOptions = [
    ...(practitioners?.items ?? []),
    ...(initialValues?.practitioner &&
    !practitioners?.items.some((p) => p.id === initialValues.practitioner?.id)
      ? [initialValues.practitioner]
      : []),
  ];

  // Active types, plus the one the booking already carries.
  const typeOptions = (types?.items ?? []).filter(
    (type) => type.isActive || type.id === initialValues?.typeId,
  );

  const handleWriteSuccess = async (
    result: { requiresConfirmation: boolean; warnings: BookingWarning[] },
    variables: SlotFields,
    successMessage: string,
  ) => {
    if (result.requiresConfirmation) {
      // Nothing was written: show why, and let the next submit confirm.
      setPendingWarnings({
        key: slotKey(variables),
        warnings: result.warnings,
      });
      return;
    }
    await invalidateAll();
    toast.success(successMessage);
    onSuccess?.();
  };

  /** Create's errors: a CONFLICT there can only be the slot. */
  const handleWriteError = async (error: {
    data?: { code?: string } | null;
  }) => {
    if (error.data?.code === "CONFLICT") {
      // The slot is taken: say so on the time field, and refetch so the
      // agenda shows the booking that won (06-ui.md §6).
      form.setError("time", { message: getErrorMessage(error) });
      await invalidateAll();
    }
    toast.error(getErrorMessage(error));
  };

  /**
   * An update CONFLICT has two causes: the slot was taken (overlap), or the
   * appointment itself was saved by someone else since this editor loaded it
   * (stale version). The code is the same, and the message is never parsed
   * (06-ui.md §6 rule 4) — so the cause is read from DATA: the fresh row's
   * `updatedAt` against the token this request carried.
   *
   * Either way the dialog stays open, and `getOne` + the lists are refreshed.
   */
  const handleUpdateError = async (
    error: { data?: { code?: string } | null },
    variables: { id: string; expectedUpdatedAt: Date },
  ) => {
    toast.error(getErrorMessage(error));
    if (error.data?.code !== "CONFLICT") return;

    await invalidateAll();
    const fresh = await queryClient
      .fetchQuery(trpc.appointments.getOne.queryOptions({ id: variables.id }))
      .catch(() => null);
    if (!fresh) return;

    if (fresh.updatedAt.getTime() !== variables.expectedUpdatedAt.getTime()) {
      // Stale: reload the editor onto the saved version — «Rechargez-le
      // avant de réessayer». The next submit carries the new token, and is a
      // decision made while looking at what the other person saved.
      setVersion(fresh.updatedAt);
      setPendingWarnings(null);
      form.reset(toFormValues(fresh));
      return;
    }
    // Same version ⇒ the row did not change: the slot is what conflicted.
    form.setError("time", { message: getErrorMessage(error) });
  };

  const createAppointment = useMutation(
    trpc.appointments.create.mutationOptions({
      onSuccess: (result, variables) =>
        handleWriteSuccess(result, variables, APPOINTMENT_COPY.created),
      onError: handleWriteError,
    }),
  );

  const updateAppointment = useMutation(
    trpc.appointments.update.mutationOptions({
      // The same invalidation as create — one block, both branches.
      onSuccess: (result, variables) =>
        handleWriteSuccess(result, variables, APPOINTMENT_COPY.updated),
      onError: (error, variables) => handleUpdateError(error, variables),
    }),
  );

  const isPending = createAppointment.isPending || updateAppointment.isPending;

  const onSubmit = (values: AppointmentValues) => {
    // Confirmed only when the warnings on screen are for this very slot.
    const payload = {
      ...values,
      confirmOutOfHours: pendingWarnings?.key === slotKey(values),
    };
    if (isEdit) {
      updateAppointment.mutate({
        ...payload,
        id: initialValues.id,
        expectedUpdatedAt: version ?? initialValues.updatedAt,
      });
      return;
    }
    createAppointment.mutate(payload);
  };

  const submitLabel = isPending
    ? isEdit
      ? APPOINTMENT_COPY.updating
      : APPOINTMENT_COPY.saving
    : warnings.length > 0
      ? APPOINTMENT_COPY.confirmAnyway
      : isEdit
        ? APPOINTMENT_COPY.update
        : APPOINTMENT_COPY.save;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      // A size container: the rows switch on the FORM's width, not the
      // viewport's — the same form sits in a 32rem dialog, the agenda's side
      // sheet and a phone-width drawer.
      className="@container flex min-h-0 flex-1 flex-col gap-4"
    >
      {/* Only the fields scroll, and only vertically, so the actions stay in
          view. Capped at 70vh in a dialog or drawer; the agenda's sheet is
          already full height and bounds it itself. */}
      <div className="flex max-h-[70vh] min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 in-data-[slot=sheet-content]:max-h-none">
        <FieldGroup className="gap-4">
          <Controller
            control={form.control}
            name="patientId"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.patient}</FieldLabel>
                {lockedPatient ? (
                  // Booked from the patient's own dossier: shown, not picked.
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
                        patientOptions.find(
                          (patient) => patient.id === value,
                        ) ?? null,
                      );
                      field.onChange(value);
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

          <div className="grid gap-4 @md:grid-cols-2 [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="practitionerId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.practitioner}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value || null}
                    onValueChange={(value) => field.onChange(value ?? "")}
                    disabled={isPending}
                    items={practitionerOptions.map((p) => ({
                      label: p.name,
                      value: p.id,
                    }))}
                  >
                    <SelectTrigger
                      size="default"
                      aria-invalid={fieldState.invalid}
                      className="h-9 w-full"
                    >
                      <SelectValue placeholder={P.practitioner} />
                    </SelectTrigger>
                    <SelectContent>
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
              name="typeId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.type}</FieldLabel>
                  <Select
                    id={field.name}
                    value={field.value ?? null}
                    onValueChange={(value) => {
                      field.onChange(value);
                      // The duration defaults from the type; the staff member
                      // may still override it below (08-clinical.md §4 rule 9).
                      const type = typeOptions.find((t) => t.id === value);
                      if (type) {
                        form.setValue(
                          "durationMinutes",
                          type.defaultDurationMinutes,
                          { shouldValidate: true },
                        );
                      }
                    }}
                    disabled={isPending}
                    items={[
                      { label: P.type, value: null },
                      ...typeOptions.map((type) => ({
                        label: type.label,
                        value: type.id,
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
                      <SelectItem value={null}>{P.type}</SelectItem>
                      {typeOptions.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          <span
                            aria-hidden="true"
                            style={
                              { "--type-color": type.color } as CSSProperties
                            }
                            className="size-2.5 shrink-0 rounded-full bg-[var(--type-color)]"
                          />
                          {type.label}
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

          {/* Narrow: the date on its own row, then hour:minute and duration.
            From 28rem of form width: all three on one row. */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 @md:grid-cols-[minmax(0,1fr)_auto_auto] [&>*]:min-w-0">
            <Controller
              control={form.control}
              name="date"
              render={({ field, fieldState }) => (
                <Field
                  data-invalid={fieldState.invalid}
                  className="col-span-2 @md:col-span-1"
                >
                  <FieldLabel htmlFor={field.name}>{L.date}</FieldLabel>
                  {/* The picker's Dates are only read for their calendar
                    fields, as "yyyy-MM-dd"; the instant is resolved on the
                    server through the clinic timezone. */}
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
                          className="w-full justify-between font-normal tabular-nums"
                        />
                      }
                    >
                      {/* The value is already a clinic day: reformatted as
                        text, never re-read through a Date and a zone. */}
                      {field.value ? (
                        formatCalendarDate(field.value)
                      ) : (
                        <span className="text-muted-foreground">{P.date}</span>
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
                          field.onChange(day ? format(day, "yyyy-MM-dd") : "")
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
              name="time"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.time}</FieldLabel>
                  <TimeField
                    id={field.name}
                    value={field.value}
                    onChange={field.onChange}
                    minuteStep={AGENDA_SLOT_MINUTES}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    aria-label={L.time}
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="durationMinutes"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={field.name}>{L.duration}</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    ref={field.ref}
                    type="number"
                    inputMode="numeric"
                    min={APPOINTMENT_DURATION_MIN}
                    max={APPOINTMENT_DURATION_MAX}
                    step={APPOINTMENT_DURATION_STEP}
                    value={
                      field.value == null || Number.isNaN(field.value)
                        ? ""
                        : field.value
                    }
                    onChange={(event) =>
                      field.onChange(fromNumberInput(event.target.value))
                    }
                    onBlur={field.onBlur}
                    disabled={isPending}
                    aria-invalid={fieldState.invalid}
                    className="h-9 w-28 tabular-nums"
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
            name="reason"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>{L.reason}</FieldLabel>
                <Input
                  {...field}
                  id={field.name}
                  value={field.value ?? ""}
                  autoComplete="off"
                  disabled={isPending}
                  aria-invalid={fieldState.invalid}
                  placeholder={P.reason}
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

        {warnings.length > 0 && (
          <Alert role="alert" className="border-warning bg-warning-subtle">
            <TriangleAlertIcon className="text-warning-strong" />
            <AlertTitle className="text-warning-strong">
              {APPOINTMENT_COPY.warningTitle}
            </AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">
                {warnings.map((warning) => (
                  <li key={warning}>{BOOKING_WARNING_LABELS[warning]}</li>
                ))}
              </ul>
              <p>{APPOINTMENT_COPY.warningHint}</p>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-col-reverse gap-2 px-4 in-data-[slot=sheet-content]:pb-4 @md:flex-row @md:justify-end">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isPending}
            onClick={onCancel}
            className="w-full @md:w-auto"
          >
            {APPOINTMENT_COPY.cancel}
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
