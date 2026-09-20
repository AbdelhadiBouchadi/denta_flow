import type { Metadata } from "next";

import SignInView from "@/modules/auth/ui/views/sign-in-view";

export const metadata: Metadata = {
  title: "Connexion",
};

const ConnexionPage = () => {
  return <SignInView />;
};

export default ConnexionPage;
