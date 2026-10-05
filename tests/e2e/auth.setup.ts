import { expect, test as setup } from '@playwright/test';

/**
 * Signs in once with a local demo account (APP_ENV=local + DEMO_LOGIN_ENABLED=true)
 * and stores the session for every viewport/theme project.
 */
const email = process.env.E2E_DEMO_EMAIL ?? 'anggota@demo.test';

setup('masuk dengan akun demo', async ({ page }) => {
    await page.goto('/login');

    const demoForm = page.locator('form', {
        has: page.locator(`input[name="email"][value="${email}"]`),
    });

    await expect(
        demoForm,
        `Akun demo ${email} tidak tampil: pastikan APP_ENV=local, DEMO_LOGIN_ENABLED=true dan php artisan db:seed sudah dijalankan.`,
    ).toHaveCount(1);

    await demoForm.getByRole('button').click();
    await page.waitForURL('**/dashboard');

    await page.context().storageState({ path: 'test-results/.auth/user.json' });
});
