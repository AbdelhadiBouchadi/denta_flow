"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  AUTH_SIGN_OUT_REDIRECT,
  NETWORK_AUTH_ERROR_MESSAGE,
} from "@/modules/auth/constants";
import { getAuthErrorMessage } from "@/modules/auth/errors";

/**
 * The one sign-out path. Every «Se déconnecter» affordance — the navbar menu
 * today, the staff screens later — calls this and nothing else, so the copy,
 * the redirect and the error handling cannot drift between them.
 *
 * Both callbacks run inside Better Auth's fetch pipeline, before the promise
 * settles and before the session atom is cleared. That matters: the toast is
 * queued while the caller is still mounted and before anything can go wrong
 * downstream of the request.
 *
 * `isSigningOut` is never cleared on the success path — the button must keep
 * spinning while the navigation to /connexion is in flight.
 */
export const useSignOut = () => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const signOut = async () => {
    // A menu item can fire twice on a press-and-release gesture; one sign-out
    // is enough, and the second would answer with an error on a dead session.
    if (isSigningOut) return;
    setIsSigningOut(true);

    try {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success("Déconnexion réussie.");
            router.push(AUTH_SIGN_OUT_REDIRECT);
            // The session cookie is gone, but every Server Component already
            // rendered still believes we are signed in — drop that payload
            // from the router cache.
            router.refresh();
          },
          onError: ({ error }) => {
            setIsSigningOut(false);
            toast.error(getAuthErrorMessage(error.code, error.status));
          },
        },
      });
    } catch {
      // A rejection here means the request never completed its round trip.
      // Swallowing it would leave the button spinning with no explanation.
      setIsSigningOut(false);
      toast.error(NETWORK_AUTH_ERROR_MESSAGE);
    }
  };

  return { signOut, isSigningOut };
};
