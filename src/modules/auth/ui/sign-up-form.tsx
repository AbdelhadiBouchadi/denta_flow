"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient } from "@/lib/auth-client";
import {
  AUTH_SUCCESS_REDIRECT,
  MIN_PASSWORD_LENGTH,
} from "@/modules/auth/constants";
import { getAuthErrorMessage } from "@/modules/auth/errors";
import { signUpSchema, type SignUpValues } from "@/modules/auth/schemas";
import { PasswordField } from "@/modules/auth/ui/password-field";

export const SignUpForm = () => {
  const router = useRouter();

  // See the note in sign-in-form.tsx — cleared only when the user stays here.
  const [isPending, setIsPending] = useState(false);

  const form = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: SignUpValues) => {
    setIsPending(true);

    // `role` and `isActive` are `input: false` in src/lib/auth.ts, so they
    // cannot be sent from here — a new account is always an inactive-proof
    // "assistant" until an admin promotes it (02-auth.md §4).
    const { error } = await authClient.signUp.email({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    if (error) {
      setIsPending(false);
      toast.error(getAuthErrorMessage(error.code, error.status));
      return;
    }

    router.push(AUTH_SUCCESS_REDIRECT);
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Nom complet</FieldLabel>
              <Input
                {...field}
                id={field.name}
                autoComplete="name"
                autoFocus
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder="ex. Dr Karim Alaoui"
                className="h-11"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="email"
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={field.name}>Adresse e-mail</FieldLabel>
              <Input
                {...field}
                id={field.name}
                type="email"
                inputMode="email"
                autoComplete="email"
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder="prenom.nom@cabinet.ma"
                className="h-11"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <div className="flex flex-col gap-1.5">
          <PasswordField
            control={form.control}
            name="password"
            label="Mot de passe"
            autoComplete="new-password"
            disabled={isPending}
          />
          <FieldDescription>
            Au moins {MIN_PASSWORD_LENGTH} caractères.
          </FieldDescription>
        </div>

        <PasswordField
          control={form.control}
          name="confirmPassword"
          label="Confirmer le mot de passe"
          autoComplete="new-password"
          disabled={isPending}
        />

        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="h-11 w-full"
        >
          {isPending ? (
            <>
              <Spinner aria-label="Création du compte en cours" />
              Création du compte…
            </>
          ) : (
            "Créer le compte"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
};
