/**
 * Audit rapat 2026-10 §9 (manual check, needs a local LiveKit like
 * tests/e2e/rapat-video-two-users.mjs). Measures the layout defects U-03 / U-09 /
 * U-10 and writes screenshots:
 *   E2E_BASE_URL=https://ruangkerja-audit.test E2E_MEETING=<video meeting by kadiv@demo.test, auto_minutes on> \
 *   E2E_OUT=storage/app/ui-shots/audit-rapatui node tests/e2e/audit-prejoin-shots.mjs
 */
import { chromium } from '@playwright/test';
const BASE = process.env.E2E_BASE_URL,
    M = process.env.E2E_MEETING,
    OUT = process.env.E2E_OUT;
const browser = await chromium.launch({
    args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--allow-running-insecure-content',
        '--auto-select-desktop-capture-source=Entire screen',
    ],
});
const out = [];
async function signedIn(w, h, scheme) {
    const ctx = await browser.newContext({
        viewport: { width: w, height: h },
        colorScheme: scheme,
        ignoreHTTPSErrors: true,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        permissions: ['camera', 'microphone'],
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`);
    await page
        .locator('form', {
            has: page.locator('input[name="email"][value="kadiv@demo.test"]'),
        })
        .getByRole('button')
        .click();
    await page.waitForURL('**/dashboard');
    return { ctx, page };
}
for (const scheme of ['light', 'dark']) {
    const { ctx, page } = await signedIn(1440, 900, scheme);
    for (const [w, h] of [
        [1440, 900],
        [1280, 800],
        [1024, 768],
        [834, 1112],
    ]) {
        await page.setViewportSize({ width: w, height: h });
        await page.goto(`${BASE}/rapat/${M}/gabung`);
        await page.getByTestId('join-now').waitFor();
        await page.waitForTimeout(1500);
        const r = await page.evaluate(() => {
            const label = [...document.querySelectorAll('label, span, p')].find(
                (el) => el.textContent.trim() === 'Jangan transkrip suara saya',
            );
            // The card = the top-level box holding the switch (absolute before, in the notes column after).
            let card = label;
            while (
                card &&
                card.parentElement &&
                !/absolute/.test(card.parentElement.className) &&
                card.parentElement.getAttribute('aria-label') !== 'Notulen'
            )
                card = card.parentElement;
            const c = card?.getBoundingClientRect();
            const notes = document.querySelector(
                'section[aria-label="Notulen"]',
            );
            const others = [...(notes?.children ?? [])]
                .filter((el) => el !== card)
                .map((el) => el.getBoundingClientRect());
            const header = document
                .querySelector('header h1')
                ?.getBoundingClientRect();
            const hit = (a, b) =>
                a &&
                b &&
                a.bottom > b.top + 1 &&
                a.top < b.bottom - 1 &&
                a.right > b.left &&
                a.left < b.right;
            return {
                coversNotesContent: others.some((o) => hit(c, o)),
                coversTitle: hit(c, header),
                cardHeight: c ? Math.round(c.height) : null,
                docW: document.documentElement.scrollWidth,
            };
        });
        out.push({ view: `${w}-${scheme}`, ...r, hScroll: r.docW > w });
        await page.screenshot({
            path: `${OUT}/pra-gabung-${w}-${scheme}.png`,
            fullPage: true,
        });
    }
    await ctx.close();
}
// Presentasi 1440
{
    const { ctx, page } = await signedIn(1440, 900, 'light');
    await page.goto(`${BASE}/rapat/${M}/gabung`);
    await page.getByTestId('join-now').click();
    await page.waitForURL(/\/ruang/);
    await page
        .locator('[data-testid="participant-tile"][data-local="true"]')
        .first()
        .waitFor({ timeout: 20000 });
    await page
        .getByRole('button', { name: /Bagikan layar|Presentasi/ })
        .first()
        .click();
    await page.waitForTimeout(6500);
    const g = await page.evaluate(() => {
        const paper = document
            .querySelector('[tabindex="-1"]')
            .getBoundingClientRect();
        const saved = [...document.querySelectorAll('span,p,div')]
            .find(
                (el) =>
                    el.textContent.trim().startsWith('Disimpan') &&
                    el.children.length === 0,
            )
            ?.getBoundingClientRect();
        return {
            paperRightGap: Math.round(window.innerWidth - paper.right),
            savedRightGap: saved
                ? Math.round(window.innerWidth - saved.right)
                : null,
        };
    });
    out.push({ view: 'presentasi-1440', ...g });
    await page.screenshot({ path: `${OUT}/presentasi-1440-light.png` });
    await ctx.close();
}
console.log(JSON.stringify(out, null, 0));
await browser.close();
