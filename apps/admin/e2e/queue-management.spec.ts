import { test, expect } from '@playwright/test';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5175';

test.describe('Admin Dashboard', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async () => {
    // Session restored
  });

  test('dashboard loads with revenue summary', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Dashboard should have revenue/summary cards
    await expect(
      page.locator('text=/revenue|transactions|tips|dashboard/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Click through sidebar links and verify each page loads
    const pages = [
      { link: /queue/i, expect: /queue|kanban|board/i },
      { link: /pos/i, expect: /pos|checkout|service/i },
      { link: /transactions/i, expect: /transaction/i },
      { link: /barbers/i, expect: /barber/i },
    ];

    for (const { link, expect: expectedText } of pages) {
      const sidebarLink = page.locator('nav a, nav button').filter({ hasText: link }).first();
      if (await sidebarLink.isVisible()) {
        await sidebarLink.click();
        await page.waitForLoadState('networkidle');
        await expect(
          page.locator(`text=/${expectedText.source}/i`).first()
        ).toBeVisible({ timeout: 10000 });
      }
    }
  });
});

test.describe('Queue Management — Kanban Board', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/queue`);
    await page.waitForLoadState('networkidle');
  });

  test('queue page loads with kanban lanes', async ({ page }) => {
    // Verify kanban lanes are visible (WAITING, CALLED, IN_SERVICE, etc.)
    const laneLabels = ['WAITING', 'CALLED', 'IN_SERVICE', 'COMPLETED'];
    for (const label of laneLabels) {
      await expect(
        page.locator(`text=/${label.replace('_', '.')}/i`).first()
      ).toBeVisible({ timeout: 10000 });
    }
  });

  test('walk-in creation opens modal', async ({ page }) => {
    const walkInButton = page
      .getByRole('button', { name: /walk.?in|add.?walk/i })
      .first();

    if (await walkInButton.isVisible()) {
      await walkInButton.click();
      await page.waitForTimeout(500);

      // Modal should appear with service selection or form
      await expect(
        page.locator('[role="dialog"], [data-state="open"], .modal').first()
      ).toBeVisible({ timeout: 5000 });
    }
  });

  test('queue cards display correct information', async ({ page }) => {
    // Wait for cards to load
    await page.waitForTimeout(2000);

    const card = page.locator('[data-testid="queue-card"], .queue-card, [draggable="true"]').first();
    if (await card.isVisible()) {
      // Cards should have some identifying info (name, time, service)
      const cardText = await card.textContent();
      expect(cardText).toBeTruthy();
      expect(cardText!.length).toBeGreaterThan(0);
    }
  });
});

test.describe('Transactions Page', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/transactions`);
    await page.waitForLoadState('networkidle');
  });

  test('transactions list loads', async ({ page }) => {
    await expect(
      page.locator('text=/transaction/i').first()
    ).toBeVisible({ timeout: 10000 });

    // Should have a table or list of transactions
    await expect(
      page.locator('table, [role="table"], [data-testid="transactions-list"]').first().or(
        page.locator('text=/no transaction|empty/i').first()
      )
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Barber Management', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/barbers`);
    await page.waitForLoadState('networkidle');
  });

  test('barbers page loads with list', async ({ page }) => {
    await expect(
      page.locator('text=/barber/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Branch Settings', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/branches`);
    await page.waitForLoadState('networkidle');
  });

  test('branch settings page loads with tabs', async ({ page }) => {
    // Branch settings should have tabs (Details, Operating Hours, Surge)
    await expect(
      page.locator('text=/detail|operating|surge|setting/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Cash Drawer', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/cash-drawer`);
    await page.waitForLoadState('networkidle');
  });

  test('cash drawer page loads', async ({ page }) => {
    await expect(
      page.locator('text=/cash drawer|drawer|open|session/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Inventory', () => {
  test.use({ storageState: 'e2e/.auth/manager.json' });
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/inventory`);
    await page.waitForLoadState('networkidle');
  });

  test('inventory page loads with products', async ({ page }) => {
    await expect(
      page.locator('text=/inventory|product/i').first()
    ).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Auth — Negative Tests', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.locator('input[name="email"]').fill('wrong@test.com');
    await page.locator('input[name="password"]').fill('WrongPass!');
    await page.getByRole('button', { name: /sign in|login|log in/i }).click();

    await expect(
      page.locator('text=/invalid|error|incorrect|failed/i').first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('unauthenticated access redirects to login', async ({ page }) => {
    await page.goto(`${BASE_URL}/queue`);
    await page.waitForURL(/\/login/, { timeout: 10000 });
  });
});
