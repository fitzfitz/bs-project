import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';

test.describe('Loyalty Dashboard Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
  });

  test('full loyalty flow: login, loyalty page, home, profile', async ({
    page,
  }) => {
    // Step 1: Login page loads
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

    // Step 2: Login with customer credentials
    await page.getByLabel(/email/i).fill('customer1@gmail.com');
    await page.getByLabel(/password/i).fill('Password123!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for redirect after login (to home or loyalty)
    await page.waitForURL(/\/(loyalty|$|\?)/, { timeout: 10000 });

    // Step 3: Navigate to loyalty page
    await page.goto(`${BASE_URL}/loyalty`);
    await page.waitForLoadState('networkidle');

    // Verify loyalty dashboard elements
    // - Loyalty card with tier (BRONZE) and points (150 pts)
    await expect(page.getByText(/BRONZE/i)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/150/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/pts/i)).toBeVisible();

    // - Tier progress bar
    await expect(page.getByText(/tier progress/i)).toBeVisible();

    // - Points history section (may be empty or show "No transactions yet")
    await expect(page.getByText(/Points History|No transactions yet/i)).toBeVisible({ timeout: 5000 });

    // - Referral section with code RIZ8236
    await expect(page.getByText(/RIZ8236/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Refer a Friend')).toBeVisible();

    // Step 4: Home page - loyalty card in header (clickable, navigates to /loyalty)
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Loyalty card shows tier and points - verify visible
    await expect(page.getByText(/BRONZE|Member|pts/i)).toBeVisible({ timeout: 5000 });
    // Click the loyalty card button in header - it navigates to /loyalty
    await page.locator('header button').filter({ hasText: /points|status|member|BRONZE/i }).first().click();
    await expect(page).toHaveURL(/\/loyalty/);

    // Step 5: Profile page - loyalty points card
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(/pts|points/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/tier|member/i).first()).toBeVisible();
  });
});
