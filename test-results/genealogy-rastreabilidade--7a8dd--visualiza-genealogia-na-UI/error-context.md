# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: genealogy.spec.js >> rastreabilidade: cria producao via seed e visualiza genealogia na UI
- Location: e2e\genealogy.spec.js:6:1

# Error details

```
Error: Command failed: node scripts/e2e_create_user_seed_and_output.mjs
Error: failed to create admin user: 401 {"message":"Invalid API key","hint":"Double check your Supabase `anon` or `service_role` API key."}
    at createAdminUser (file:///C:/BECA%202/scripts/e2e_create_user_seed_and_output.mjs:47:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async main (file:///C:/BECA%202/scripts/e2e_create_user_seed_and_output.mjs:71:16)
Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file src\win\async.c, line 76

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - navigation [ref=e3]:
    - generic [ref=e4]:
      - img "Brand Logo" [ref=e6]
      - link "dashboard" [ref=e7] [cursor=pointer]:
        - /url: /
        - generic [ref=e8]: dashboard
      - link "bakery_dining" [ref=e9] [cursor=pointer]:
        - /url: /jornada
        - generic [ref=e10]: bakery_dining
      - link "inventory_2" [ref=e11] [cursor=pointer]:
        - /url: /estoque
        - generic [ref=e12]: inventory_2
      - link "oven_gen" [ref=e13] [cursor=pointer]:
        - /url: /fornos
        - generic [ref=e14]: oven_gen
      - link "local_shipping" [ref=e15] [cursor=pointer]:
        - /url: /expedicao
        - generic [ref=e16]: local_shipping
      - link "checklist" [ref=e17] [cursor=pointer]:
        - /url: /inventario
        - generic [ref=e18]: checklist
      - link "assessment" [ref=e19] [cursor=pointer]:
        - /url: /relatorios
        - generic [ref=e20]: assessment
      - link "manage_accounts" [ref=e21] [cursor=pointer]:
        - /url: /acessos
        - generic [ref=e22]: manage_accounts
  - main [ref=e23]:
    - generic [ref=e24]:
      - generic [ref=e25]:
        - generic [ref=e26]: search
        - generic [ref=e27]: Pesquisar lotes de cookies ou cafés...
      - generic [ref=e28]:
        - generic [ref=e29]:
          - generic [ref=e30]: Visão Geral
          - generic [ref=e31] [cursor=pointer]: Fornos em Tempo Real
          - generic [ref=e32] [cursor=pointer]: Logística
        - generic [ref=e33]:
          - generic [ref=e34]: Perfil
          - generic [ref=e35]: admin
        - button "Sair" [ref=e36]
        - img "profile_photo" [ref=e38]
    - generic [ref=e40]:
      - heading "Visão Geral" [level=1] [ref=e41]
      - generic [ref=e42]:
        - generic [ref=e43] [cursor=pointer]:
          - generic [ref=e44]: Vendas do Dia
          - generic [ref=e45]: R$ 34.500,00
        - generic [ref=e46] [cursor=pointer]:
          - generic [ref=e47]: Pedidos Ativos
          - generic [ref=e48]: 2 Unid.
        - generic [ref=e49] [cursor=pointer]:
          - generic [ref=e50]: Itens em Baixo Estoque
          - generic [ref=e51]: "0"
        - generic [ref=e52] [cursor=pointer]:
          - generic [ref=e53]: Fornos Ativos
          - generic [ref=e54]: 1 / 1
      - generic [ref=e55]:
        - generic [ref=e56]:
          - heading "Fluxo de Distribuição (Últimos Pedidos)" [level=2] [ref=e57] [cursor=pointer]
          - generic [ref=e58]:
            - generic [ref=e59]:
              - generic [ref=e62]: Novo Pedido
              - generic [ref=e64] [cursor=pointer]:
                - paragraph [ref=e65]: Biscoitaria Central Ltda
                - paragraph [ref=e66]: 200 Caixa Cookies Choco Premium
            - img [ref=e68]
            - generic [ref=e69]:
              - generic [ref=e72]: Assamento e Embalagem
              - paragraph [ref=e74]: Nenhum em produção
            - img [ref=e76]
            - generic [ref=e77]:
              - generic [ref=e80]: Em Trânsito
              - generic [ref=e82] [cursor=pointer]:
                - generic [ref=e83]:
                  - paragraph [ref=e84]: Supermercado Ideal
                  - paragraph [ref=e85]: Lote liberado
                - generic [ref=e86]: local_shipping
        - generic [ref=e87]:
          - generic [ref=e88] [cursor=pointer]:
            - heading "Saúde dos Equipamentos" [level=2] [ref=e89]
            - generic [ref=e91]:
              - generic [ref=e96]: 75%
              - generic [ref=e97]:
                - paragraph [ref=e99]: Forno Industrial 1
                - paragraph [ref=e100]: Temp. Ideal
            - button "Registros de Manutenção" [ref=e101]
          - generic [ref=e102] [cursor=pointer]:
            - img [ref=e103]
            - generic [ref=e105]:
              - generic [ref=e106]: Resumo Semanal
              - heading "Qualidade dos lotes atingiu recorde de 98.4%" [level=3] [ref=e107]
      - generic [ref=e108]:
        - generic [ref=e110]:
          - heading "Ações Pendentes de Operação" [level=2] [ref=e111]
          - paragraph [ref=e112]: Alertas automáticos para decisão rápida
        - button "1 pedido(s) aguardando expedição Abrir módulo" [ref=e115]:
          - paragraph [ref=e116]: 1 pedido(s) aguardando expedição
          - paragraph [ref=e117]: Abrir módulo
      - generic [ref=e118]:
        - generic [ref=e119]:
          - generic [ref=e120]:
            - heading "Últimos Pedidos Cadastrados" [level=2] [ref=e121]
            - paragraph [ref=e122]: Registro de envio em tempo real
          - generic [ref=e123] [cursor=pointer]: Ver Todo o Histórico
        - generic [ref=e124]:
          - generic [ref=e125]:
            - generic [ref=e126]: Cliente
            - generic [ref=e127]: Volume
            - generic [ref=e128]: Status
            - generic [ref=e129]: Ação
          - generic [ref=e130] [cursor=pointer]:
            - generic [ref=e131]:
              - generic [ref=e132]: SU
              - generic [ref=e133]:
                - paragraph [ref=e134]: Supermercado Ideal
                - paragraph [ref=e135]: "ID: ORD-002"
            - generic [ref=e136]:
              - paragraph [ref=e137]: 500 Unid.
              - paragraph [ref=e138]: Caixa Cookies Choco Premium
            - generic [ref=e140]: Em Trânsito
            - generic [ref=e142]: more_horiz
          - generic [ref=e143] [cursor=pointer]:
            - generic [ref=e144]:
              - generic [ref=e145]: BI
              - generic [ref=e146]:
                - paragraph [ref=e147]: Biscoitaria Central Ltda
                - paragraph [ref=e148]: "ID: ORD-001"
            - generic [ref=e149]:
              - paragraph [ref=e150]: 200 Unid.
              - paragraph [ref=e151]: Caixa Cookies Choco Premium
            - generic [ref=e153]: Pendente
            - generic [ref=e155]: more_horiz
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { execSync } from 'child_process';
  3  | 
  4  | const makeEmail = () => `qa+beca-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;
  5  | 
  6  | test('rastreabilidade: cria producao via seed e visualiza genealogia na UI', async ({ page }) => {
  7  |   const email = makeEmail();
  8  |   const password = 'Teste123!';
  9  | 
  10 |   // signup via UI to create a user and tenant/membership
  11 |   await page.goto('/');
  12 |   await page.getByRole('button', { name: 'Não tem conta? Criar acesso' }).click();
  13 |   await page.getByPlaceholder('voce@empresa.com').fill(email);
  14 |   await page.getByPlaceholder('******').fill(password);
  15 |   await page.getByRole('button', { name: 'Criar conta' }).click();
  16 | 
  17 |   // signup may require email confirmation and not create a session immediately.
  18 |   // If no session is present, perform explicit sign-in.
  19 |   try {
  20 |     await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });
  21 |   } catch (err) {
  22 |     // try explicit sign-in flow
  23 |     await page.getByRole('button', { name: 'Já tem conta? Entrar' }).click();
  24 |     await page.getByPlaceholder('voce@empresa.com').fill(email);
  25 |     await page.getByPlaceholder('******').fill(password);
  26 |     await page.getByRole('button', { name: 'Entrar' }).click();
  27 |     await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });
  28 |   }
  29 | 
  30 |   // read supabase auth token from localStorage to obtain user id
  31 |   // grab any localStorage entry that looks like a supabase auth token object
  32 |   const tokenJson = await page.evaluate(() => {
  33 |     const keys = Object.keys(localStorage);
  34 |     for (const k of keys) {
  35 |       try {
  36 |         const v = localStorage.getItem(k);
  37 |         if (!v) continue;
  38 |         const parsed = JSON.parse(v);
  39 |         if (parsed && (parsed.currentSession?.user?.id || parsed.user?.id || parsed.user?.sub)) {
  40 |           return JSON.stringify(parsed);
  41 |         }
  42 |       } catch (e) {
  43 |         // ignore non-json values
  44 |       }
  45 |     }
  46 |     return null;
  47 |   });
  48 |   if (!tokenJson) {
  49 |     const keys = await page.evaluate(() => Object.keys(localStorage));
  50 |     console.log('localStorage keys after signup:', keys);
  51 |   }
  52 |   expect(tokenJson).toBeTruthy();
  53 |   const tokenObj = JSON.parse(tokenJson);
  54 |   const userId = tokenObj?.currentSession?.user?.id || tokenObj?.user?.id || tokenObj?.user?.sub;
  55 |   expect(userId).toBeTruthy();
  56 | 
  57 |   // seed via admin API that returns credentials we can use to sign in
