import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignUpForm } from "@/modules/auth/ui/sign-up-form";

/**
 * Temporary by design: 02-auth.md §4 deletes this route once the staff branch
 * lands and accounts are created by an admin through `staff.create`. It is a
 * plain sign-up form, deliberately not a "create your clinic" onboarding flow.
 */
const SignUpView = () => {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-h2">Créer un compte</CardTitle>
        <CardDescription>
          Créez votre accès au tableau de bord du cabinet.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <SignUpForm />
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-body text-muted-foreground">
          Vous avez déjà un compte&nbsp;?{" "}
          <Link
            href="/connexion"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Se connecter
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default SignUpView;
