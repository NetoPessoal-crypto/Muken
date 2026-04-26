import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const makeEmail = () => `qa+beca-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;

test('rastreabilidade: cria producao via seed e visualiza genealogia na UI', async ({ page }) => {
  const email = makeEmail();
  const password = 'Teste123!';

  // signup via UI to create a user and tenant/membership
  await page.goto('/');
  await page.getByRole('button', { name: 'Não tem conta? Criar acesso' }).click();
  await page.getByPlaceholder('voce@empresa.com').fill(email);
  await page.getByPlaceholder('******').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  // signup may require email confirmation and not create a session immediately.
  // If no session is present, perform explicit sign-in.
  try {
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });
  } catch (err) {
    // try explicit sign-in flow
    await page.getByRole('button', { name: 'Já tem conta? Entrar' }).click();
    await page.getByPlaceholder('voce@empresa.com').fill(email);
    await page.getByPlaceholder('******').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });
  }

  // read supabase auth token from localStorage to obtain user id
  // grab any localStorage entry that looks like a supabase auth token object
  const tokenJson = await page.evaluate(() => {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      try {
        const v = localStorage.getItem(k);
        if (!v) continue;
        const parsed = JSON.parse(v);
        if (parsed && (parsed.currentSession?.user?.id || parsed.user?.id || parsed.user?.sub)) {
          return JSON.stringify(parsed);
        }
      } catch (e) {
        // ignore non-json values
      }
    }
    return null;
  });
  if (!tokenJson) {
    const keys = await page.evaluate(() => Object.keys(localStorage));
    console.log('localStorage keys after signup:', keys);
  }
  expect(tokenJson).toBeTruthy();
  const tokenObj = JSON.parse(tokenJson);
  const userId = tokenObj?.currentSession?.user?.id || tokenObj?.user?.id || tokenObj?.user?.sub;
  expect(userId).toBeTruthy();

  // seed via admin API that returns credentials we can use to sign in
  const out = execSync('node scripts/e2e_create_user_seed_and_output.mjs', { encoding: 'utf8' });
  const seeded = JSON.parse(out.trim());
  const { email: seededEmail, password: seededPassword, producedLot } = seeded;

  // sign in using produced credentials
  await page.getByRole('button', { name: 'Já tem conta? Entrar' }).click();
  await page.getByPlaceholder('voce@empresa.com').fill(seededEmail);
  await page.getByPlaceholder('******').fill(seededPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });
  expect(producedLot).toBeTruthy();

  // go to relatórios and search by loteId
  await page.goto('/relatorios');
  await page.getByPlaceholder('Informe loteId ou orderId').fill(producedLot.lote_id || producedLot.loteId || producedLot.lote_id);
  await page.getByRole('button', { name: 'Buscar' }).click();

  // expect genealogy table to show at least one row
  await expect(page.locator('table').getByText(producedLot.lote_id || producedLot.loteId || producedLot.lote_id)).toBeVisible({ timeout: 10000 });
});
