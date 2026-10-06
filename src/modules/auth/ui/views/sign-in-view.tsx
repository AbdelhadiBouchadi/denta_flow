import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignInForm } from "@/modules/auth/ui/sign-in-form";

/**
 * Server Component: the card is static chrome, and only <SignInForm /> needs a
 * client bundle. There is no Loading/Error pair here because the view issues no
 * query — nothing to suspend on and nothing for an ErrorBoundary to catch.
 *
 * No «Créer un compte» link: signup is closed, and staff accounts are created
 * by an admin in Paramètres › Utilisateurs (02-auth.md §4).
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
    </Card>
  );
};

export default SignInView;
