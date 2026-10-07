import { expect, test, type Page } from "@playwright/test";

/**
 * `/actes` and the dossier «Actes» tab fit the content area: Montant · Statut
 * · Reste are never pushed off-screen (prompts/19-actes.md, follow-up §1).
 *
 * From 1280 px, sidebar expanded or collapsed, the table's own container
 * must not scroll horizontally (`scrollWidth === clientWidth`), and neither
 * may the page. Read-only — it navigates and toggles the sidebar, nothing else.
 */

const email = process.env.E2E_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
const password =
  process.env.E2E_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;

const WIDTHS = [1280, 1440, 1920] as const;
const SIDEBAR_STATES = ["expanded", "collapsed"] as const;

const signIn = async (page: Page) => {
  await page.goto("/connexion");
  await page.locator("#email").fill(email ?? "");
  await page.locator("#password").fill(password ?? "");
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
};

const open = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
};

/** The sidebar opens expanded; Ctrl+B is its own keyboard toggle. */
const setSidebar = async (
  page: Page,
  state: (typeof SIDEBAR_STATES)[number],
) => {
  const sidebar = page.locator("[data-slot=sidebar][data-state]").first();
  if ((await sidebar.getAttribute("data-state")) !== state) {
    await page.keyboard.press("Control+b");
    await expect(sidebar).toHaveAttribute("data-state", state);
  }
  // The sidebar animates its width; measure once it has settled.
  await page.waitForTimeout(400);
};

/** Overflow of a scroll container and of the page itself, in px. */
const measure = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));

/** The shared DataTable's scroll container is the parent of its <table>. */
const TABLE_CONTAINER = "[data-slot=table-container]";
/** The dossier tab's list. */
const DOSSIER_LIST = "[data-slot=treatment-list]";

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD are not set");
  await signIn(page);
});

test("/actes and the dossier tab never scroll sideways from 1280 px", async ({
  page,
}) => {
  // 12 viewport × sidebar combinations, two pages each.
  test.setTimeout(180_000);
  await open(page, "/actes");
  // A patient with actes, for the dossier tab.
  const dossierHref = await page
    .locator("tbody a[href^='/patients/']")
    .first()
    .getAttribute("href");
  expect(dossierHref).toBeTruthy();

  for (const width of WIDTHS) {
    for (const sidebar of SIDEBAR_STATES) {
      await page.setViewportSize({ width, height: 900 });

      for (const [label, path, selector] of [
        ["/actes", "/actes", TABLE_CONTAINER],
        ["dossier", dossierHref!, DOSSIER_LIST],
      ] as const) {
        await open(page, path);
        await setSidebar(page, sidebar);
        const m = await measure(page, selector);
        console.log(
          `${label.padEnd(8)} ${width} ${sidebar.padEnd(9)} scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth} pageOverflow=${m.pageOverflow}`,
        );
        expect.soft(m.scrollWidth, `${label} ${width} ${sidebar}`).toBe(
          m.clientWidth,
        );
        expect.soft(m.pageOverflow, `${label} ${width} ${sidebar} page`).toBe(0);
      }
    }
  }
});

test("the tightest width holds on every early page of /actes", async ({
  page,
}) => {
  // Long NGAP wordings and many-tooth actes land on whichever page they
  // land on: page 1 alone could pass by luck.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  for (let pageNumber = 1; pageNumber <= 6; pageNumber++) {
    await open(page, `/actes?page=${pageNumber}`);
    await setSidebar(page, "expanded");
    const m = await measure(page, TABLE_CONTAINER);
    console.log(
      `/actes?page=${pageNumber} 1280 expanded scrollWidth=${m.scrollWidth} clientWidth=${m.clientWidth}`,
    );
    expect.soft(m.scrollWidth, `page ${pageNumber}`).toBe(m.clientWidth);
    await expect(page.getByRole("columnheader", { name: "Reste" })).toBeInViewport();
  }
});
