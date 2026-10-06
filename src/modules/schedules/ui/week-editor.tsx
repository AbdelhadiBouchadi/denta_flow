"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { PlusIcon, XIcon } from "lucide-react";
import {
  Controller,
  useFieldArray,
  useForm,
  useFormState,
  useWatch,
  type Control,
} from "react-hook-form";
import { toast } from "sonner";

import { TimeField } from "@/components/shared/time-field";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  SCHEDULE_AFTERNOON_RANGE,
  SCHEDULE_DEFAULT_RANGE,
  SCHEDULE_MAX_RANGES_PER_DAY,
  SCHEDULE_MINUTE_STEP,
  WEEK_COPY,
  WEEKDAY_LABELS,
  WEEKDAYS,
  type Weekday,
} from "../constants";
import { useInvalidateSchedules } from "../hooks/use-invalidate-schedules";
import {
  weekFormSchema,
  type WeekFormValues,
  type WeekValues,
} from "../schemas";
import type { Practitioner } from "../types";
import { copyDay, flattenWeek, type DayRanges } from "../week";
import { ApplyWeekMenu } from "./apply-week-menu";
import { CopyDayPopover } from "./copy-day-popover";

interface WeekEditorProps {
  practitionerId: string;
  days: DayRanges[];
  /** Everyone «Appliquer la semaine à…» may target. */
  otherPractitioners: Practitioner[];
}

/**
 * One practitioner's week, edited as a whole and saved with one `setWeek`.
 * Ranges are one flat field array (the shape `setWeek` takes, so one schema
 * serves the form and the procedure); each day renders the entries whose
 * `weekday` is its own. The parent keys this by practitioner, so switching
 * practitioner starts a fresh form.
 */
export const WeekEditor = ({
  practitionerId,
  days,
  otherPractitioners,
}: WeekEditorProps) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateSchedules();

  const form = useForm<WeekFormValues, unknown, WeekValues>({
    resolver: zodResolver(weekFormSchema),
    defaultValues: { practitionerId, ranges: flattenWeek(days) },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "ranges",
  });

  // Live values: the copy popover's counts and the add button's proposal.
  const ranges = useWatch({ control: form.control, name: "ranges" });

  const saveWeek = useMutation(
    trpc.schedules.setWeek.mutationOptions({
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  const onSubmit = (values: WeekValues) =>
    saveWeek.mutate(values, {
      onSuccess: async () => {
        await invalidateAll();
        // The saved week becomes the new baseline: «Annuler» returns here.
        form.reset(values);
        toast.success(WEEK_COPY.saved);
      },
    });

  const rangeCounts = Object.fromEntries(
    WEEKDAYS.map((weekday) => [
      weekday,
      ranges.filter((range) => range.weekday === weekday).length,
    ]),
  ) as Record<Weekday, number>;

  const addRange = (weekday: Weekday) =>
    append({
      weekday,
      ...(rangeCounts[weekday] === 0
        ? SCHEDULE_DEFAULT_RANGE
        : SCHEDULE_AFTERNOON_RANGE),
    });

  const copyTo = (source: Weekday, targets: Weekday[]) => {
    replace(copyDay(form.getValues("ranges"), source, targets));
    toast.success(WEEK_COPY.copyDone);
  };

  const getValidRanges = async () =>
    (await form.trigger()) ? form.getValues("ranges") : null;

  const isPending = saveWeek.isPending;
  const isDirty = form.formState.isDirty;

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit, () =>
        toast.error(WEEK_COPY.invalid),
      )}
      noValidate
      className="flex flex-col gap-4"
    >
      <ul className="divide-border flex flex-col divide-y rounded-lg border">
        {WEEKDAYS.map((weekday) => {
          const dayFields = fields
            .map((field, index) => ({ field, index }))
            .filter(({ field }) => field.weekday === weekday);
          const label = WEEKDAY_LABELS[weekday];

          return (
            <li
              key={weekday}
              className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-start md:gap-4"
            >
              <span className="text-foreground w-28 shrink-0 font-medium md:pt-2">
                {label}
              </span>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                {dayFields.length === 0 && (
                  <span className="text-muted-foreground text-sm md:pt-2">
                    {WEEK_COPY.closed}
                  </span>
                )}

                {dayFields.map(({ field, index }) => (
                  <div key={field.id} className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Controller
                        control={form.control}
                        name={`ranges.${index}.startTime`}
                        render={({ field: input, fieldState }) => (
                          <TimeField
                            value={input.value}
                            onChange={input.onChange}
                            minuteStep={SCHEDULE_MINUTE_STEP}
                            disabled={isPending}
                            aria-invalid={fieldState.invalid}
                            aria-label={`${label} — ${WEEK_COPY.start}`}
                          />
                        )}
                      />
                      <span
                        aria-hidden="true"
                        className="text-muted-foreground"
                      >
                        {WEEK_COPY.rangeSeparator}
                      </span>
                      <Controller
                        control={form.control}
                        name={`ranges.${index}.endTime`}
                        render={({ field: input, fieldState }) => (
                          <TimeField
                            value={input.value}
                            onChange={input.onChange}
                            minuteStep={SCHEDULE_MINUTE_STEP}
                            disabled={isPending}
                            aria-invalid={fieldState.invalid}
                            aria-label={`${label} — ${WEEK_COPY.end}`}
                          />
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={isPending}
                        onClick={() => remove(index)}
                        aria-label={`${WEEK_COPY.removeRange} (${label})`}
                      >
                        <XIcon />
                      </Button>
                    </div>
                    <RangeErrors control={form.control} index={index} />
                  </div>
                ))}
              </div>

              <div className="flex shrink-0 flex-wrap gap-1 md:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={
                    isPending ||
                    rangeCounts[weekday] >= SCHEDULE_MAX_RANGES_PER_DAY
                  }
                  onClick={() => addRange(weekday)}
                  aria-label={`${WEEK_COPY.addRange} (${label})`}
                >
                  <PlusIcon />
                  {WEEK_COPY.addRange}
                </Button>
                <CopyDayPopover
                  source={weekday}
                  rangeCounts={rangeCounts}
                  onApply={(targets) => copyTo(weekday, targets)}
                  disabled={isPending}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <ApplyWeekMenu
          targets={otherPractitioners}
          getValidRanges={getValidRanges}
          disabled={isPending}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          {isDirty && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isPending}
              onClick={() => form.reset()}
              className="w-full sm:w-auto"
            >
              {WEEK_COPY.reset}
            </Button>
          )}
          <Button
            type="submit"
            size="lg"
            disabled={isPending || !isDirty}
            className="w-full sm:w-auto"
          >
            {isPending && <Spinner aria-label={WEEK_COPY.saving} />}
            {isPending ? WEEK_COPY.saving : WEEK_COPY.save}
          </Button>
        </div>
      </div>
    </form>
  );
};

/**
 * A range's messages, under its row. Overlap and «3 plages maximum» land on
 * `startTime`, «fin avant début» on `endTime`; both show here.
 */
const RangeErrors = ({
  control,
  index,
}: {
  control: Control<WeekFormValues, unknown, WeekValues>;
  index: number;
}) => {
  const { errors: formErrors } = useFormState({
    control,
    name: `ranges.${index}`,
  });
  const errors = formErrors.ranges?.[index];
  if (!errors) return null;
  return <FieldError errors={[errors.startTime, errors.endTime]} />;
};
