import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { proxy, SELF_AUTHENTICATED_PATHS } from "./proxy";

const ORIGIN = "https://cabinet.example.ma";

const request = (path: string, withSession = false) =>
  new NextRequest(`${ORIGIN}${path}`, {
    headers: withSession
      ? { cookie: "better-auth.session_token=abc.def" }
      : undefined,
  });

const redirectsToLogin = (response: Response) =>
  response.status === 307 &&
  response.headers.get("location") === `${ORIGIN}/connexion`;

describe("proxy", () => {
  it("lets exactly the cron and webhook paths through without a session", () => {
    expect(SELF_AUTHENTICATED_PATHS).toEqual([
      "/api/cron/whatsapp",
      "/api/webhooks/whatsapp",
    ]);
    for (const path of SELF_AUTHENTICATED_PATHS) {
      expect(redirectsToLogin(proxy(request(path)))).toBe(false);
    }
  });

  it("keeps the session rule on every other route, API routes included", () => {
    for (const path of [
      "/api/trpc/patients.getMany",
      "/api/documents/abc",
      "/api/cron/whatsapp/extra",
      "/api/webhooks/whatsapp-other",
      "/api/cron",
      "/rappels",
      "/parametres",
    ]) {
      expect(redirectsToLogin(proxy(request(path)))).toBe(true);
    }
  });

  it("does not redirect a request carrying a session cookie", () => {
    expect(redirectsToLogin(proxy(request("/rappels", true)))).toBe(false);
  });
});
