# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Authentication >> should login and redirect to dashboard
- Location: e2e/dashboard.spec.ts:21:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Turbo Parking')
Expected: visible
Error: strict mode violation: locator('text=Turbo Parking') resolved to 2 elements:
    1) <span class="text-lg font-semibold tracking-tight">Turbo Parking</span> aka getByRole('complementary').getByText('Turbo Parking')
    2) <span class="font-semibold">Turbo Parking</span> aka getByRole('banner').getByText('Turbo Parking')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Turbo Parking')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - generic [ref=e4]:
        - img [ref=e6]
        - generic [ref=e9]: Turbo Parking
      - navigation [ref=e10]:
        - link "Overview" [ref=e11] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e12]
          - text: Overview
        - link "Tickets" [ref=e17] [cursor=pointer]:
          - /url: /dashboard/tickets
          - img [ref=e18]
          - text: Tickets
        - link "QR Scan" [ref=e20] [cursor=pointer]:
          - /url: /dashboard/scan
          - img [ref=e21]
          - text: QR Scan
        - link "Histórico" [ref=e27] [cursor=pointer]:
          - /url: /dashboard/history
          - img [ref=e28]
          - text: Histórico
        - link "Configurações" [ref=e32] [cursor=pointer]:
          - /url: /dashboard/config
          - img [ref=e33]
          - text: Configurações
      - button "Sair" [ref=e37]:
        - img [ref=e38]
        - text: Sair
    - generic [ref=e41]:
      - banner [ref=e42]:
        - heading "Overview" [level=1] [ref=e44]
        - generic [ref=e45]:
          - generic [ref=e46]: Admin
          - generic [ref=e47]: A
      - main [ref=e48]:
        - generic [ref=e49]:
          - generic [ref=e50]:
            - generic [ref=e51]:
              - generic [ref=e52]:
                - generic [ref=e53]: Veículos no Pátio
                - img [ref=e54]
              - generic [ref=e58]:
                - generic [ref=e59]: "42"
                - generic [ref=e60]: +12%
            - generic [ref=e61]:
              - generic [ref=e62]:
                - generic [ref=e63]: Validados (EV)
                - img [ref=e64]
              - generic [ref=e67]:
                - generic [ref=e68]: "18"
                - generic [ref=e69]: +8%
            - generic [ref=e70]:
              - generic [ref=e71]:
                - generic [ref=e72]: Pendentes
                - img [ref=e73]
              - generic [ref=e76]:
                - generic [ref=e77]: "24"
                - generic [ref=e78]: "-2"
            - generic [ref=e79]:
              - generic [ref=e80]:
                - generic [ref=e81]: Visitas LPR
                - img [ref=e82]
              - generic [ref=e85]:
                - generic [ref=e86]: "156"
                - generic [ref=e87]: +15%
          - generic [ref=e88]:
            - generic [ref=e89]:
              - generic [ref=e90]:
                - img [ref=e91]
                - heading "Câmera LPR de Entrada" [level=2] [ref=e94]
                - generic [ref=e95]: Ao vivo
              - generic [ref=e98]:
                - img [ref=e99]
                - paragraph [ref=e102]: Integração com câmera de reconhecimento pendente.
            - generic [ref=e103]:
              - generic [ref=e104]:
                - img [ref=e105]
                - heading "Leituras (7 dias)" [level=2] [ref=e107]
              - generic [ref=e108]:
                - generic [ref=e109]:
                  - generic [ref=e110]: "120"
                  - generic [ref=e112]: Seg
                - generic [ref=e113]:
                  - generic [ref=e114]: "145"
                  - generic [ref=e116]: Ter
                - generic [ref=e117]:
                  - generic [ref=e118]: "130"
                  - generic [ref=e120]: Qua
                - generic [ref=e121]:
                  - generic [ref=e122]: "156"
                  - generic [ref=e124]: Qui
                - generic [ref=e125]:
                  - generic [ref=e126]: "198"
                  - generic [ref=e128]: Sex
                - generic [ref=e129]:
                  - generic [ref=e130]: "210"
                  - generic [ref=e132]: Sáb
                - generic [ref=e133]:
                  - generic [ref=e134]: "180"
                  - generic [ref=e136]: Dom
          - generic [ref=e137]:
            - generic [ref=e138]:
              - heading "Atividade Recente" [level=2] [ref=e139]
              - link "Ver todas →" [ref=e140] [cursor=pointer]:
                - /url: /dashboard/tickets
            - table [ref=e142]:
              - rowgroup [ref=e143]:
                - row "Placa Pagamento Entrada Tipo Confiança LPR" [ref=e144]:
                  - columnheader "Placa" [ref=e145]
                  - columnheader "Pagamento" [ref=e146]
                  - columnheader "Entrada" [ref=e147]
                  - columnheader "Tipo" [ref=e148]
                  - columnheader "Confiança LPR" [ref=e149]
              - rowgroup [ref=e150]:
                - row "SGT7D71 Pago 30/04/2026, 19:52 visitante 98.5%" [ref=e151]:
                  - cell "SGT7D71" [ref=e152]:
                    - code [ref=e153]: SGT7D71
                  - cell "Pago" [ref=e154]:
                    - generic [ref=e155]: Pago
                  - cell "30/04/2026, 19:52" [ref=e156]
                  - cell "visitante" [ref=e157]
                  - cell "98.5%" [ref=e158]
                - row "ABC1234 Isento 30/04/2026, 19:07 morador 99.1%" [ref=e159]:
                  - cell "ABC1234" [ref=e160]:
                    - code [ref=e161]: ABC1234
                  - cell "Isento" [ref=e162]:
                    - generic [ref=e163]: Isento
                  - cell "30/04/2026, 19:07" [ref=e164]
                  - cell "morador" [ref=e165]
                  - cell "99.1%" [ref=e166]
                - row "XYZ9876 Pendente 30/04/2026, 17:37 visitante 96.2%" [ref=e167]:
                  - cell "XYZ9876" [ref=e168]:
                    - code [ref=e169]: XYZ9876
                  - cell "Pendente" [ref=e170]:
                    - generic [ref=e171]: Pendente
                  - cell "30/04/2026, 17:37" [ref=e172]
                  - cell "visitante" [ref=e173]
                  - cell "96.2%" [ref=e174]
                - row "DEF5678 Pendente 30/04/2026, 20:07 visitante 95.0%" [ref=e175]:
                  - cell "DEF5678" [ref=e176]:
                    - code [ref=e177]: DEF5678
                  - cell "Pendente" [ref=e178]:
                    - generic [ref=e179]: Pendente
                  - cell "30/04/2026, 20:07" [ref=e180]
                  - cell "visitante" [ref=e181]
                  - cell "95.0%" [ref=e182]
  - button "Open Next.js Dev Tools" [ref=e188] [cursor=pointer]:
    - img [ref=e189]
  - alert [ref=e192]
