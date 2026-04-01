import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';

async function loginAsCustomer(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.getByLabel(/email/i).fill('customer1@gmail.com');
  await page.getByLabel(/password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(/\/(loyalty|book|$|\?)/, { timeout: 10000 });
}

test.describe('Notifications Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
  });

  test('notifications page loads', async ({ page }) => {
    await page.goto(`${BASE_URL}/notifications`);
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=/notification|no notification|inbox/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Branch Discovery', () => {
  test('branch list loads with location data', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/book`);
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=/branch|location|find/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('branch details show services', async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/book`);
    await page.waitForLoadState('networkidle');

    const branchCard = page
      .locator('a[href*="/book/"], button, [data-testid="branch-card"]')
      .first();

    if (await branchCard.isVisible()) {
      await branchCard.click();
      await page.waitForLoadState('networkidle');

      await expect(
        page.locator('text=/service|haircut|shave/i').first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Profile Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');
  });

  test('profile shows user information', async ({ page }) => {
    await expect(
      page.locator('text=/profile|account|customer/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('referral section is visible', async ({ page }) => {
    await expect(
      page.locator('text=/referral|invite|share/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});
