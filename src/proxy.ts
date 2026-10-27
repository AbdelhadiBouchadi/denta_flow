import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * The only two routes reachable without a session (prompts/33, decision 13).
 * Neither is a page: each authenticates ITSELF — the cron with
 * `Authorization: Bearer ${CRON_SECRET}`, the webhook with Twilio's
 * `X-Twilio-Signature`. Exact paths, never a prefix: every other route,
 * `/api/*` included, keeps the session rule.
 */
export const SELF_AUTHENTICATED_PATHS: readonly string[] = [
  "/api/cron/whatsapp",
  "/api/webhooks/whatsapp",
];

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/connexion";

  if (SELF_AUTHENTICATED_PATHS.includes(pathname)) return NextResponse.next();

  // OPTIMISTIC ONLY — cookie presence, not validity. Never a security control.
  // Authorization, including the admin role, is enforced in the tRPC procedure.
  if (!sessionCookie && !isAuthRoute) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

// Keep the matcher narrow — a matched route costs a Node invocation.
// /impression/* is deliberately absent: print routes carry their own page-level check.
// /api/* is absent too: every API route checks its caller itself (tRPC
// procedures, the documents and files handlers, the cron and the webhook).
export const config = {
  matcher: [
    "/tableau-de-bord/:path*",
    "/patients/:path*",
    "/calendrier/:path*",
    "/rendez-vous/:path*",
    "/rappels/:path*",
    "/actes/:path*",
    "/paiements/:path*",
    "/charges/:path*",
    "/documents/:path*",
    "/activite/:path*",
    "/taches/:path*",
    "/statistiques/:path*",
    "/parametres/:path*",
    "/connexion",
  ],
};
