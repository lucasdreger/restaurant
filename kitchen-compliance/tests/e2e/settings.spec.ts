import { test, expect } from '@playwright/test';

test.describe('Settings Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        // Auth bypass/login
        await page.evaluate(() => {
            const state = {
                state: {
                    isDemo: true,
                    currentSite: { id: 'demo-site-id', name: 'Luma Executive Kitchen' },
                    settings: { theme: 'day' }
                },
                version: 0
            };
            localStorage.setItem('kitchen-compliance-storage', JSON.stringify(state));
        });
        await page.click('text=Settings');
    });

    test('should manage Staff Members with codes', async ({ page }) => {
        await page.click('text=Staff Members');

        // Add new staff
        await page.fill('placeholder="Staff Name"', 'Test User');
        await page.fill('placeholder="Code (e.g. 101)"', '888');
        await page.click('button:text("Add")');

        await expect(page.getByText('Test User')).toBeVisible();
        await expect(page.getByText('888')).toBeVisible();
    });

    test('should manage Fridges with codes', async ({ page }) => {
        await page.click('text=Fridges');

        await page.fill('placeholder="New fridge name"', 'Test Cooler');
        await page.fill('placeholder="Code (e.g. 101)"', 'C-1');
        await page.click('button:text("Add")');

        await expect(page.getByText('Test Cooler')).toBeVisible();
        await expect(page.getByText('C-1')).toBeVisible();
    });
});
