import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { AUTH_SUCCESS_REDIRECT } from "@/modules/auth/constants";
import AuthShell from "@/modules/auth/ui/auth-shell";

interface Props {
  children: React.ReactNode;
}

/**
 * Tier 2 of 02-auth.md §3: a trusted session read, used to decide where the
 * request belongs. `proxy.ts` only sees cookie presence and cannot tell a valid
 * session from a stale cookie, so the bounce for an already-signed-in staff
 * member is made here, where `auth.api.getSession` is authoritative.
 *
 * Placing it on the layout rather than on each page covers /connexion and
 * /inscription from one call.
 */
const AuthLayout = async ({ children }: Props) => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(AUTH_SUCCESS_REDIRECT);

  return <AuthShell>{children}</AuthShell>;
};

export default AuthLayout;
