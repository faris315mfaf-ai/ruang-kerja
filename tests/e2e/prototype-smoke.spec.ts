import { expect, test, type Page } from '@playwright/test';

/**
 * Smoke test for the Fase 2 & 3 front-end previews (routes/prototype.php,
 * flag `features.prototype`). No baseline screenshots: every route must answer
 * 200, render its preview banner, stay free of console errors and page errors,
 * and never scroll horizontally — per viewport (375/834/1440) and color scheme.
 *
 * Run with few workers: 49 checks × 6 projects saturate a local Herd PHP pool
 * (static assets then answer 502 and lazy chunks fail to load):
 *   E2E_BASE_URL=https://ruangkerja-proto.test npx playwright test tests/e2e/prototype-smoke.spec.ts --workers=2 --retries=1
 */
const routes = [
    '/pratinjau',
    // F2-1 Obrolan, F2-2 Catatan, F2-3 Rapat & kalender left the preview: real routes
    // (routes/chat.php, routes/notes.php, routes/meetings.php).
    // F2-4 · WhatsApp, automation, Kinerja saya
    '/pengaturan/whatsapp',
    '/otomasi',
    '/otomasi/berulang',
    '/otomasi/template',
    '/kinerja',
    // F3-1, F3-2 · Mobile app
    '/pratinjau/ponsel',
    '/pratinjau/ponsel/masuk',
    '/pratinjau/ponsel/integritas',
    '/pratinjau/ponsel/offline',
    '/pratinjau/ponsel/widget',
    '/pratinjau/ponsel/kunci',
    '/pratinjau/ponsel/aksi-cepat',
    '/absensi/wajah',
    '/pengaturan/perangkat',
    // F3-3 · fingerprint devices (OKR and Dashboard per jabatan are real: /okr, /peran)
    '/admin/mesin-absensi',
] as const;

/** Preview-state switch (?keadaan=) on one route per module. */
const stateRoutes = ['/pengaturan/whatsapp', '/pengaturan/perangkat'] as const;

/**
 * Environment noise that is not a page defect: Reverb not running locally, and
 * rate-limited background polling (every project signs in as the same demo
 * user, so the shell's inbox feed answers 429). HTTP/2 responses carry no
 * status text, hence the loose 429 pattern; any 429 outside the polling
 * endpoints is still reported through the response listener below.
 */
const IGNORED_ERRORS = [/WebSocket connection to .* failed/, /status of 429\b/];
const POLLING = /\/inbox\/feed/;

function collectErrors(page: Page): string[] {
    const errors: string[] = [];

    page.on('console', (message) => {
        const text = message.text();

        if (
            message.type() === 'error' &&
            !IGNORED_ERRORS.some((pattern) => pattern.test(text))
        ) {
            errors.push(text);
        }
    });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => {
        if (response.status() === 429 && !POLLING.test(response.url())) {
            errors.push(`429 ${response.url()}`);
        }
    });

    return errors;
}

async function expectRendered(page: Page, path: string): Promise<void> {
    const response = await page.goto(path);
    expect(response?.status(), `status ${path}`).toBe(200);
    await page.waitForLoadState('networkidle');
    expect(new URL(page.url()).pathname, 'tidak dialihkan ke login').not.toBe(
        '/login',
    );

    // Every preview screen carries the shared prototype banner (the hub at
    // /pratinjau is the index of previews and has its own heading instead).
    const marker =
        path === '/pratinjau'
            ? page.getByRole('heading', { name: 'Fitur berikutnya' })
            : page
                  .getByText(/data contoh, perubahan tidak disimpan/)
                  .filter({ visible: true })
                  .first();
    await expect(marker).toBeVisible();

    const overflow = await page.evaluate(
        () =>
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
    );
    expect(overflow, 'halaman tidak boleh menggulir horizontal').toBe(0);
}

for (const path of routes) {
    test(`pratinjau ${path} tampil tanpa galat`, async ({ page }) => {
        const errors = collectErrors(page);

        await expectRendered(page, path);

        expect(errors, 'console tidak boleh berisi galat').toEqual([]);
    });
}

for (const path of stateRoutes) {
    for (const state of ['memuat', 'kosong', 'galat'] as const) {
        test(`pratinjau ${path}?keadaan=${state} tampil tanpa galat`, async ({
            page,
        }) => {
            const errors = collectErrors(page);

            await expectRendered(page, `${path}?keadaan=${state}`);

            expect(errors, 'console tidak boleh berisi galat').toEqual([]);
        });
    }
}
