import { expect, test, type Page } from '@playwright/test';

/**
 * Visual smoke: each page renders without console errors (incl. CSP
 * violations), without horizontal scrolling, and matches its baseline
 * screenshot per viewport (375/834/1440) and color scheme (light/dark).
 */
const pages = [
    { name: 'dashboard', path: '/dashboard' },
    { name: 'menu', path: '/menu' },
] as const;

/**
 * Environment noise that is not a page defect: Reverb not running locally, and
 * rate-limited background polling (every project signs in as the same demo user).
 */
const IGNORED_ERRORS = [
    /WebSocket connection to .* failed/,
    // HTTP/2 sends no status text: "status of 429 ()".
    /status of 429\b/,
];

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

    return errors;
}

for (const target of pages) {
    test(`${target.name} tampil rapi`, async ({ page }) => {
        const errors = collectErrors(page);

        // Freeze the browser clock so greetings and relative times are stable.
        await page.clock.setFixedTime(new Date('2026-10-05T09:00:00+07:00'));

        const response = await page.goto(target.path);
        expect(response?.status()).toBe(200);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth,
        );
        expect(overflow, 'halaman tidak boleh menggulir horizontal').toBe(0);

        await expect(page).toHaveScreenshot(`${target.name}.png`, {
            fullPage: true,
        });

        expect(errors, 'console tidak boleh berisi galat').toEqual([]);
    });
}
