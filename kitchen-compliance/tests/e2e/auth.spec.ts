import { test, expect } from '@playwright/test';

test.describe('Authentication & Demo Mode', () => {
    test('should allow entering demo mode', async ({ page }) => {
        await page.goto('/');

        // Check if we are at login
        const loginBtn = page.getByRole('button', { name: /Start Demo/i });
        if (await loginBtn.isVisible()) {
            await loginBtn.click();
        }

        // Verify dashboard
        await expect(page.getByText('KITCHEN OPS')).toBeVisible();
        await expect(page.getByText('Luma Executive Kitchen')).toBeVisible();
    });

    test('should persist session on reload', async ({ page }) => {
        await page.goto('/');
        // Setup state
        await page.evaluate(() => {
            const state = {
                state: {
                    isDemo: true,
                    currentSite: { id: 'demo-site-id', name: 'Luma Executive Kitchen' }
                },
                version: 0
            };
            localStorage.setItem('kitchen-compliance-storage', JSON.stringify(state));
        });

        await page.reload();
        await expect(page.getByText('KITCHEN OPS')).toBeVisible();
    });
});
