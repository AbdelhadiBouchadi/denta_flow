"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import ResponsiveDialog from "@/components/shared/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { getErrorMessage } from "@/lib/errors";
import { useTRPC } from "@/trpc/client";
import {
  STAFF_COPY,
  STAFF_FIELD_LABELS,
  STAFF_ROLE_OPTIONS,
} from "../constants";
import { useInvalidateStaff } from "../hooks/use-invalidate-staff";
import { staffUpdateRoleSchema, type StaffRoleValues } from "../schemas";
import type { StaffListItem, StaffRole } from "../types";

interface UpdateRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: StaffListItem;
}

/**
 * The role has its own dialog, apart from «Modifier»: it is the one change
 * with guards (no self-demotion, never the last admin), and those are decided
 * by `staff.updateRole`. A refusal arrives as its French message.
 */
const UpdateRoleDialog = ({
  open,
  onOpenChange,
  staff,
}: UpdateRoleDialogProps) => (
  <ResponsiveDialog
    title={STAFF_COPY.roleTitle}
    description={STAFF_COPY.roleDescription}
    open={open}
    onOpenChange={onOpenChange}
  >
    {/* Mounted only while open, so it always starts from the current role. */}
    {open && <RoleForm staff={staff} onDone={() => onOpenChange(false)} />}
  </ResponsiveDialog>
);

const RoleForm = ({
  staff,
  onDone,
}: {
  staff: StaffListItem;
  onDone: () => void;
}) => {
  const trpc = useTRPC();
  const invalidateAll = useInvalidateStaff();

  const form = useForm<StaffRoleValues>({
    resolver: zodResolver(staffUpdateRoleSchema),
    defaultValues: { id: staff.id, role: staff.role as StaffRole },
  });

  const updateRole = useMutation(
    trpc.staff.updateRole.mutationOptions({
      onSuccess: async () => {
        await invalidateAll();
        toast.success(STAFF_COPY.roleUpdated);
        onDone();
      },
      onError: (error) => toast.error(getErrorMessage(error)),
    }),
  );

  return (
    <form
      onSubmit={form.handleSubmit((values) => updateRole.mutate(values))}
      noValidate
      className="flex flex-col gap-6 px-4"
    >
      <p className="text-foreground text-sm font-medium">{staff.name}</p>

      <Controller
        control={form.control}
        name="role"
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={field.name}>
              {STAFF_FIELD_LABELS.role}
            </FieldLabel>
            <Select
              id={field.name}
              value={field.value}
              onValueChange={(value) => value && field.onChange(value)}
              disabled={updateRole.isPending}
              items={STAFF_ROLE_OPTIONS}
            >
              <SelectTrigger size="default" className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_ROLE_OPTIONS.map((option) => (
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

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          size="lg"
          disabled={updateRole.isPending}
          onClick={onDone}
          className="w-full sm:w-auto"
        >
          {STAFF_COPY.cancel}
        </Button>
        <Button
          type="submit"
          size="lg"
          disabled={updateRole.isPending}
          className="w-full sm:w-auto"
        >
          {updateRole.isPending && <Spinner aria-label={STAFF_COPY.updating} />}
          {updateRole.isPending ? STAFF_COPY.updating : STAFF_COPY.update}
        </Button>
      </div>
    </form>
  );
};

export default UpdateRoleDialog;
