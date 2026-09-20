"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

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
import { AUTH_SUCCESS_REDIRECT } from "@/modules/auth/constants";
import { getAuthErrorMessage } from "@/modules/auth/errors";
import { signInSchema, type SignInValues } from "@/modules/auth/schemas";
import { PasswordField } from "@/modules/auth/ui/password-field";

export const SignInForm = () => {
  const router = useRouter();

  // Not react-hook-form's `isSubmitting`: that flips back to false the moment
  // the request resolves, un-spinning the button while the navigation to the
  // dashboard is still in flight. The flag is only cleared on the error path,
  // where the user stays on this screen.
  const [isPending, setIsPending] = useState(false);

  const form = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = async (values: SignInValues) => {
    setIsPending(true);

    const { error } = await authClient.signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setIsPending(false);
      toast.error(getAuthErrorMessage(error.code, error.status));
      return;
    }

    router.push(AUTH_SUCCESS_REDIRECT);
    // The session cookie only exists after the response above, so every Server
    // Component rendered before it still believes we are signed out. Refreshing
    // discards that stale RSC payload from the router cache.
    router.refresh();
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup>
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
                autoFocus
                disabled={isPending}
                aria-invalid={fieldState.invalid}
                placeholder="prenom.nom@cabinet.ma"
                className="h-11"
              />
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <PasswordField
          control={form.control}
          name="password"
          label="Mot de passe"
          autoComplete="current-password"
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
              <Spinner aria-label="Connexion en cours" />
              Connexion…
            </>
          ) : (
            "Se connecter"
          )}
        </Button>
      </FieldGroup>
    </form>
  );
};
