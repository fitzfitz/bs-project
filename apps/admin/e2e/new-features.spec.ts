import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

async function loginAsSuperAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"]').fill('owner@barber.com');
  await page.locator('input[name="password"]').fill('Password123!');
  await page.getByRole('button', { name: /sign in|login|log in/i }).click();

  await page.waitForURL(/^\/$|\/dashboard/, { timeout: 15000 });
}

test.describe('Notification Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('networkidle');
  });

  test('notifications page loads with stats', async ({ page }) => {
    await expect(
      page.locator('text=/notification management|total sent|unread/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('test send button is visible', async ({ page }) => {
    await expect(
      page.locator('button').filter({ hasText: /test send/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('type filter dropdown exists', async ({ page }) => {
    await expect(
      page.locator('select').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('notification table renders', async ({ page }) => {
    await expect(
      page.locator('table, text=/no notification|loading/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Retention Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/retention`);
    await page.waitForLoadState('networkidle');
  });

  test('retention page loads with stats', async ({ page }) => {
    await expect(
      page.locator('text=/retention management|total nudges|last 30 days/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('manual trigger button exists', async ({ page }) => {
    await expect(
      page.locator('button').filter({ hasText: /run retention triggers/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('trigger policy info is displayed', async ({ page }) => {
    await expect(
      page.locator('text=/at-risk window|30-60 days/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dashboard Charts', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
  });

  test('dashboard loads with chart controls', async ({ page }) => {
    await expect(
      page.locator('text=/revenue trend|payment methods/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('trend period toggle buttons exist', async ({ page }) => {
    await expect(
      page.locator('button').filter({ hasText: '7d' }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Login Flow', () => {
  test('successful login redirects to dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"]').fill('owner@barber.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.getByRole('button', { name: /sign in|login|log in/i }).click();

    await page.waitForURL(/^\/$|\/dashboard/, { timeout: 15000 });
    await expect(
      page.locator('text=/dashboard|revenue/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});
