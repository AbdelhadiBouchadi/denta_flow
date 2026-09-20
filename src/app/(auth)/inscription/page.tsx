import type { Metadata } from "next";

import SignUpView from "@/modules/auth/ui/views/sign-up-view";

export const metadata: Metadata = {
  title: "Créer un compte",
};

const InscriptionPage = () => {
  return <SignUpView />;
};

export default InscriptionPage;
