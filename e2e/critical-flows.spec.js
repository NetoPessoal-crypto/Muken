import { test, expect } from '@playwright/test';

test('renderiza tela de autenticacao quando nao logado', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Entrar no BECA')).toBeVisible();
});

test('navega para criacao de conta', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Não tem conta? Criar acesso' }).click();
  await expect(page.getByRole('button', { name: 'Criar conta' })).toBeVisible();
});

test('campos obrigatorios do login estao visiveis', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder('voce@empresa.com')).toBeVisible();
  await expect(page.getByPlaceholder('******')).toBeVisible();
});