```

# Test source

```ts
  1   | import { test, expect, Page } from "@playwright/test";
  2   | 
  3   | const ADMIN_EMAIL = "admin@turboparking.com";
  4   | const ADMIN_PASSWORD = "TurboParking2026!";
  5   | 
  6   | async function login(page: Page) {
  7   |   await page.goto("/auth/login");
  8   |   await page.fill('input[type="email"]', ADMIN_EMAIL);
  9   |   await page.fill('input[type="password"]', ADMIN_PASSWORD);
  10  |   await page.click('button[type="submit"]');
  11  |   // Wait for redirect to dashboard — Firebase Auth cold start can be slow
  12  |   await page.waitForURL("**/dashboard**", { timeout: 30000 });
  13  | }
  14  | 
  15  | test.describe("Authentication", () => {
  16  |   test("should redirect unauthenticated users to login", async ({ page }) => {
  17  |     await page.goto("/dashboard");
  18  |     await expect(page).toHaveURL(/\/auth\/login/);
  19  |   });
  20  | 
  21  |   test("should login and redirect to dashboard", async ({ page }) => {
  22  |     await login(page);
  23  |     await expect(page).toHaveURL(/\/dashboard/);
  24  |     // Should see the dashboard layout
> 25  |     await expect(page.locator("text=Turbo Parking")).toBeVisible();
      |                                                      ^ Error: expect(locator).toBeVisible() failed
  26  |   });
  27  | 
  28  |   test("should show error for invalid credentials", async ({ page }) => {
  29  |     await page.goto("/auth/login");
  30  |     await page.fill('input[type="email"]', "wrong@test.com");
  31  |     await page.fill('input[type="password"]', "wrongpassword");
  32  |     await page.click('button[type="submit"]');
  33  |     // Should show error, not redirect
  34  |     await expect(page.locator("text=incorretos")).toBeVisible({ timeout: 10000 });
  35  |   });
  36  | });
  37  | 
  38  | test.describe("Dashboard - Tickets Page", () => {
  39  |   test.beforeEach(async ({ page }) => {
  40  |     await login(page);
  41  |   });
  42  | 
  43  |   test("should display sessions from Firestore", async ({ page }) => {
  44  |     await page.goto("/dashboard/tickets");
  45  |     // Wait for data to load (the table should no longer say "Carregando")
  46  |     await expect(page.locator("text=Carregando")).not.toBeVisible({ timeout: 10000 });
  47  | 
  48  |     // Should show our seeded test plates
  49  |     await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });
  50  |     await expect(page.locator("text=TEST002")).toBeVisible();
  51  |     await expect(page.locator("text=TEST003")).toBeVisible();
  52  |   });
  53  | 
  54  |   test("should show correct payment badges", async ({ page }) => {
  55  |     await page.goto("/dashboard/tickets");
  56  |     await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });
  57  | 
  58  |     // TEST001 = pending, TEST002 = paid, TEST003 = free
  59  |     const test001Row = page.locator("tr", { has: page.locator("text=TEST001") });
  60  |     await expect(test001Row.locator("text=Pendente")).toBeVisible();
  61  | 
  62  |     const test002Row = page.locator("tr", { has: page.locator("text=TEST002") });
  63  |     await expect(test002Row.locator("text=Pago")).toBeVisible();
  64  | 
  65  |     const test003Row = page.locator("tr", { has: page.locator("text=TEST003") });
  66  |     await expect(test003Row.locator("text=Isento")).toBeVisible();
  67  |   });
  68  | 
  69  |   test("should show Validar button only for pending+active sessions", async ({ page }) => {
  70  |     await page.goto("/dashboard/tickets");
  71  |     await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });
  72  | 
  73  |     // TEST001 (pending + active) should have the Validar button
  74  |     const test001Row = page.locator("tr", { has: page.locator("text=TEST001") });
  75  |     await expect(test001Row.locator("text=Validar")).toBeVisible();
  76  | 
  77  |     // TEST002 (paid) should NOT have Validar
  78  |     const test002Row = page.locator("tr", { has: page.locator("text=TEST002") });
  79  |     await expect(test002Row.locator("text=Validar")).not.toBeVisible();
  80  | 
  81  |     // TEST003 (free/authorized) should NOT have Validar
  82  |     const test003Row = page.locator("tr", { has: page.locator("text=TEST003") });
  83  |     await expect(test003Row.locator("text=Validar")).not.toBeVisible();
  84  |   });
  85  | 
  86  |   test("should filter sessions by search", async ({ page }) => {
  87  |     await page.goto("/dashboard/tickets");
  88  |     await expect(page.locator("text=TEST001")).toBeVisible({ timeout: 10000 });
  89  | 
  90  |     // Search for TEST002
  91  |     await page.fill('input[placeholder*="Buscar"]', "TEST002");
  92  | 
  93  |     // TEST002 should be visible, others hidden
  94  |     await expect(page.locator("text=TEST002")).toBeVisible();
  95  |     await expect(page.locator("text=TEST001")).not.toBeVisible();
  96  |     await expect(page.locator("text=TEST003")).not.toBeVisible();
  97  |   });
  98  | });
  99  | 
  100 | test.describe("Dashboard - Scan/Search Page", () => {
  101 |   test.beforeEach(async ({ page }) => {
  102 |     await login(page);
  103 |   });
  104 | 
  105 |   test("should search for a session by plate", async ({ page }) => {
  106 |     // Go directly to scan page with manual tab to avoid QR camera init
  107 |     await page.goto("/dashboard/scan");
  108 |     // Wait for page to load, then switch to manual tab
  109 |     await page.waitForLoadState("networkidle");
  110 | 
  111 |     // Click the manual search tab
  112 |     await page.click("text=Busca de Placa");
  113 |     await page.waitForTimeout(500);
  114 | 
  115 |     // Search for TEST002 (paid — won't be altered by validation tests)
  116 |     await page.fill('input[placeholder*="ABC1234"]', "TEST002");
  117 |     await page.click("text=Buscar Placa");
  118 | 
  119 |     // Should find the session and show details
  120 |     await expect(page.locator("text=Placa Encontrada")).toBeVisible({ timeout: 10000 });
  121 |     await expect(page.locator("text=TEST002")).toBeVisible();
  122 |     await expect(page.locator("text=Pago")).toBeVisible();
  123 |   });
  124 | 
  125 |   test("should show error for non-existent plate", async ({ page }) => {
```