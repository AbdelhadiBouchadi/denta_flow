import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/modules/auth/ui/sign-in-form";

/**
 * Server Component: the card is static chrome, and only <SignInForm /> needs a
 * client bundle. There is no Loading/Error pair here because the view issues no
 * query — nothing to suspend on and nothing for an ErrorBoundary to catch.
 */
const SignInView = () => {
  return (
    <Card className="[--card-spacing:--spacing(6)]">
      <CardHeader>
        <CardTitle className="text-h2">Connexion</CardTitle>
        <CardDescription>
          Accédez au tableau de bord du cabinet.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <SignInForm />
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-body text-muted-foreground">
          Pas encore de compte&nbsp;?{" "}
          <Link
            href="/inscription"
            className="text-primary font-medium underline-offset-4 hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
};

export default SignInView;
