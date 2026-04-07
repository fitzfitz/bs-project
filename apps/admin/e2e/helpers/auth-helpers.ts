import { type Page } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

/**
 * Common helper to login as a specific role
 */
async function login(page: Page, email: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: /sign in|login|log in/i }).click();

  // FIX: Use a regex that allows for the full URL or use a callback to check the pathname
  // This avoids the "TimeoutError" caused by anchored regexes like ^/$
  await page.waitForURL((url) => {
    return url.pathname === '/' || url.pathname.includes('dashboard') || url.pathname.includes('queue');
  }, { timeout: 15000 });
}

export async function loginAsSuperAdmin(page: Page) {
  await login(page, 'owner@barber.com', 'Password123!');
}

export async function loginAsManager(page: Page) {
  await login(page, 'manager@barber.com', 'Password123!');
}
