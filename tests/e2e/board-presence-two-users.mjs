/**
 * Board presence per card (manual, needs Reverb; no queue worker needed —
 * presence and whispers never touch the queue). Two people on /w/PLQ:
 * Rizky opens PLQ-21 → Dimas's card shows his avatar; Rizky types in the
 * description / a comment → "mengetik…" (pencil / speech bubble) next to
 * his avatar on the card, "sedang diedit oleh Rizky" / "Rizky sedang
 * berkomentar" in tooltip and aria-label; Rizky closes it → the avatar goes. Also HR (view only) as a
 * viewer, the mobile list view and Rizky's tab disappearing. Prints
 * latencies in ms (each must stay < 1000) and writes screenshots to E2E_OUT.
 *
 *   E2E_BASE_URL=https://ruangkerja.test node tests/e2e/board-presence-two-users.mjs
 *
 * Run on seeded demo data (php artisan migrate --seed).
 */
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'https://ruangkerja.test';
const OUT = process.env.E2E_OUT ?? 'test-results';
const browser = await chromium.launch({
    args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1'],
});
const results = {};
const errors = [];

async function login(
    name,
    viewport = { width: 1440, height: 900 },
    colorScheme = 'light',
) {
    const context = await browser.newContext({
        viewport,
        colorScheme,
        ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    page.on(
        'console',
        (m) => m.type() === 'error' && errors.push(`[${name}] ${m.text()}`),
    );
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page
        .getByRole('button', { name: new RegExp(`Masuk sebagai ${name}`) })
        .click();
    await page.waitForURL(/dashboard/);

    return { context, page };
}

async function onBoard(page, path = '/w/PLQ') {
    await page.goto(`${BASE}${path}`);
    await page
        .getByText('tersinkron langsung')
        .first()
        .waitFor({ timeout: 10000 });
}

async function timed(label, promise) {
    const t0 = Date.now();
    await promise;
    results[label] = Date.now() - t0;
}

/** Board card or list row of one task (aria-label starts with the key). */
const card = (page, key) =>
    page.locator(`[data-task-id][aria-label^="${key} "]`);

const dimas = await login('Dimas Pratama');
const rizky = await login('Rizky Aditya');
await onBoard(dimas.page);
await onBoard(rizky.page);
results.connected = true;

// 1. Rizky opens PLQ-21 → avatar on Dimas's card.
await rizky.page
    .getByRole('button', { name: /PLQ-21 Landing page produk baru/ })
    .click();
await rizky.page
    .getByRole('dialog')
    .getByText('Properti', { exact: true })
    .waitFor();
await timed(
    'viewerShownMs',
    card(dimas.page, 'PLQ-21')
        .locator('[data-presence="viewers"]')
        .waitFor({ timeout: 5000 }),
);
results.cardLabel = await card(dimas.page, 'PLQ-21').getAttribute('aria-label');
await dimas.page.screenshot({ path: `${OUT}/presence-board-light.png` });

// 2. Typing in the description (cancelled, nothing saved).
const dialog = rizky.page.getByRole('dialog');
await dialog.getByRole('button', { name: 'Ubah deskripsi' }).click();
const description = dialog.getByRole('textbox', { name: 'Deskripsi tugas' });
await description.waitFor();
await description.press('End');
await description.pressSequentially(' uji', { delay: 40 });
await timed(
    'descriptionTypingMs',
    card(dimas.page, 'PLQ-21')
        .locator('[data-presence="typing"][title="sedang diedit oleh Rizky"]')
        .waitFor({ timeout: 5000 }),
);
await card(dimas.page, 'PLQ-21').screenshot({
    path: `${OUT}/presence-card-typing-light.png`,
});
/** The hint is not cut off ("mengetik…" fits next to key, avatar and priority). */
const fits = (locator) =>
    locator
        .locator('[data-presence="typing"] .truncate:visible')
        .evaluate((el) => el.scrollWidth <= el.clientWidth);
results.cardTypingFits = await fits(card(dimas.page, 'PLQ-21'));
await description.press('Escape');

// 3. Typing a comment (not sent).
const comment = dialog.getByRole('textbox', { name: 'Komentar baru' });
await rizky.page.waitForTimeout(2600); // typing whisper throttle
await comment.click();
await comment.pressSequentially('draf', { delay: 40 });
await timed(
    'commentTypingMs',
    card(dimas.page, 'PLQ-21')
        .locator('[data-presence="typing"][title="Rizky sedang berkomentar"]')
        .waitFor({ timeout: 5000 }),
);
await comment.press('ControlOrMeta+a');
await comment.press('Backspace');

// Typing hint fades after ~6 s without keystrokes; the viewer stays.
await timed(
    'typingExpiredMs',
    card(dimas.page, 'PLQ-21')
        .locator('[data-presence="typing"]')
        .waitFor({ state: 'detached', timeout: 10000 }),
);
results.viewerStillShown =
    (await card(dimas.page, 'PLQ-21')
        .locator('[data-presence="viewers"]')
        .count()) === 1;

// 4. Rizky closes the sheet → avatar goes. (First Esc leaves the editor.)
await rizky.page.keyboard.press('Escape');
await rizky.page.keyboard.press('Escape');
await dialog.waitFor({ state: 'detached' });
await timed(
    'viewerHiddenMs',
    card(dimas.page, 'PLQ-21')
        .locator('[data-presence="viewers"]')
        .waitFor({ state: 'detached', timeout: 5000 }),
);

// 5. HR (view only, not a member) opens the full-screen page: shown as a
//    viewer; Rizky on PLQ-15 at the same time → two cards.
const hana = await login('Hana Pratiwi');
await hana.page.goto(`${BASE}/w/PLQ/tasks/21`);
await rizky.page
    .getByRole('button', { name: /PLQ-15 / })
    .first()
    .click();
await timed(
    'hrViewerShownMs',
    card(dimas.page, 'PLQ-21')
        .locator('[data-presence="viewers"]')
        .waitFor({ timeout: 10000 }),
);
await card(dimas.page, 'PLQ-15')
    .locator('[data-presence="viewers"]')
    .waitFor({ timeout: 5000 });
results.hrViewer = await card(dimas.page, 'PLQ-21')
    .locator('[data-presence="viewers"]')
    .getAttribute('title');

// 6. Dark board + mobile list and mobile board (375 px).
const dark = await login('Dimas Pratama', { width: 1440, height: 900 }, 'dark');
await onBoard(dark.page);
await card(dark.page, 'PLQ-21')
    .locator('[data-presence="viewers"]')
    .waitFor({ timeout: 5000 });
await dark.page.screenshot({ path: `${OUT}/presence-board-dark.png` });

/** Rizky (sheet on PLQ-15) types a comment draft; the whisper is throttled. */
async function rizkyTypes() {
    const box = rizky.page
        .getByRole('dialog')
        .getByRole('textbox', { name: 'Komentar baru' });
    await rizky.page.waitForTimeout(2600);
    await box.click();
    await box.pressSequentially('x', { delay: 40 });
}

await rizkyTypes();
await card(dark.page, 'PLQ-15')
    .locator('[data-presence="typing"]')
    .waitFor({ timeout: 5000 });
await card(dark.page, 'PLQ-15').screenshot({
    path: `${OUT}/presence-card-typing-dark.png`,
});

for (const scheme of ['light', 'dark']) {
    const phone = await login(
        'Dimas Pratama',
        { width: 375, height: 812 },
        scheme,
    );
    await phone.page.goto(`${BASE}/w/PLQ?view=list`);
    const row = card(phone.page, 'PLQ-21');
    await row.locator('[data-presence="viewers"]').waitFor({ timeout: 8000 });
    await row.scrollIntoViewIfNeeded();
    await phone.page.screenshot({
        path: `${OUT}/presence-list-mobile-${scheme}.png`,
    });
    await rizkyTypes();
    const typingRow = card(phone.page, 'PLQ-15');
    await typingRow
        .locator('[data-presence="typing"][title="Rizky sedang berkomentar"]')
        .waitFor({ timeout: 5000 });
    await typingRow.scrollIntoViewIfNeeded();
    results[`rowTypingFits-${scheme}`] = await fits(typingRow);
    await typingRow.screenshot({
        path: `${OUT}/presence-row-typing-mobile-${scheme}.png`,
    });
    // Mobile board: same card component as the desktop board.
    await phone.page.goto(`${BASE}/w/PLQ`);
    await phone.page.getByRole('tab', { name: /Review/ }).click();
    const mobileCard = phone.page.locator('[aria-label^="Buka PLQ-15 "]');
    await mobileCard
        .locator('[data-presence="viewers"]')
        .waitFor({ timeout: 8000 });
    await mobileCard.screenshot({
        path: `${OUT}/presence-card-mobile-${scheme}.png`,
    });
    await phone.context.close();
}

// 7. Rizky's tab disappears (socket closed) → his avatar goes from PLQ-15.
await rizky.context.close();
await timed(
    'tabClosedHiddenMs',
    card(dimas.page, 'PLQ-15')
        .locator('[data-presence="viewers"]')
        .waitFor({ state: 'detached', timeout: 35000 }),
);

console.log(JSON.stringify(results, null, 2));
console.log(errors.length === 0 ? 'no console errors' : errors.join('\n'));
await browser.close();
