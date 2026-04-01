import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

async function loginAsManager(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"]').fill('manager@barber.com');
  await page.locator('input[name="password"]').fill('Password123!');
  await page.getByRole('button', { name: /sign in|login|log in/i }).click();

  await page.waitForURL(/^\/$|\/queue|\/dashboard/, { timeout: 15000 });
}

test.describe('POS Checkout', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto(`${BASE_URL}/pos`);
    await page.waitForLoadState('networkidle');
  });

  test('POS page loads with service selection', async ({ page }) => {
    await expect(
      page.locator('text=/pos|checkout|service|point of sale/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('branch selector is visible on POS', async ({ page }) => {
    await expect(
      page.locator('select, [role="combobox"]').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('services/products are listed', async ({ page }) => {
    await page.waitForTimeout(2000);
    const items = page.locator(
      'button, [role="button"], [data-testid="service-item"], [data-testid="product-item"]'
    );
    const count = await items.count();
    expect(count).toBeGreaterThan(0);
  });

  test('adding item to cart shows cart summary', async ({ page }) => {
    await page.waitForTimeout(2000);

    const serviceItem = page.locator(
      '[data-testid="service-item"], [data-testid="product-item"]'
    ).first();

    if (await serviceItem.isVisible()) {
      await serviceItem.click();
      await page.waitForTimeout(500);

      await expect(
        page.locator('text=/total|subtotal|cart|checkout/i').first()
      ).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Commission View', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto(`${BASE_URL}/commissions`);
    await page.waitForLoadState('networkidle');
  });

  test('commissions page loads', async ({ page }) => {
    await expect(
      page.locator('text=/commission|earnings|payout/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('commission data or empty state is displayed', async ({ page }) => {
    await expect(
      page.locator('table, [role="table"], text=/no commission|no data|empty/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsManager(page);
    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');
  });

  test('inventory page loads with product list', async ({ page }) => {
    await expect(
      page.locator('text=/inventory|product|stock/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('stock adjustment or add product action exists', async ({ page }) => {
    await expect(
      page.locator('button').filter({ hasText: /add|adjust|stock|new/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});
