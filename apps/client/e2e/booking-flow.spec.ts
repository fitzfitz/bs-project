import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5174';

async function loginAsCustomer(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
  await page.getByLabel(/email/i).fill('customer1@gmail.com');
  await page.getByLabel(/password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/(loyalty|book|$|\?)/, { timeout: 10000 });
}

test.describe('Booking Flow — End to End', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page);
  });

  test('full booking flow: branch → services → barber → time → confirm → history', async ({
    page,
  }) => {
    // Step 1: Navigate to branch selection
    await page.goto(`${BASE_URL}/book`);
    await page.waitForLoadState('networkidle');

    // Verify branch list loads
    await expect(
      page.getByRole('heading', { name: /find.*branch|branches|locations/i }).or(
        page.locator('text=Select a Branch').or(page.locator('[data-testid="branch-card"]').first())
      )
    ).toBeVisible({ timeout: 10000 });

    // Step 2: Click on the first available branch
    const branchCard = page
      .locator('a[href*="/book/"], button, [data-testid="branch-card"]')
      .filter({ hasText: /barber|branch|jakarta/i })
      .first();
    await expect(branchCard).toBeVisible({ timeout: 10000 });
    await branchCard.click();

    // Wait for service selection page
    await page.waitForURL(/\/book\/[^/]+$/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Step 3: Service selection — pick at least one service
    const serviceCheckbox = page
      .locator('input[type="checkbox"], [role="checkbox"], button')
      .filter({ hasText: /haircut|shave|cut/i })
      .first();
    const serviceCard = page.locator('label, div, button').filter({ hasText: /haircut/i }).first();

    if (await serviceCheckbox.isVisible()) {
      await serviceCheckbox.click();
    } else if (await serviceCard.isVisible()) {
      await serviceCard.click();
    }

    // Click next/continue to go to barber selection
    const nextButton = page
      .getByRole('button', { name: /next|continue|select barber/i })
      .first();
    await expect(nextButton).toBeVisible({ timeout: 5000 });
    await nextButton.click();

    // Step 4: Barber selection — wait for barber cards to load
    await page.waitForURL(/\/barber/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Pick first available barber or "Any Available"
    const anyBarberOption = page
      .locator('button, div, label')
      .filter({ hasText: /any.*available|any barber/i })
      .first();
    const specificBarber = page
      .locator('button, div, label, [data-testid="barber-card"]')
      .filter({ hasText: /barber|budi|master|senior/i })
      .first();

    if (await anyBarberOption.isVisible()) {
      await anyBarberOption.click();
    } else if (await specificBarber.isVisible()) {
      await specificBarber.click();
    }

    const toTimeButton = page
      .getByRole('button', { name: /next|continue|pick time|select time/i })
      .first();
    await expect(toTimeButton).toBeVisible({ timeout: 5000 });
    await toTimeButton.click();

    // Step 5: Time selection — pick an available slot
    await page.waitForURL(/\/time/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Wait for time slots to render (they may take a moment to load from API)
    const timeSlot = page.locator('button').filter({ hasText: /\d{1,2}:\d{2}/ }).first();
    await expect(timeSlot).toBeVisible({ timeout: 15000 });
    await timeSlot.click();

    const toConfirmButton = page
      .getByRole('button', { name: /next|continue|confirm|review/i })
      .first();
    await expect(toConfirmButton).toBeVisible({ timeout: 5000 });
    await toConfirmButton.click();

    // Step 6: Confirm booking
    await page.waitForURL(/\/confirm/, { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Verify booking summary is shown
    await expect(
      page.locator('text=/haircut|shave/i').first()
    ).toBeVisible({ timeout: 5000 });

    const confirmButton = page
      .getByRole('button', { name: /confirm|book now|place booking/i })
      .first();
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    // Step 7: Verify success — should redirect to history or show success
    await page.waitForTimeout(3000);
    const currentUrl = page.url();
    const successMessage = page.locator('text=/success|booked|confirmed/i').first();
    const isOnHistory = currentUrl.includes('/history');

    expect(
      isOnHistory || (await successMessage.isVisible().catch(() => false))
    ).toBeTruthy();
  });

  test('booking history shows upcoming bookings', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);
    await page.waitForLoadState('networkidle');

    // Verify history page loads with tabs
    const upcomingTab = page
      .locator('button, [role="tab"]')
      .filter({ hasText: /upcoming/i })
      .first();
    await expect(upcomingTab).toBeVisible({ timeout: 10000 });
  });

  test('profile page shows loyalty info', async ({ page }) => {
    await page.goto(`${BASE_URL}/profile`);
    await page.waitForLoadState('networkidle');

    // Verify profile elements
    await expect(
      page.locator('text=/customer|member|profile/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Auth Flow — Negative Tests', () => {
  test('invalid login shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.getByLabel(/email/i).fill('nonexistent@test.com');
    await page.getByLabel(/password/i).fill('WrongPassword!');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show an error message
    await expect(
      page.locator('text=/invalid|incorrect|error|failed/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('protected routes redirect to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/history`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
