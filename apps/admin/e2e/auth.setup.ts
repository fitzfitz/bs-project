import { test as setup } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_DIR = path.join(__dirname, '.auth');

setup('authenticate as Super Admin', async ({ page }) => {
  const email = 'owner@barber.com';
  const password = 'Password123!';
  const storagePath = path.join(AUTH_DIR, 'user.json');

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|login|log in/i }).click();

  await page.waitForURL((url) => {
    return url.pathname === '/' || url.pathname.includes('dashboard') || url.pathname.includes('queue');
  }, { timeout: 15000 });

  await page.context().storageState({ path: storagePath });
});

setup('authenticate as Manager', async ({ page }) => {
  const email = 'manager@barber.com';
  const password = 'Password123!';
  const storagePath = path.join(AUTH_DIR, 'manager.json');

  await page.goto('/login');
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|login|log in/i }).click();

  await page.waitForURL((url) => {
    return url.pathname === '/' || url.pathname.includes('dashboard') || url.pathname.includes('queue');
  }, { timeout: 15000 });

  await page.context().storageState({ path: storagePath });
});