> 58 |   const out = execSync('node scripts/e2e_create_user_seed_and_output.mjs', { encoding: 'utf8' });
     |               ^ Error: Command failed: node scripts/e2e_create_user_seed_and_output.mjs
  59 |   const seeded = JSON.parse(out.trim());
  60 |   const { email: seededEmail, password: seededPassword, producedLot } = seeded;
  61 | 
  62 |   // sign in using produced credentials
  63 |   await page.getByRole('button', { name: 'Já tem conta? Entrar' }).click();
  64 |   await page.getByPlaceholder('voce@empresa.com').fill(seededEmail);
  65 |   await page.getByPlaceholder('******').fill(seededPassword);
  66 |   await page.getByRole('button', { name: 'Entrar' }).click();
  67 |   await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });
  68 |   expect(producedLot).toBeTruthy();
  69 | 
  70 |   // go to relatórios and search by loteId
  71 |   await page.goto('/relatorios');
  72 |   await page.getByPlaceholder('Informe loteId ou orderId').fill(producedLot.lote_id || producedLot.loteId || producedLot.lote_id);
  73 |   await page.getByRole('button', { name: 'Buscar' }).click();
  74 | 
  75 |   // expect genealogy table to show at least one row
  76 |   await expect(page.locator('table').getByText(producedLot.lote_id || producedLot.loteId || producedLot.lote_id)).toBeVisible({ timeout: 10000 });
  77 | });
  78 | 
```