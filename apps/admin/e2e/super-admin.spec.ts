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

test.describe('Super Admin — Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
  });

  test('sidebar shows Super Admin section', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    await expect(
      page.locator('text=/super admin/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('super admin nav items are visible', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const navItems = ['Analytics', 'Reports', 'User Management', 'Audit Log', 'Finance', 'Settings'];
    for (const label of navItems) {
      await expect(
        page.locator('nav').locator(`text=${label}`).first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('all super admin routes load', async ({ page }) => {
    const routes = [
      { path: '/analytics', expect: /analytics|overview|comparison/i },
      { path: '/reports', expect: /report|generate|export/i },
      { path: '/users', expect: /user|management|staff/i },
      { path: '/audit', expect: /audit|log|anomal/i },
      { path: '/finance', expect: /finance|p&l|revenue|profit/i },
      { path: '/config', expect: /config|settings|platform/i },
    ];

    for (const { path, expect: pattern } of routes) {
      await page.goto(`${BASE_URL}${path}`);
      await page.waitForLoadState('networkidle');
      await expect(
        page.locator(`text=/${pattern.source}/i`).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Super Admin — User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/users`);
    await page.waitForLoadState('networkidle');
  });

  test('user table loads with data', async ({ page }) => {
    await expect(
      page.locator('table, [role="table"]').first().or(
        page.locator('text=/no users|empty/i').first()
      )
    ).toBeVisible({ timeout: 10000 });
  });

  test('search filter works', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="earch"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('admin');
      await page.waitForTimeout(1000);
      await expect(page.locator('table tbody tr, [role="row"]').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('role filter works', async ({ page }) => {
    const roleSelect = page.locator('select, [role="combobox"]').filter({ hasText: /role|all/i }).first();
    if (await roleSelect.isVisible()) {
      await roleSelect.click();
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Super Admin — Audit Log', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/audit`);
    await page.waitForLoadState('networkidle');
  });

  test('audit log tab shows log entries', async ({ page }) => {
    await expect(
      page.locator('text=/audit log|action|entity/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('anomaly tab shows anomaly dashboard', async ({ page }) => {
    const anomalyTab = page.locator('button, [role="tab"]').filter({ hasText: /anomal/i }).first();
    if (await anomalyTab.isVisible()) {
      await anomalyTab.click();
      await page.waitForLoadState('networkidle');
      await expect(
        page.locator('text=/anomal|severity|resolve/i').first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Super Admin — Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/analytics`);
    await page.waitForLoadState('networkidle');
  });

  test('analytics page loads with tabs', async ({ page }) => {
    await expect(
      page.locator('text=/overview|comparison|peak|retention/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('overview tab shows branch cards', async ({ page }) => {
    await expect(
      page.locator('text=/revenue|transaction|branch/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('comparison tab renders chart', async ({ page }) => {
    const compTab = page.locator('button, [role="tab"]').filter({ hasText: /comparison/i }).first();
    if (await compTab.isVisible()) {
      await compTab.click();
      await page.waitForTimeout(1000);
      await expect(
        page.locator('text=/comparison|branch|metric/i').first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('heatmap tab renders grid', async ({ page }) => {
    const heatTab = page.locator('button, [role="tab"]').filter({ hasText: /peak|heatmap/i }).first();
    if (await heatTab.isVisible()) {
      await heatTab.click();
      await page.waitForTimeout(1000);
      await expect(
        page.locator('text=/peak|heatmap|hour|monday|sunday/i').first()
      ).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('Super Admin — Reports', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/reports`);
    await page.waitForLoadState('networkidle');
  });

  test('reports page loads with type selector', async ({ page }) => {
    await expect(
      page.locator('text=/report|generate|type/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('generate report shows data', async ({ page }) => {
    const generateBtn = page.getByRole('button', { name: /generate/i }).first();
    if (await generateBtn.isVisible()) {
      await generateBtn.click();
      await page.waitForTimeout(2000);
      await expect(
        page.locator('table, text=/no data|result|row/i').first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('CSV export button exists', async ({ page }) => {
    await expect(
      page.locator('button, a').filter({ hasText: /csv|export|download/i }).first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Super Admin — Finance', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/finance`);
    await page.waitForLoadState('networkidle');
  });

  test('finance page loads with P&L summary', async ({ page }) => {
    await expect(
      page.locator('text=/revenue|profit|cost|p&l|financial/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Super Admin — Platform Config', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSuperAdmin(page);
    await page.goto(`${BASE_URL}/config`);
    await page.waitForLoadState('networkidle');
  });

  test('config page loads with settings form', async ({ page }) => {
    await expect(
      page.locator('text=/config|settings|loyalty|tax/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('config has editable fields', async ({ page }) => {
    const inputs = page.locator('input[type="text"], input[type="number"]');
    await expect(inputs.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Super Admin — RBAC Enforcement', () => {
  test('non-super-admin cannot see super admin nav items', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.locator('input[name="email"]').fill('manager@barber.com');
    await page.locator('input[name="password"]').fill('Password123!');
    await page.getByRole('button', { name: /sign in|login|log in/i }).click();
    await page.waitForURL(/^\/$|\/dashboard/, { timeout: 15000 });

    await expect(
      page.locator('nav').locator('text=/super admin/i')
    ).not.toBeVisible({ timeout: 5000 });
  });
});
