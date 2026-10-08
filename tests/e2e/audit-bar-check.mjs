/**
 * Audit rapat 2026-10 §9 (manual check, needs a local LiveKit like
 * tests/e2e/rapat-video-two-users.mjs). Measures the layout defects U-03 / U-09 /
 * U-10 and writes screenshots:
 *   E2E_BASE_URL=https://ruangkerja-audit.test E2E_MEETING=<video meeting by kadiv@demo.test, auto_minutes on> \
 *   E2E_OUT=storage/app/ui-shots/audit-rapatui node tests/e2e/audit-bar-check.mjs
 */
// the floating control bar must never
// cover the bottom of the minutes paper. Joins as kadiv@demo.test with a fake
// camera at 1440 / 834 / 390, scrolls the paper to the end, focuses the
// "Tulis keputusan rapat" field and measures it against the bar.
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL;
const MEETING = process.env.E2E_MEETING;
const OUT = process.env.E2E_OUT;
const browser = await chromium.launch({
    args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--auto-select-desktop-capture-source=Entire screen',
        '--enable-usermedia-screen-capturing',
    ],
});
const results = [];

for (const [width, height, scheme] of [
    [1440, 900, 'light'],
    [834, 1112, 'light'],
    [390, 844, 'light'],
    [1440, 900, 'dark'],
]) {
    const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: scheme,
        ignoreHTTPSErrors: true,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        permissions: ['camera', 'microphone'],
        isMobile: width < 768,
        hasTouch: width < 768,
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page
        .locator('form', {
            has: page.locator('input[name="email"][value="kadiv@demo.test"]'),
        })
        .getByRole('button')
        .click();
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto(`${BASE}/rapat/${MEETING}/gabung`);
    await page.getByTestId('join-now').waitFor({ timeout: 20000 });
    await page.getByTestId('join-now').click();
    await page.waitForURL(/\/ruang/);
    await page
        .locator('[data-testid="participant-tile"][data-local="true"]')
        .first()
        .waitFor({ timeout: 20000 });
    if (width < 768) {
        await page.getByRole('tab', { name: /Notulen/ }).click();
    }
    await page.waitForTimeout(6500); // collab fallback to autosave (no collab server locally)
    const input = page.getByPlaceholder('Tulis keputusan rapat').first();
    await input.waitFor({ timeout: 10000 });
    const tag = `${width}-${scheme}`;
    // Before any scrolling (the reported bug): where is the field relative to the bar?
    await page.evaluate(() =>
        document
            .querySelectorAll('[tabindex="-1"], [role="tabpanel"] > div')
            .forEach((el) => {
                el.scrollTop = 0;
            }),
    );
    await page.waitForTimeout(200);
    const before = await page.evaluate(() => {
        const bar = document
            .querySelector('[role="toolbar"][aria-label="Kontrol rapat"]')
            .getBoundingClientRect();
        const field = document
            .querySelector(
                'input[placeholder="Tulis keputusan rapat"], textarea[placeholder="Tulis keputusan rapat"]',
            )
            .getBoundingClientRect();
        return {
            coveredAtTop:
                field.bottom > bar.top &&
                field.top < bar.bottom &&
                field.right > bar.left &&
                field.left < bar.right,
        };
    });
    await page.screenshot({ path: `${OUT}/ruang-${tag}-top.png` });
    await page.keyboard.press('Escape');
    await input.focus();
    await page.waitForTimeout(400);
    const afterFocusFromTop = await page.evaluate(() => {
        const bar = document
            .querySelector('[role="toolbar"][aria-label="Kontrol rapat"]')
            .getBoundingClientRect();
        const field = document.activeElement.getBoundingClientRect();
        return {
            coveredAfterFocus:
                field.bottom > bar.top &&
                field.top < bar.bottom &&
                field.right > bar.left &&
                field.left < bar.right,
            gap: Math.round(bar.top - field.bottom),
        };
    });
    await page.screenshot({ path: `${OUT}/ruang-${tag}-top-focus.png` });
    await input.blur();
    // Scrolled to the very end (worst case for the bar).
    await page.evaluate(() =>
        document
            .querySelectorAll('[tabindex="-1"], [role="tabpanel"] > div')
            .forEach((el) => {
                el.scrollTop = el.scrollHeight;
            }),
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${OUT}/ruang-${tag}-end.png` });
    await input.focus();
    await page.waitForTimeout(400);
    const geometry = await page.evaluate(() => {
        const bar = document
            .querySelector('[role="toolbar"][aria-label="Kontrol rapat"]')
            .getBoundingClientRect();
        const field = document.activeElement.getBoundingClientRect();
        const button = [...document.querySelectorAll('button')]
            .find((b) => b.textContent.trim().endsWith('Keputusan'))
            ?.getBoundingClientRect();
        const overlaps = (r) =>
            r &&
            r.bottom > bar.top &&
            r.top < bar.bottom &&
            r.right > bar.left &&
            r.left < bar.right;
        return {
            barTop: Math.round(bar.top),
            fieldBottom: Math.round(field.bottom),
            fieldCovered: overlaps(field),
            addButtonCovered: overlaps(button),
        };
    });
    await page.screenshot({ path: `${OUT}/ruang-${tag}-focus.png` });
    let presentasi = null;
    if (width === 1440 && scheme === 'light') {
        try {
            await page
                .getByRole('button', { name: /Bagikan layar|Presentasi/ })
                .first()
                .click({ timeout: 3000 });
            await page.waitForTimeout(3000);
            await page.evaluate(() =>
                document.querySelectorAll('[tabindex="-1"]').forEach((el) => {
                    el.scrollTop = el.scrollHeight;
                }),
            );
            await input.focus();
            await page.waitForTimeout(400);
            presentasi = await page.evaluate(() => {
                const bar = document
                    .querySelector(
                        '[role="toolbar"][aria-label="Kontrol rapat"]',
                    )
                    .getBoundingClientRect();
                const field = document.activeElement.getBoundingClientRect();
                return {
                    covered:
                        field.bottom > bar.top &&
                        field.top < bar.bottom &&
                        field.right > bar.left &&
                        field.left < bar.right,
                    sharing: !!document.querySelector(
                        'video[data-source="screen_share"], [data-testid="screen-share"]',
                    ),
                };
            });
            await page.screenshot({
                path: `${OUT}/presentasi-1440-light-focus.png`,
            });
        } catch (e) {
            presentasi = { error: String(e).slice(0, 160) };
        }
    }
    results.push({
        tag,
        ...before,
        ...afterFocusFromTop,
        ...geometry,
        presentasi,
        errors: errors.slice(0, 3),
    });
    await context.close();
}
console.log(JSON.stringify(results, null, 1));
await browser.close();
