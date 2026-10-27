"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2Icon, PlugZapIcon } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { TimeField } from "@/components/shared/time-field";
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
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import {
  EVENT_OPTIONS,
  MIN_LEAD_HOURS_MAX,
  sendErrorLabel,
  WHATSAPP_COPY as COPY,
  WHATSAPP_ERRORS,
} from "../constants";
import { useInvalidateWhatsapp } from "../hooks/use-invalidate-whatsapp";
import {
  hoursFormSchema,
  hoursToSettings,
  sendTestSchema,
  settingsToHours,
  type HoursFormValues,
  type SendTestValues,
} from "../schemas";
import { WhatsappEvent } from "../types";
import { DiagnosticPanel } from "./diagnostic-panel";
import { ModeBanner } from "./mode-banner";

const Section = ({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) => (
  <Card className="gap-3 px-4 py-4">
    <div className="flex flex-col gap-0.5">
      <h3 className="text-h4 text-foreground font-medium">{title}</h3>
      {description && <p className="text-muted-foreground text-sm">{description}</p>}
    </div>
    {children}
  </Card>
);

/**
 * «Connexion» (prompts/33b, decision 3): one status card a dentist can read,
 * the global switch, the sending hours, a test to one's own phone and the
 * consent actions — in plain French. Everything technical waits, closed, in
 * «Diagnostic technique (pour le support)» at the bottom.
 */
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

  const hoursForm = useForm<HoursFormValues>({
    resolver: zodResolver(hoursFormSchema),
    values: settingsToHours(settings),
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
        else toast.error(`${WHATSAPP_ERRORS.testFailed} : ${sendErrorLabel(result.code)}.`);
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

  // Turning ON needs the connection and the clinic phone; turning off never
  // does. The procedure refuses the same way — this only explains why.
  const switchBlocker = !status.connected
    ? COPY.switchDisabledConnection
    : !status.clinicPhonePresent
      ? COPY.switchDisabledPhone
      : null;

  // The switch saves at once, with the hours as they are saved.
  const toggle = (enabled: boolean) =>
    saveSettings.mutate({ ...settings, enabled });

  return (
    <div className="flex flex-col gap-4">
      <ConsentConfirmation />

      <Card
        className={cn(
          "flex-row items-start gap-3 px-4 py-4",
          status.connected ? "border-success/40 bg-success-subtle" : "bg-muted/40",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            status.connected ? "bg-success text-background" : "bg-muted text-muted-foreground",
          )}
        >
          {status.connected ? (
            <CheckCircle2Icon className="size-5" />
          ) : (
            <PlugZapIcon className="size-5" />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p
            className={cn(
              "font-medium",
              status.connected ? "text-success-strong" : "text-foreground",
            )}
          >
            {status.connected
              ? status.sandboxSender
                ? COPY.connectedSandbox
                : COPY.connected
              : COPY.notConnected}
          </p>
          {status.connected && status.senderNumber ? (
            <p className="text-sm">
              <span className="text-muted-foreground">{COPY.senderLabel} : </span>
              <span className="text-foreground font-medium tabular-nums">
                {status.senderNumber}
              </span>
            </p>
          ) : null}
          <p className="text-muted-foreground text-sm">
            {status.connected ? COPY.connectedHelp : COPY.notConnectedHelp}
          </p>
        </div>
      </Card>

      <Card className="gap-3 px-4 py-4">
        <Field orientation="horizontal" className="items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <FieldLabel htmlFor="whatsapp-enabled">{COPY.globalSwitch}</FieldLabel>
            <FieldDescription>
              {!settings.enabled && switchBlocker
                ? switchBlocker
                : settings.enabled
                  ? COPY.globalSwitchOn
                  : COPY.globalSwitchOff}
            </FieldDescription>
          </div>
          <Switch
            id="whatsapp-enabled"
            checked={settings.enabled}
            onCheckedChange={(checked) => toggle(checked)}
            disabled={saveSettings.isPending || (!settings.enabled && switchBlocker !== null)}
          />
        </Field>
        <ModeBanner mode={status.mode} />
      </Card>

      <form
        noValidate
        onSubmit={hoursForm.handleSubmit((values) =>
          saveSettings.mutate(hoursToSettings(values, settings.enabled)),
        )}
      >
        <Card className="gap-4 px-4 py-4">
          <FieldSet>
            <FieldLegend variant="label">{COPY.hoursTitle}</FieldLegend>
            <FieldDescription>{COPY.hoursHelp}</FieldDescription>
            <FieldGroup className="flex flex-row flex-wrap gap-4">
              {(["windowStart", "windowEnd"] as const).map((name) => (
                <Controller
                  key={name}
                  control={hoursForm.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="w-auto">
                      <FieldLabel htmlFor={`whatsapp-${name}`}>
                        {name === "windowStart" ? COPY.windowStart : COPY.windowEnd}
                      </FieldLabel>
                      <TimeField
                        id={`whatsapp-${name}`}
                        value={field.value}
                        onChange={field.onChange}
                        minuteStep={15}
                        aria-label={name === "windowStart" ? COPY.windowStart : COPY.windowEnd}
                        aria-invalid={fieldState.invalid}
                        disabled={saveSettings.isPending}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              ))}
            </FieldGroup>
          </FieldSet>

          <Controller
            control={hoursForm.control}
            name="minLeadHours"
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="border-t pt-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <FieldLabel htmlFor="whatsapp-min-lead" className="font-normal">
                    {COPY.minLeadBefore}
                  </FieldLabel>
                  <Input
                    id="whatsapp-min-lead"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MIN_LEAD_HOURS_MAX}
                    step={1}
                    aria-label={COPY.minLeadLabel}
                    className="w-20 tabular-nums"
                    value={Number.isNaN(field.value) ? "" : field.value}
                    onChange={(event) => field.onChange(event.target.valueAsNumber)}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    disabled={saveSettings.isPending}
                  />
                  <span className="text-foreground">{COPY.minLeadAfter}</span>
                </div>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

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
        <Section
          title={COPY.testTitle}
          description={status.connected ? COPY.testHelp : COPY.testUnavailable}
        >
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
                      disabled={!status.connected || sendTest.isPending}
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
                      autoComplete="tel"
                      placeholder={COPY.testPhonePlaceholder}
                      aria-invalid={fieldState.invalid}
                      disabled={!status.connected || sendTest.isPending}
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
                disabled={!status.connected || sendTest.isPending}
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

        <Section title={COPY.bulkTitle} description={COPY.bulkHelp}>
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

      <DiagnosticPanel status={status} />
    </div>
  );
};
