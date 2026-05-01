# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard - Scan/Search Page >> should search for a session by plate
- Location: e2e/dashboard.spec.ts:105:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Placa Encontrada')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Placa Encontrada')

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
        - heading "QR Scan" [level=1] [ref=e44]
        - generic [ref=e45]:
          - generic [ref=e46]: Admin
          - generic [ref=e47]: A
      - main [ref=e48]:
        - generic [ref=e49]:
          - generic [ref=e50]:
            - button "QR Code (Guest)" [ref=e51]:
              - img [ref=e52]
              - text: QR Code (Guest)
            - button "Busca de Placa" [ref=e58]:
              - img [ref=e59]
              - text: Busca de Placa
          - generic [ref=e64]:
            - img [ref=e65]
            - generic [ref=e67]:
              - heading "Sessão Não Encontrada" [level=3] [ref=e68]
              - paragraph [ref=e69]: Não há nenhum veículo ativo com essa identificação no pátio.
            - button "Tentar Novamente" [ref=e70]
  - generic [ref=e75] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e76]:
      - img [ref=e77]
    - generic [ref=e80]:
      - button "Open issues overlay" [ref=e81]:
        - generic [ref=e82]:
          - generic [ref=e83]: "0"
          - generic [ref=e84]: "1"
        - generic [ref=e85]: Issue
      - button "Collapse issues badge" [ref=e86]:
        - img [ref=e87]
  - alert [ref=e89]
```

# Test source

```ts
  20  | 
  21  |   test("should login and redirect to dashboard", async ({ page }) => {
  22  |     await login(page);
  23  |     await expect(page).toHaveURL(/\/dashboard/);
  24  |     // Should see the dashboard layout
  25  |     await expect(page.locator("text=Turbo Parking")).toBeVisible();
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
> 120 |     await expect(page.locator("text=Placa Encontrada")).toBeVisible({ timeout: 10000 });
      |                                                         ^ Error: expect(locator).toBeVisible() failed
  121 |     await expect(page.locator("text=TEST002")).toBeVisible();
  122 |     await expect(page.locator("text=Pago")).toBeVisible();
  123 |   });
  124 | 
  125 |   test("should show error for non-existent plate", async ({ page }) => {
  126 |     await page.goto("/dashboard/scan");
  127 |     await page.waitForLoadState("networkidle");
  128 | 
  129 |     // Switch to manual search tab
  130 |     await page.click("text=Busca de Placa");
  131 |     await page.waitForTimeout(500);
  132 | 
  133 |     // Search for non-existent plate
  134 |     await page.fill('input[placeholder*="ABC1234"]', "XXXXXX");
  135 |     await page.click("text=Buscar Placa");
  136 | 
  137 |     // Should show error state
  138 |     await expect(page.locator("text=Não Encontrada")).toBeVisible({ timeout: 10000 });
  139 |   });
  140 | });
  141 | 
  142 | test.describe("Dashboard - Validate Flow", () => {
  143 |   test.beforeEach(async ({ page }) => {
  144 |     // Re-seed test data since previous tests may have modified it
  145 |     const { execSync } = await import("child_process");
  146 |     execSync("node scripts/seed-e2e.js", { stdio: "ignore" });
  147 |     await login(page);
  148 |   });
  149 | 
  150 |   test("should validate a session from scan page", async ({ page }) => {
  151 |     await page.goto("/dashboard/scan");
  152 |     await page.waitForLoadState("networkidle");
  153 | 
  154 |     // Switch to manual search tab
  155 |     await page.click("text=Busca de Placa");
  156 |     await page.waitForTimeout(500);
  157 | 
  158 |     // Search for TEST001 (pending session)
  159 |     await page.fill('input[placeholder*="ABC1234"]', "TEST001");
  160 |     await page.click("text=Buscar Placa");
  161 | 
  162 |     // Wait for the result
  163 |     await expect(page.locator("text=Pendente")).toBeVisible({ timeout: 10000 });
  164 | 
  165 |     // Click validate
  166 |     await page.click("text=Validar Sessão");
  167 | 
  168 |     // Should show success
  169 |     await expect(page.locator("text=Validada")).toBeVisible({ timeout: 10000 });
  170 |   });
  171 | });
  172 | 
  173 | test.describe("Dashboard - Config Page", () => {
  174 |   test.beforeEach(async ({ page }) => {
  175 |     await login(page);
  176 |   });
  177 | 
  178 |   test("should load config page with test mode toggle", async ({ page }) => {
  179 |     await page.goto("/dashboard/config");
  180 | 
  181 |     // Should see the test mode section
  182 |     await expect(page.locator("text=Modo de Teste")).toBeVisible({ timeout: 10000 });
  183 | 
  184 |     // Should see the validation rules section
  185 |     await expect(page.locator("text=Regras de Validação")).toBeVisible();
  186 |   });
  187 | });
  188 | 
  189 | test.describe("Dashboard - Logout", () => {
  190 |   test("should logout and redirect to login", async ({ page }) => {
  191 |     await login(page);
  192 |     await expect(page).toHaveURL(/\/dashboard/);
  193 | 
  194 |     // Click logout in sidebar (desktop viewport)
  195 |     await page.click("text=Sair");
  196 | 
  197 |     // Should redirect to login — use waitForURL for navigation
  198 |     await page.waitForURL("**/auth/login**", { timeout: 15000 });
  199 |     await expect(page).toHaveURL(/\/auth\/login/);
  200 |   });
  201 | });
  202 | 
```