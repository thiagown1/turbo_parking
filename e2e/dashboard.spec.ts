import { test, expect, Page } from "@playwright/test";

const ADMIN_EMAIL = "admin@turboparking.com";
const ADMIN_PASSWORD = "TurboParking2026!";

async function login(page: Page) {
  await page.goto("/auth/login");
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for redirect to dashboard — Firebase Auth cold start can be slow
  await page.waitForURL("**/dashboard**", { timeout: 30000 });
}

test.describe("Authentication", () => {
  test("should redirect unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test("should login and redirect to dashboard", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);
    // Should see the dashboard layout
    await expect(page.locator("text=Turbo Parking")).toBeVisible();
  });

  test("should show error for invalid credentials", async ({ page }) => {
    await page.goto("/auth/login");
    await page.fill('input[type="email"]', "wrong@test.com");
    await page.fill('input[type="password"]', "wrongpassword");
    await page.click('button[type="submit"]');
    // Should show error, not redirect
    await expect(page.locator("text=incorretos")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Dashboard - Tickets Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should display sessions from Firestore", async ({ page }) => {
    await page.goto("/dashboard/tickets");
    // Wait for data to load (the table should no longer say "Carregando")
    await expect(page.locator("text=Carregando")).not.toBeVisible({ timeout: 10000 });

    // Should show our seeded test plates
    await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=TEST002")).toBeVisible();
    await expect(page.locator("text=TEST003")).toBeVisible();
  });

  test("should show correct payment badges", async ({ page }) => {
    await page.goto("/dashboard/tickets");
    await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });

    // TEST001 = pending, TEST002 = paid, TEST003 = free
    const test001Row = page.locator("tr", { has: page.locator("text=TEST001") });
    await expect(test001Row.locator("text=Pendente")).toBeVisible();

    const test002Row = page.locator("tr", { has: page.locator("text=TEST002") });
    await expect(test002Row.locator("text=Pago")).toBeVisible();

    const test003Row = page.locator("tr", { has: page.locator("text=TEST003") });
    await expect(test003Row.locator("text=Isento")).toBeVisible();
  });

  test("should show Validar button only for pending+active sessions", async ({ page }) => {
    await page.goto("/dashboard/tickets");
    await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });

    // TEST001 (pending + active) should have the Validar button
    const test001Row = page.locator("tr", { has: page.locator("text=TEST001") });
    await expect(test001Row.locator("text=Validar")).toBeVisible();

    // TEST002 (paid) should NOT have Validar
    const test002Row = page.locator("tr", { has: page.locator("text=TEST002") });
    await expect(test002Row.locator("text=Validar")).not.toBeVisible();

    // TEST003 (free/authorized) should NOT have Validar
    const test003Row = page.locator("tr", { has: page.locator("text=TEST003") });
    await expect(test003Row.locator("text=Validar")).not.toBeVisible();
  });

  test("should filter sessions by search", async ({ page }) => {
    await page.goto("/dashboard/tickets");
    await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });

    // Search for TEST002
    await page.fill('input[placeholder*="Buscar"]', "TEST002");

    // TEST002 should be visible, others hidden
    await expect(page.locator("text=TEST002")).toBeVisible();
    await expect(page.locator("text=TEST001")).not.toBeVisible();
    await expect(page.locator("text=TEST003")).not.toBeVisible();
  });
});

test.describe("Dashboard - Scan/Search Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should search for a session by plate", async ({ page }) => {
    // Go directly to scan page with manual tab to avoid QR camera init
    await page.goto("/dashboard/scan");
    // Wait for page to load, then switch to manual tab
    await page.waitForLoadState("networkidle");

    // Click the manual search tab
    await page.click("text=Busca de Placa");
    await page.waitForTimeout(500);

    // Search for TEST002 (paid — won't be altered by validation tests)
    await page.fill('input[placeholder*="ABC1234"]', "TEST002");
    await page.click("text=Buscar Placa");

    // Should find the session and show details
    await expect(page.locator("text=Placa Encontrada")).toBeVisible({ timeout: 10000 });
    await expect(page.locator("text=TEST002")).toBeVisible();
    await expect(page.locator("text=Pago")).toBeVisible();
  });

  test("should show error for non-existent plate", async ({ page }) => {
    await page.goto("/dashboard/scan");
    await page.waitForLoadState("networkidle");

    // Switch to manual search tab
    await page.click("text=Busca de Placa");
    await page.waitForTimeout(500);

    // Search for non-existent plate
    await page.fill('input[placeholder*="ABC1234"]', "XXXXXX");
    await page.click("text=Buscar Placa");

    // Should show error state
    await expect(page.locator("text=Não Encontrada")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Dashboard - Validate Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Re-seed test data since previous tests may have modified it
    const { execSync } = await import("child_process");
    execSync("node scripts/seed-e2e.js", { stdio: "ignore" });
    await login(page);
  });

  test("should validate a session from scan page", async ({ page }) => {
    await page.goto("/dashboard/scan");
    await page.waitForLoadState("networkidle");

    // Switch to manual search tab
    await page.click("text=Busca de Placa");
    await page.waitForTimeout(500);

    // Search for TEST001 (pending session)
    await page.fill('input[placeholder*="ABC1234"]', "TEST001");
    await page.click("text=Buscar Placa");

    // Wait for the result
    await expect(page.locator("text=Pendente")).toBeVisible({ timeout: 10000 });

    // Click validate
    await page.click("text=Validar Sessão");

    // Should show success
    await expect(page.locator("text=Validada")).toBeVisible({ timeout: 10000 });
  });
});

test.describe("Dashboard - Config Page", () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test("should load config page with test mode toggle", async ({ page }) => {
    await page.goto("/dashboard/config");

    // Should see the test mode section
    await expect(page.locator("text=Modo de Teste")).toBeVisible({ timeout: 10000 });

    // Should see the validation rules section
    await expect(page.locator("text=Regras de Validação")).toBeVisible();
  });
});

test.describe("Dashboard - Logout", () => {
  test("should logout and redirect to login", async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/dashboard/);

    // Click logout in sidebar (desktop viewport)
    await page.click("text=Sair");

    // Should redirect to login — use waitForURL for navigation
    await page.waitForURL("**/auth/login**", { timeout: 15000 });
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
