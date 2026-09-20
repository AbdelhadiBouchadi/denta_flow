import { z } from "zod";

import { MIN_PASSWORD_LENGTH } from "./constants";

/**
 * Zod messages are rendered verbatim by <FieldError /> — review them as French
 * copy, not as debug text (06-ui.md §10).
 */

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "L’adresse e-mail est obligatoire" })
    .email({ message: "Adresse e-mail invalide" }),
  // No length rule on sign-in: an old account may predate the current minimum,
  // and the server is the only authority on whether the password is right.
  password: z.string().min(1, { message: "Le mot de passe est obligatoire" }),
});

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "Le nom est obligatoire" })
      .max(100, { message: "Le nom est trop long" }),
    email: z
      .string()
      .trim()
      .min(1, { message: "L’adresse e-mail est obligatoire" })
      .email({ message: "Adresse e-mail invalide" }),
    password: z.string().min(MIN_PASSWORD_LENGTH, {
      message: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères`,
    }),
    confirmPassword: z
      .string()
      .min(1, { message: "La confirmation est obligatoire" }),
  })
  // An invariant the field schemas cannot express, so it lives in a refine and
  // is attached to the field the user has to fix (05-slice.md §1).
  .refine((values) => values.password === values.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
