import { z } from "zod";

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

export type SignInValues = z.infer<typeof signInSchema>;
