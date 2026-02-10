import { test, expect } from '@playwright/test';

test.describe('Goods Receipt Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to app and bypass auth if needed (mocking localstorage)
        await page.goto('/');
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
        // Navigate to Goods Receipt screen
        // Note: Assuming there is a button/card on dashboard
        await page.click('text=Goods Receipt');
    });

    test('should show Take Photo and Upload buttons', async ({ page }) => {
        await expect(page.getByText('Take Photo')).toBeVisible();
        await expect(page.getByText('Upload Files')).toBeVisible();
    });

    test('should navigate back to dashboard', async ({ page }) => {
        await page.click('button:has-text("Back")'); // Mobile back
        // or check for onBack trigger
        await expect(page.getByText('Kitchen Compliance')).toBeVisible();
    });
});
