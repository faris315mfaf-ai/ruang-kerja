/**
 * Sprint 6 — realtime between two users (manual, needs Reverb + a queue worker
 * for the `realtime` queue). Prints latencies in ms; every value must stay < 1000.
 *
 *   E2E_BASE_URL=http://ws6.localhost:8197 node tests/e2e/realtime-two-users.mjs
 *
 * Run on freshly seeded data (php artisan migrate:fresh --seed).
 */
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL ?? 'https://ruangkerja.test';
const OUT = process.env.E2E_OUT ?? 'test-results';
const browser = await chromium.launch({
    args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1'],
});
const results = {};

async function login(
    name,
    viewport = { width: 1440, height: 900 },
    colorScheme = 'dark',
) {
    const context = await browser.newContext({ viewport, colorScheme });
    const page = await context.newPage();
    page.on('pageerror', (e) => console.log(`[${name}] pageerror`, e.message));
    page.on(
        'console',
        (m) =>
            m.type() === 'error' && console.log(`[${name}] console`, m.text()),
    );
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page
        .getByRole('button', { name: new RegExp(`Masuk sebagai ${name}`) })
        .click();
    await page.waitForURL(/dashboard/);
    return page;
}

const a = await login('Dimas Pratama');
const b = await login('Rizky Aditya');

for (const page of [a, b]) {
    await page.goto(`${BASE}/w/PLQ`);
    await page.getByText('tersinkron langsung').waitFor({ timeout: 10000 });
}
results.connected = true;

// Presence: A opens PLQ-21, then B opens it.
await a
    .getByRole('button', { name: 'PLQ-21 Landing page produk baru' })
    .click();
await a.getByRole('dialog').getByText('Aktivitas', { exact: true }).waitFor();
await b
    .getByRole('button', { name: 'PLQ-21 Landing page produk baru' })
    .click();
await b.getByRole('dialog').getByText('Aktivitas', { exact: true }).waitFor();
let t0 = Date.now();
await a
    .getByRole('status', { name: /Rizky sedang melihat/ })
    .waitFor({ timeout: 5000 });
results.presenceMs = Date.now() - t0;
await a.screenshot({ path: `${OUT}/sheet-dark.png` });

// Comment with a mention, from B; A sees it live.
const editor = b.getByRole('textbox', { name: 'Komentar baru' });
await editor.click();
await editor.pressSequentially('Uji realtime untuk ');
await editor.pressSequentially('@Dimas');
await b.getByRole('option', { name: /Dimas Pratama/ }).waitFor();
await b.keyboard.press('Enter');
await editor.pressSequentially('mohon dicek #');
await b.getByRole('option').first().waitFor();
await b.keyboard.press('Escape');
await b.getByRole('button', { name: 'Kirim', exact: true }).click();
t0 = Date.now();
await a
    .getByRole('dialog')
    .getByText('Uji realtime untuk')
    .waitFor({ timeout: 5000 });
results.commentMs = Date.now() - t0;

// Reaction from A; B sees count.
const comment = a
    .getByRole('article', { name: 'Komentar Rizky Aditya' })
    .last();
await comment.getByRole('button', { name: 'Tambah reaksi' }).click();
await a.getByRole('menuitem', { name: 'Reaksi 🎉' }).click();
t0 = Date.now();
await b
    .getByRole('button', { name: /🎉 1: Dimas Pratama/ })
    .waitFor({ timeout: 5000 });
results.reactionMs = Date.now() - t0;

// Status change in B's sheet; A's board (sheet closed) moves the card.
await a.getByRole('menu').waitFor({ state: 'detached' });
await a.keyboard.press('Escape');
await a.getByRole('dialog').waitFor({ state: 'detached' });
await b
    .getByRole('dialog')
    .getByRole('button', { name: /^Status:/ })
    .first()
    .click();
await b.getByRole('menuitemradio', { name: 'Review' }).click();
t0 = Date.now();
await a
    .locator('[aria-label^="Kolom Review"]')
    .getByRole('button', { name: 'PLQ-21 Landing page produk baru' })
    .waitFor({ state: 'attached', timeout: 5000 });
results.moveMs = Date.now() - t0;
await a.screenshot({ path: `${OUT}/board-after-move.png` });

// Shortcuts: focus card, press ?.
await a.keyboard.press('Shift+?');
await a
    .getByRole('dialog', { name: 'Pintasan keyboard' })
    .waitFor({ timeout: 3000 });
results.helpDialog = true;
await a.keyboard.press('Escape');

// Full-screen page + mobile.
await a.goto(`${BASE}/w/PLQ/tasks/21`);
await a.getByText('Properti', { exact: true }).waitFor();
await a.screenshot({ path: `${OUT}/page-dark.png`, fullPage: true });
const light = await login(
    'Dimas Pratama',
    { width: 1440, height: 900 },
    'light',
);
await light.goto(`${BASE}/w/PLQ/tasks/21`);
await light.getByText('Properti', { exact: true }).waitFor();
await light.screenshot({ path: `${OUT}/page-light.png`, fullPage: true });
const mobile = await login('Rizky Aditya', { width: 375, height: 812 }, 'dark');
await mobile.goto(`${BASE}/w/PLQ/tasks/21`);
await mobile.getByText('Deskripsi', { exact: true }).waitFor();
await mobile.screenshot({ path: `${OUT}/mobile-dark.png`, fullPage: true });
const tablet = await login(
    'Dimas Pratama',
    { width: 834, height: 1112 },
    'light',
);
await tablet.goto(`${BASE}/w/PLQ/tasks/21`);
await tablet.getByText('Properti', { exact: true }).waitFor();
await tablet.screenshot({ path: `${OUT}/tablet-light.png` });

console.log(JSON.stringify(results, null, 2));
await browser.close();
