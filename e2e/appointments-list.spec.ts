import { expect, test, type Page } from "@playwright/test";

/**
 * `/rendez-vous`: a month with more rows than one page paginates, and any
 * filter change sends the list back to page 1 (prompts/16-appointments.md,
 * follow-up §2). Read-only — it pages and filters, it never writes.
 */

const email = process.env.E2E_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL;
const password =
  process.env.E2E_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD;

/** «11–20 sur 87» — the shared pager's range label. */
const PAGE_RANGE = /^(\d+)–(\d+) sur (\d+)$/;

const signIn = async (page: Page) => {
  await page.goto("/connexion");
  await page.locator("#email").fill(email ?? "");
  await page.locator("#password").fill(password ?? "");
  await page.locator("button[type=submit]").click();
  await page.waitForURL((url) => !url.pathname.startsWith("/connexion"));
};

const pageRange = async (page: Page) => {
  const label = page.getByText(PAGE_RANGE);
  await expect(label).toBeVisible();
  const [, first, last, total] = PAGE_RANGE.exec(
    (await label.textContent())?.trim() ?? "",
  )!.map(Number);
  return { first, last, total };
};

const pageParam = (page: Page) => new URL(page.url()).searchParams.get("page");

/** Navigate and wait until the page is hydrated — a click before that is lost. */
const open = async (page: Page, path: string) => {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
};

test.beforeEach(async ({ page }) => {
  test.skip(!email || !password, "E2E_EMAIL / E2E_PASSWORD are not set");
  await signIn(page);
});

test("paginates a busy month, and a filter change returns to page 1", async ({
  page,
}) => {
  await open(page, "/rendez-vous?view=month");

  // Find a month with more than one page, walking back from the current one
  // (the seed spreads appointments around today).
  let range = await pageRange(page);
  for (let step = 0; step < 3 && range.total <= range.last; step++) {
    await page.getByRole("button", { name: "Période précédente" }).click();
    range = await pageRange(page);
  }
  expect(
    range.total,
    "the seeded data needs a month with more rows than one page",
  ).toBeGreaterThan(range.last);

  // Page 1: rows sit under day header rows, «… · N rendez-vous».
  expect(range.first).toBe(1);
  await expect(page.getByText(/ · \d+ rendez-vous$/).first()).toBeVisible();
  const firstRowOnPage1 = await page.locator("tbody tr").nth(1).textContent();

  // Next page: the URL carries it and the range moves by one page.
  await page.getByRole("button", { name: "Suivant", exact: true }).click();
  await expect.poll(() => pageParam(page)).toBe("2");
  const page2 = await pageRange(page);
  expect(page2.first).toBe(range.last + 1);
  expect(page2.total).toBe(range.total);
  await expect(page.locator("tbody tr").nth(1)).not.toHaveText(
    firstRowOnPage1 ?? "",
  );

  // A filter change goes back to page 1 — `page` leaves the URL (it is the
  // default, cleared by nuqs).
  await page.getByRole("combobox").filter({ hasText: "Tous les statuts" }).click();
  await page.getByRole("option", { name: "Planifié" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("status")).toBe(
    "planned",
  );
  await expect.poll(() => pageParam(page)).toBeNull();

  const filtered = await pageRange(page).catch(() => null);
  // A filter can leave a single page, or none at all (empty state): either
  // way the list starts from its first row.
  if (filtered) expect(filtered.first).toBe(1);
});

test("a range or view change also returns to page 1", async ({ page }) => {
  await open(page, "/rendez-vous?view=month&page=2");
  await page.getByRole("button", { name: "Période suivante" }).click();
  await expect.poll(() => pageParam(page)).toBeNull();

  await open(page, "/rendez-vous?view=month&page=2");
  await page.getByRole("combobox").filter({ hasText: "Mois" }).click();
  await page.getByRole("option", { name: "Semaine" }).click();
  await expect.poll(() => pageParam(page)).toBeNull();
});

test("a page past the end is clamped to the last page", async ({ page }) => {
  await open(page, "/rendez-vous?view=month&page=999");
  await expect.poll(() => pageParam(page)).not.toBe("999");
  const range = await pageRange(page).catch(() => null);
  if (range) expect(range.last).toBe(range.total);
});
