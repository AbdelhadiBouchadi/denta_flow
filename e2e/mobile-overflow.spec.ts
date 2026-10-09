import { devices, expect, test, type Page } from "@playwright/test";

/**
 * No dashboard route scrolls sideways on a phone.
 *
 * WebKit with the iPhone 13 profile (touch, DPR 3), because iOS Safari is
 * where the bug showed and a resized desktop Chromium does not reproduce it:
 * WebKit gives react-dropzone's zero-width file input its intrinsic width as a
 * flex minimum, which an `auto` grid track then grew to fit.
 *
 * Every route, every Paramètres section, every dossier tab and every agenda
 * view, at three phone widths, light and dark. Fails when
 * `scrollWidth > innerWidth` and names the outermost overflowing element whose
 * parent still fits — the root cause. Read-only: it navigates, nothing else.
 *
 * Needs `npx playwright install webkit` once.
 */

test.use({ ...devices["iPhone 13"], browserName: "webkit" });

const email = process.env.E2E_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
const password =
  process.env.E2E_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;

const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
] as const;
const COLOR_SCHEMES = ["light", "dark"] as const;

const SETTINGS_SECTIONS = [
  "general",
  "users",
  "tags",
  "insurers",
  "services",
  "appointment-types",
  "schedules",
] as const;
const PATIENT_TABS = [
  "informations",
  "medical_history",
  "appointments",
  "treatments",
  "payments",
  "documents",
] as const;
const CALENDAR_VIEWS = ["day", "week", "month", "agenda"] as const;

const signIn = async (page: Page) => {
  await page.goto("/connexion");
  // Before hydration the form would submit natively and never sign in.
  await page.waitForLoadState("networkidle");
  await page.locator("#email").fill(email ?? "");
  await page.locator("#password").fill(password ?? "");
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"), {
    waitUntil: "commit",
  });
};

const open = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(300);
};

/**
 * Page overflow, plus the outermost overflowing element whose parent fits.
 * Descendants of a scroll container are skipped: a tab row or a table that
 * scrolls inside its own box is fine.
 */
const measure = (page: Page) =>
  page.evaluate(() => {
    const viewport = window.innerWidth;
    const clipped = (element: Element) => {
      for (let p = element.parentElement; p; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible") return true;
      }
      return false;
    };
    const culprit = [...document.body.querySelectorAll("*")].find(
      (element) => {
        const parent = element.parentElement;
        return (
          element.getBoundingClientRect().right > viewport + 0.5 &&
          parent !== null &&
          parent.getBoundingClientRect().right <= viewport + 0.5 &&
          !clipped(element)
        );
      },
    );
    return {
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: viewport,
      culprit: culprit
        ? `<${culprit.tagName.toLowerCase()} class="${culprit.getAttribute("class") ?? ""}">`
        : null,
    };
  });

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD are not set");
  await signIn(page);
});

test("no dashboard route scrolls sideways at phone widths", async ({ page }) => {
  // ~25 URLs × 3 widths, two colour schemes each.
  test.setTimeout(900_000);

  // /patients rows navigate on click; /actes links to the dossier.
  await open(page, "/actes");
  const href = await page
    .locator("a[href^='/patients/']")
    .first()
    .getAttribute("href", { timeout: 15_000 });
  expect(href, "a seeded patient with actes").toBeTruthy();
  const dossierHref = href!.split("?")[0];

  const paths = [
    "/tableau-de-bord",
    "/patients",
    ...PATIENT_TABS.map((tab) => `${dossierHref}?tab=${tab}`),
    ...CALENDAR_VIEWS.map((view) => `/calendrier?view=${view}`),
    "/rendez-vous",
    "/actes",
    "/paiements",
    "/documents",
    ...SETTINGS_SECTIONS.map((section) => `/parametres?section=${section}`),
  ];

  for (const path of paths) {
    for (const viewport of VIEWPORTS) {
      await page.setViewportSize(viewport);
      // Reload per width: some layouts branch on the width at mount.
      await open(page, path);
      for (const colorScheme of COLOR_SCHEMES) {
        await page.emulateMedia({ colorScheme });
        const m = await measure(page);
        const label = `${path} ${viewport.width}x${viewport.height} ${colorScheme}`;
        console.log(
          `${label.padEnd(56)} scrollWidth=${m.scrollWidth} innerWidth=${m.innerWidth}${m.culprit ? ` culprit=${m.culprit}` : ""}`,
        );
        expect
          .soft(m.scrollWidth, `${label} — ${m.culprit ?? "no culprit found"}`)
          .toBeLessThanOrEqual(m.innerWidth);
      }
    }
  }
});
