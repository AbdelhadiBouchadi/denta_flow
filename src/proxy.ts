import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/connexion";

  // OPTIMISTIC ONLY — cookie presence, not validity. Never a security control.
  // Authorization, including the admin role, is enforced in the tRPC procedure.
  if (!sessionCookie && !isAuthRoute) {
    return NextResponse.redirect(new URL("/connexion", request.url));
  }
  return NextResponse.next();
}

// Keep the matcher narrow — a matched route costs a Node invocation.
// /impression/* is deliberately absent: print routes carry their own page-level check.
export const config = {
  matcher: [
    "/tableau-de-bord/:path*",
    "/patients/:path*",
    "/calendrier/:path*",
    "/rendez-vous/:path*",
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
