"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  CopyIcon,
  ShieldCheckIcon,
  XCircleIcon,
} from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import StatusBadge from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/hooks/use-confirm";
import { formatDateTime } from "@/lib/format";
import { useTRPC } from "@/trpc/client";
import {
  EVENT_OPTIONS,
  MODE_DESCRIPTIONS,
  MODE_LABELS,
  MODE_TONES,
  STATUS_LABELS,
  STATUS_VALUES,
  WHATSAPP_COPY as COPY,
  WHATSAPP_ERRORS,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import {
  sendTestSchema,
  settingsUpdateSchema,
  type SendTestValues,
  type SettingsUpdateValues,
} from "../schemas";
import { WhatsappEvent, WhatsappMessageStatus } from "../types";
import { ModeBanner } from "./mode-banner";

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <Card className="gap-3 px-4 py-4">
    <h3 className="text-h4 text-foreground font-medium">{title}</h3>
    {children}
  </Card>
);

/** The counters worth a glance; the journal has the rest. */
const COUNTER_STATUSES: readonly WhatsappMessageStatus[] = STATUS_VALUES.filter(
  (status) =>
    status !== WhatsappMessageStatus.Sending &&
    status !== WhatsappMessageStatus.Canceled,
);

export const ServiceTab = () => {
  const trpc = useTRPC();
  const invalidate = useInvalidateWhatsapp();
  const { data: status } = useSuspenseQuery(
    trpc.whatsapp.getServiceStatus.queryOptions(),
  );
  const { data: settings } = useSuspenseQuery(
    trpc.whatsapp.getSettings.queryOptions(),
  );

  const [ConsentConfirmation, confirmConsent] = useConfirm(
    COPY.bulkConfirmTitle,
    COPY.bulkConfirmDescription,
  );

  const settingsForm = useForm<SettingsUpdateValues>({
    resolver: zodResolver(settingsUpdateSchema),
    values: settings,
  });

  const testForm = useForm<SendTestValues>({
    resolver: zodResolver(sendTestSchema),
    defaultValues: { phone: "", event: WhatsappEvent.Reminder },
  });

  const saveSettings = useMutation(
    trpc.whatsapp.updateSettings.mutationOptions({
      onSuccess: async ({ backfilled }) => {
        await invalidate();
        toast.success(
          backfilled > 0
            ? `${COPY.settingsSaved} — ${COPY.backfillDone(backfilled)}`
            : COPY.settingsSaved,
        );
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const sendTest = useMutation(
    trpc.whatsapp.sendTest.mutationOptions({
      onSuccess: async (result) => {
        await invalidate();
        if (result.ok) toast.success(COPY.testSent);
        // Twilio's own code and message, verbatim: they are what to look up.
        else toast.error(`${WHATSAPP_ERRORS.testFailed} (${result.code} — ${result.message})`);
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const bulkConsent = useMutation(
    trpc.whatsapp.bulkMarkConsent.mutationOptions({
      onSuccess: async ({ count }) => {
        await invalidate();
        toast.success(COPY.bulkDone(count));
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const backfill = useMutation(
    trpc.whatsapp.backfill.mutationOptions({
      onSuccess: async ({ count }) => {
        await invalidate();
        toast.success(COPY.backfillDone(count));
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  // Turning ON needs a complete env and the clinic phone; turning off never
  // does. The procedure refuses the same way — this only explains why.
  const switchBlocker = !status.envComplete
    ? COPY.switchDisabledEnv
    : !status.clinicPhonePresent
      ? COPY.switchDisabledPhone
      : null;

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(status.webhookUrl);
      toast.success(COPY.copied);
    } catch {
      // Clipboard refused (insecure context): the URL stays selectable.
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <ConsentConfirmation />

      <Section title={COPY.serviceMode}>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={MODE_LABELS[status.mode]} tone={MODE_TONES[status.mode]} />
          <p className="text-muted-foreground text-sm">{MODE_DESCRIPTIONS[status.mode]}</p>
        </div>
        <ModeBanner mode={status.mode} />
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={COPY.connection}>
          <ul className="flex flex-col gap-2">
            {status.env.map((entry) => (
              <li key={entry.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="text-foreground block">{entry.label}</span>
                  <code className="text-muted-foreground text-xs break-all">{entry.key}</code>
                </span>
                <span
                  className={
                    entry.present
                      ? "text-success-strong flex shrink-0 items-center gap-1"
                      : "text-danger-strong flex shrink-0 items-center gap-1"
                  }
                >
                  {entry.present ? (
                    <CheckCircle2Icon className="size-4" />
                  ) : (
                    <XCircleIcon className="size-4" />
                  )}
                  {entry.present ? COPY.present : COPY.missing}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-col gap-1 border-t pt-3">
            <span className="text-muted-foreground text-xs">{COPY.webhookUrl}</span>
            <div className="flex min-w-0 items-center gap-2">
              <code className="bg-muted min-w-0 flex-1 rounded px-2 py-1 text-xs break-all">
                {status.webhookUrl}
              </code>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={COPY.copyText}
                onClick={() => void copyWebhook()}
              >
                <CopyIcon />
              </Button>
            </div>
            <p className="text-muted-foreground text-xs">{COPY.webhookHelp}</p>
          </div>
        </Section>

        <Section title={COPY.lastRun}>
          <p className="text-sm tabular-nums">
            {status.lastCron ? (
              <>
                <span className="text-foreground font-medium">
                  {formatDateTime(status.lastCron.at)}
                </span>
                <span className="text-muted-foreground block">
                  {COPY.lastRunCounts(
                    status.lastCron.claimed,
                    status.lastCron.sent,
                    status.lastCron.failed,
                    status.lastCron.needsAttention,
                  )}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">{COPY.lastRunNever}</span>
            )}
          </p>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 border-t pt-3 text-sm">
            <span />
            <span className="text-muted-foreground text-xs">{COPY.counters24h}</span>
            <span className="text-muted-foreground text-xs">{COPY.counters7d}</span>
            {COUNTER_STATUSES.map((key) => (
              <div key={key} className="contents">
                <span className="text-foreground">{STATUS_LABELS[key]}</span>
                <span className="text-right tabular-nums">{status.counts24h[key]}</span>
                <span className="text-right tabular-nums">{status.counts7d[key]}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <form
        noValidate
        onSubmit={settingsForm.handleSubmit((values) => saveSettings.mutate(values))}
      >
        <Card className="gap-4 px-4 py-4">
          <Controller
            control={settingsForm.control}
            name="enabled"
            render={({ field }) => (
              <Field orientation="horizontal" className="items-start">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <FieldLabel htmlFor="whatsapp-enabled">{COPY.globalSwitch}</FieldLabel>
                  <FieldDescription>{switchBlocker ?? COPY.globalSwitchHelp}</FieldDescription>
                </div>
                <Switch
                  id="whatsapp-enabled"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked)}
                  disabled={saveSettings.isPending || (!field.value && switchBlocker !== null)}
                />
              </Field>
            )}
          />

          <FieldSet>
            <FieldLegend variant="label">{COPY.windowTitle}</FieldLegend>
            <FieldDescription>{COPY.windowHelp}</FieldDescription>
            <FieldGroup className="grid gap-4 sm:grid-cols-3">
              {(["windowStart", "windowEnd"] as const).map((name) => (
                <Controller
                  key={name}
                  control={settingsForm.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`whatsapp-${name}`}>
                        {name === "windowStart" ? COPY.windowStart : COPY.windowEnd}
                      </FieldLabel>
                      <Input
                        {...field}
                        id={`whatsapp-${name}`}
                        type="time"
                        step={60}
                        className="tabular-nums"
                        aria-invalid={fieldState.invalid}
                        disabled={saveSettings.isPending}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              ))}
              <Controller
                control={settingsForm.control}
                name="minLeadMinutes"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="whatsapp-min-lead">{COPY.minLead}</FieldLabel>
                    <Input
                      id="whatsapp-min-lead"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={1440}
                      className="tabular-nums"
                      value={Number.isNaN(field.value) ? "" : field.value}
                      onChange={(event) => field.onChange(event.target.valueAsNumber)}
                      onBlur={field.onBlur}
                      aria-invalid={fieldState.invalid}
                      disabled={saveSettings.isPending}
                    />
                    <FieldDescription>{COPY.minLeadHelp}</FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </FieldSet>

          <div className="flex justify-end">
            <Button type="submit" size="lg" disabled={saveSettings.isPending}>
              {saveSettings.isPending ? (
                <>
                  <Spinner />
                  {COPY.saving}
                </>
              ) : (
                COPY.saveSettings
              )}
            </Button>
          </div>
        </Card>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={COPY.testTitle}>
          <p className="text-muted-foreground text-sm">
            {status.envComplete ? COPY.testHelp : COPY.testUnavailable}
          </p>
          <form
            noValidate
            className="flex flex-col gap-3"
            onSubmit={testForm.handleSubmit((values) => sendTest.mutate(values))}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Controller
                control={testForm.control}
                name="event"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="whatsapp-test-event">{COPY.testEvent}</FieldLabel>
                    <Select
                      id="whatsapp-test-event"
                      value={field.value}
                      onValueChange={(value) => field.onChange(value)}
                      items={EVENT_OPTIONS}
                      disabled={!status.envComplete || sendTest.isPending}
                    >
                      <SelectTrigger className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EVENT_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                control={testForm.control}
                name="phone"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="whatsapp-test-phone">{COPY.testPhone}</FieldLabel>
                    <Input
                      {...field}
                      id="whatsapp-test-phone"
                      inputMode="tel"
                      placeholder={COPY.testPhonePlaceholder}
                      aria-invalid={fieldState.invalid}
                      disabled={!status.envComplete || sendTest.isPending}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                variant="outline"
                disabled={!status.envComplete || sendTest.isPending}
              >
                {sendTest.isPending ? (
                  <>
                    <Spinner />
                    {COPY.testSending}
                  </>
                ) : (
                  COPY.testSend
                )}
              </Button>
            </div>
          </form>
        </Section>

        <Section title={COPY.bulkTitle}>
          <p className="text-muted-foreground text-sm">{COPY.bulkHelp}</p>
          <Button
            variant="outline"
            className="h-auto min-h-9 justify-start text-left whitespace-normal"
            disabled={bulkConsent.isPending}
            onClick={async () => {
              if (await confirmConsent()) bulkConsent.mutate();
            }}
          >
            {COPY.bulkAction}
          </Button>
          <div className="flex flex-col gap-2 border-t pt-3">
            <p className="text-muted-foreground text-sm">{COPY.backfillHelp}</p>
            <Button
              variant="outline"
              className="h-auto min-h-9 justify-start text-left whitespace-normal"
              disabled={backfill.isPending}
              onClick={() => backfill.mutate()}
            >
              {COPY.backfill}
            </Button>
          </div>
        </Section>
      </div>

      <p className="text-muted-foreground flex items-start gap-2 text-xs">
        <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
        {COPY.privacyHelp}
      </p>
    </div>
  );
};
