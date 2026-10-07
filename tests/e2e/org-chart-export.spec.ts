import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

/**
 * Struktur organisasi › "Unduh PNG": the button renders (desktop/tablet header,
 * phone app bar menu) and downloads a real PNG named after today's date, in
 * every viewport and color scheme. Staff get 404 on this page, so this spec
 * signs in as a Kepala Divisi itself instead of reusing the shared session:
 *   E2E_BASE_URL=https://ruangkerja-<agen>.test npx playwright test tests/e2e/org-chart-export.spec.ts --workers=2
 */
const email = process.env.E2E_CHART_EMAIL ?? 'kadiv@demo.test';

const IGNORED_ERRORS = [/WebSocket connection to .* failed/, /status of 429\b/];

test.use({ storageState: { cookies: [], origins: [] } });

test('struktur organisasi bisa diunduh sebagai PNG', async ({
    page,
    isMobile,
}) => {
    test.setTimeout(120_000);

    const errors: string[] = [];

    page.on('console', (message) => {
        if (
            message.type() === 'error' &&
            !IGNORED_ERRORS.some((pattern) => pattern.test(message.text()))
        ) {
            errors.push(message.text());
        }
    });
    page.on('pageerror', (error) => errors.push(error.message));

    // Demo login is rate limited and every project signs in: retry on 429.
    for (let attempt = 0; attempt < 6; attempt++) {
        await page.goto('/login');
        await page
            .locator('form', {
                has: page.locator(`input[name="email"][value="${email}"]`),
            })
            .getByRole('button')
            .click();

        try {
            await page.waitForURL('**/dashboard', { timeout: 8000 });
            break;
        } catch {
            await page.waitForTimeout(10_000);
        }
    }

    const response = await page.goto('/organisasi/struktur');
    expect(response?.status()).toBe(200);
    await page.waitForLoadState('networkidle');

    const download = page.waitForEvent('download', { timeout: 60_000 });

    if (isMobile) {
        await page.getByRole('button', { name: 'Aksi lainnya' }).click();
        await page.getByRole('menuitem', { name: /Unduh PNG/ }).click();
    } else {
        const button = page.getByRole('button', { name: 'Unduh PNG' });

        await expect(button).toBeVisible();
        await button.click();
    }

    const file = await download;
    expect(file.suggestedFilename()).toMatch(
        /^struktur-organisasi-\d{4}-\d{2}-\d{2}\.png$/,
    );

    const path = await file.path();
    const png = await readFile(path);

    // PNG signature + IHDR width/height.
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');
    expect(png.readUInt32BE(16)).toBeGreaterThan(1000);
    expect(png.readUInt32BE(20)).toBeGreaterThan(500);

    // The export host is removed again; nothing lingers off-screen.
    await expect(
        page.getByText(
            'Dibuat otomatis dari data divisi, tim, dan atasan langsung di RuangKerja.',
        ),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
});
