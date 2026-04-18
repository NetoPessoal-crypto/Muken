import { test, expect } from '@playwright/test';

const makeEmail = () => `qa+beca-${Date.now()}-${Math.floor(Math.random() * 100000)}@example.com`;

test('fluxo logistico: checklist operacional renderiza controles', async ({ page }) => {
  const email = makeEmail();
  const password = 'Teste123!';

  await page.goto('/');

  await page.getByRole('button', { name: 'Não tem conta? Criar acesso' }).click();
  await page.getByPlaceholder('voce@empresa.com').fill(email);
  await page.getByPlaceholder('******').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Visão Geral' })).toBeVisible({ timeout: 20000 });

  await page.goto('/jornada');
  await expect(page.getByText('Etapa: pendente').first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole('button', { name: 'Registrar Separação' }).first()).toBeVisible({ timeout: 20000 });
  await expect(page.getByText('Logística e Entrega')).toBeVisible();
  await expect(page.getByText('Concluídos (Mês)')).toBeVisible();
});
