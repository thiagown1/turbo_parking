# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> Dashboard - Logout >> should logout and redirect to login
- Location: e2e/dashboard.spec.ts:190:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('text=Sair')
    - locator resolved to <button class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--foreground))] transition-colors">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
  - element was detached from the DOM, retrying
    - locator resolved to <button class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[hsl(var(--sidebar-foreground))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--foreground))] transition-colors">…</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
    - retrying click action
      - waiting 100ms
    49 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <nextjs-portal></nextjs-portal> from <script data-nextjs-dev-overlay="true">…</script> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e6] [cursor=pointer]:
    - button "Open Next.js Dev Tools" [ref=e7]:
      - img [ref=e8]
    - generic [ref=e11]:
      - button "Open issues overlay" [ref=e12]:
        - generic [ref=e13]:
          - generic [ref=e14]: "0"
          - generic [ref=e15]: "1"
        - generic [ref=e16]: Issue
      - button "Collapse issues badge" [ref=e17]:
        - img [ref=e18]
  - generic [ref=e20]:
    - complementary [ref=e21]:
      - generic [ref=e22]:
        - img [ref=e24]
        - generic [ref=e27]: Turbo Parking
      - navigation [ref=e28]:
        - link "Overview" [ref=e29] [cursor=pointer]:
          - /url: /dashboard
          - img [ref=e30]
          - text: Overview
        - link "Tickets" [ref=e35] [cursor=pointer]:
          - /url: /dashboard/tickets
          - img [ref=e36]
          - text: Tickets
        - link "QR Scan" [ref=e38] [cursor=pointer]:
          - /url: /dashboard/scan
          - img [ref=e39]
          - text: QR Scan
        - link "Histórico" [ref=e45] [cursor=pointer]:
          - /url: /dashboard/history
          - img [ref=e46]
          - text: Histórico
        - link "Configurações" [ref=e50] [cursor=pointer]:
          - /url: /dashboard/config
          - img [ref=e51]
          - text: Configurações
      - button "Sair" [ref=e55]:
        - img [ref=e56]
        - text: Sair
    - generic [ref=e59]:
      - banner [ref=e60]:
        - heading "Overview" [level=1] [ref=e62]
        - generic [ref=e63]:
          - generic [ref=e64]: Admin
          - generic [ref=e65]: A
      - main [ref=e66]:
        - generic [ref=e67]:
          - generic [ref=e68]:
            - generic [ref=e69]:
              - generic [ref=e70]:
                - generic [ref=e71]: Veículos no Pátio
                - img [ref=e72]
              - generic [ref=e76]:
                - generic [ref=e77]: "42"
                - generic [ref=e78]: +12%
            - generic [ref=e79]:
              - generic [ref=e80]:
                - generic [ref=e81]: Validados (EV)
                - img [ref=e82]
              - generic [ref=e85]:
                - generic [ref=e86]: "18"
                - generic [ref=e87]: +8%
            - generic [ref=e88]:
              - generic [ref=e89]:
                - generic [ref=e90]: Pendentes
                - img [ref=e91]
              - generic [ref=e94]:
                - generic [ref=e95]: "24"
                - generic [ref=e96]: "-2"
            - generic [ref=e97]:
              - generic [ref=e98]:
                - generic [ref=e99]: Visitas LPR
                - img [ref=e100]
              - generic [ref=e103]:
                - generic [ref=e104]: "156"
                - generic [ref=e105]: +15%
          - generic [ref=e106]:
            - generic [ref=e107]:
              - generic [ref=e108]:
                - img [ref=e109]
                - heading "Câmera LPR de Entrada" [level=2] [ref=e112]
                - generic [ref=e113]: Ao vivo
              - generic [ref=e116]:
                - img [ref=e117]
                - paragraph [ref=e120]: Integração com câmera de reconhecimento pendente.
            - generic [ref=e121]:
              - generic [ref=e122]:
                - img [ref=e123]
                - heading "Leituras (7 dias)" [level=2] [ref=e125]
              - generic [ref=e126]:
                - generic [ref=e127]:
                  - generic [ref=e128]: "120"
                  - generic [ref=e130]: Seg
                - generic [ref=e131]:
                  - generic [ref=e132]: "145"
                  - generic [ref=e134]: Ter
                - generic [ref=e135]:
                  - generic [ref=e136]: "130"
                  - generic [ref=e138]: Qua
                - generic [ref=e139]:
                  - generic [ref=e140]: "156"
                  - generic [ref=e142]: Qui
                - generic [ref=e143]:
                  - generic [ref=e144]: "198"
                  - generic [ref=e146]: Sex
                - generic [ref=e147]:
                  - generic [ref=e148]: "210"
                  - generic [ref=e150]: Sáb
                - generic [ref=e151]:
                  - generic [ref=e152]: "180"
                  - generic [ref=e154]: Dom
          - generic [ref=e155]:
            - generic [ref=e156]:
              - heading "Atividade Recente" [level=2] [ref=e157]
              - link "Ver todas →" [ref=e158] [cursor=pointer]:
                - /url: /dashboard/tickets
            - table [ref=e160]:
              - rowgroup [ref=e161]:
                - row "Placa Pagamento Entrada Tipo Confiança LPR" [ref=e162]:
                  - columnheader "Placa" [ref=e163]
                  - columnheader "Pagamento" [ref=e164]
                  - columnheader "Entrada" [ref=e165]
                  - columnheader "Tipo" [ref=e166]
                  - columnheader "Confiança LPR" [ref=e167]
              - rowgroup [ref=e168]:
                - row "SGT7D71 Pago 30/04/2026, 19:53 visitante 98.5%" [ref=e169]:
                  - cell "SGT7D71" [ref=e170]:
                    - code [ref=e171]: SGT7D71
                  - cell "Pago" [ref=e172]:
                    - generic [ref=e173]: Pago
                  - cell "30/04/2026, 19:53" [ref=e174]
                  - cell "visitante" [ref=e175]
                  - cell "98.5%" [ref=e176]
                - row "ABC1234 Isento 30/04/2026, 19:08 morador 99.1%" [ref=e177]:
                  - cell "ABC1234" [ref=e178]:
                    - code [ref=e179]: ABC1234
                  - cell "Isento" [ref=e180]:
                    - generic [ref=e181]: Isento
                  - cell "30/04/2026, 19:08" [ref=e182]
                  - cell "morador" [ref=e183]
                  - cell "99.1%" [ref=e184]
                - row "XYZ9876 Pendente 30/04/2026, 17:38 visitante 96.2%" [ref=e185]:
                  - cell "XYZ9876" [ref=e186]:
                    - code [ref=e187]: XYZ9876
                  - cell "Pendente" [ref=e188]:
                    - generic [ref=e189]: Pendente
                  - cell "30/04/2026, 17:38" [ref=e190]
                  - cell "visitante" [ref=e191]
                  - cell "96.2%" [ref=e192]
                - row "DEF5678 Pendente 30/04/2026, 20:08 visitante 95.0%" [ref=e193]:
                  - cell "DEF5678" [ref=e194]:
                    - code [ref=e195]: DEF5678
                  - cell "Pendente" [ref=e196]:
                    - generic [ref=e197]: Pendente
                  - cell "30/04/2026, 20:08" [ref=e198]
                  - cell "visitante" [ref=e199]
                  - cell "95.0%" [ref=e200]
  - alert [ref=e201]
```

# Test source

```ts
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
> 195 |     await page.click("text=Sair");
      |                ^ Error: page.click: Test timeout of 30000ms exceeded.
  196 | 
  197 |     // Should redirect to login — use waitForURL for navigation
  198 |     await page.waitForURL("**/auth/login**", { timeout: 15000 });
  199 |     await expect(page).toHaveURL(/\/auth\/login/);
  200 |   });
  201 | });
  202 | 
```