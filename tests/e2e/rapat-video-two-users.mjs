/**
 * Video RuangKerja — two people join the same LiveKit room with fake camera &
 * microphone (manual check, needs the local LiveKit: docs/SETUP-LOKAL.md
 * "Rapat video"). Prints a JSON result and writes screenshots.
 *
 *   E2E_BASE_URL=https://ruangkerja-rapat.test E2E_MEETING=<ulid> \
 *     node tests/e2e/rapat-video-two-users.mjs
 *
 * E2E_MEETING = a `video` meeting organized by kadiv@demo.test (Dimas) with
 * anggota@demo.test (Rizky) invited, inside the join window (now between 15
 * minutes before the start and 2 hours after the end).
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL ?? 'https://ruangkerja.test').replace(
    /\/$/,
    '',
);
const MEETING = process.env.E2E_MEETING;
const OUT = process.env.E2E_OUT ?? 'storage/app/ui-shots/rapat-video';

if (!MEETING) {
    console.error('Isi E2E_MEETING dengan id rapat video.');
    process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
    ],
});
const results = { errors: [] };

async function login(name, email, viewport, colorScheme) {
    const context = await browser.newContext({
        viewport,
        colorScheme,
        ignoreHTTPSErrors: true,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        permissions: ['camera', 'microphone'],
        isMobile: viewport.width < 768,
        hasTouch: viewport.width < 768,
    });
    const page = await context.newPage();
    page.on('pageerror', (e) =>
        results.errors.push(`[${name}] pageerror ${e.message}`),
    );
    page.on('console', (m) => {
        if (m.type() === 'error' && !/favicon|DevTools/.test(m.text())) {
            results.errors.push(`[${name}] console ${m.text()}`);
        }
    });
    await signIn(page, email);

    return page;
}

/** Demo login form of /login (APP_ENV=local, DEMO_LOGIN_ENABLED). */
async function signIn(page, email) {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page
        .locator('form', {
            has: page.locator(`input[name="email"][value="${email}"]`),
        })
        .getByRole('button')
        .click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });
}

async function join(page, label) {
    await page.goto(`${BASE}/rapat/${MEETING}/gabung`);
    await page.getByTestId('join-now').waitFor();
    // Preview video is playing (fake camera).
    await page
        .locator('video[aria-label="Pratinjau kamera Anda"]')
        .waitFor({ timeout: 10000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/${label}-prejoin.png` });
    await page.getByTestId('join-now').click();
    await page.waitForURL(/\/ruang/);
    await page
        .locator('[data-testid="participant-tile"][data-local="true"]')
        .first()
        .waitFor({ timeout: 15000 });
}

const a = await login(
    'Dimas',
    'kadiv@demo.test',
    { width: 1440, height: 900 },
    'light',
);
const b = await login(
    'Rizky',
    'anggota@demo.test',
    { width: 390, height: 844 },
    'dark',
);

await join(a, 'dimas-desktop');
await join(b, 'rizky-mobile');

// Each sees the other.
let t0 = Date.now();
await a
    .locator('[data-testid="participant-tile"][data-local="false"]')
    .first()
    .waitFor({ timeout: 15000 });
results.dimasSeesRizkyMs = Date.now() - t0;
t0 = Date.now();
await b
    .locator('[data-testid="participant-tile"][data-local="false"]')
    .first()
    .waitFor({ timeout: 15000 });
results.rizkySeesDimasMs = Date.now() - t0;
results.remoteIdentityOnDimas = await a
    .locator('[data-testid="participant-tile"][data-local="false"]')
    .first()
    .getAttribute('data-identity');

// Remote video actually plays (fake camera frames arrive).
await a.waitForFunction(
    () =>
        [
            ...document.querySelectorAll(
                '[data-testid="participant-tile"][data-local="false"] video',
            ),
        ].some((v) => v.videoWidth > 0 && !v.paused),
    null,
    { timeout: 15000 },
);
results.remoteVideoPlaying = true;
await a.waitForTimeout(1500);
await a.screenshot({ path: `${OUT}/dimas-desktop-room.png` });
await b.screenshot({ path: `${OUT}/rizky-mobile-room.png` });

// Raise hand (Rizky) → Dimas sees the hand on the tile.
await b.getByRole('button', { name: 'Angkat tangan' }).click();
await a
    .getByText('Angkat tangan', { exact: true })
    .first()
    .waitFor({ timeout: 5000 });
results.handRaised = true;

// Chat from Dimas → Rizky opens chat through "Opsi lainnya".
await a.getByRole('button', { name: 'Chat' }).click();
await a.getByLabel('Kirim pesan ke semua orang').fill('Halo dari Dimas');
await a.getByRole('button', { name: 'Kirim pesan' }).click();
await b.getByRole('button', { name: 'Opsi lainnya' }).click();
await b.getByRole('menuitem', { name: /Chat/ }).click();
await b.getByText('Halo dari Dimas').waitFor({ timeout: 5000 });
results.chatDelivered = true;
await b.screenshot({ path: `${OUT}/rizky-mobile-chat.png` });
await b.getByRole('button', { name: /Tutup chat/ }).click();

// People panel + organizer mutes Rizky.
await a.getByRole('button', { name: 'Orang' }).click();
await a.waitForTimeout(500);
await a.screenshot({ path: `${OUT}/dimas-desktop-people.png` });
await a.getByRole('button', { name: /^Bisukan / }).click();
await b
    .getByRole('button', { name: 'Nyalakan mikrofon' })
    .waitFor({ timeout: 5000 });
results.organizerMuted = true;

// Detail page shows people in the room (LiveKit webhook → attendance).
const detail = await browser.newContext({ ignoreHTTPSErrors: true });
const c = await detail.newPage();
await signIn(c, 'maya.lestari@demo.test');
await c.goto(`${BASE}/rapat/${MEETING}`);
results.detailHeadline = await c
    .getByTestId('video-headline')
    .textContent({ timeout: 5000 });
await c.setViewportSize({ width: 1440, height: 1000 });
await c.screenshot({ path: `${OUT}/maya-detail.png`, fullPage: true });

// Leave.
await b.getByRole('button', { name: 'Keluar dari rapat' }).click();
await b.getByText('Anda keluar dari rapat').waitFor();
await b.screenshot({ path: `${OUT}/rizky-mobile-left.png` });
await a
    .locator('[data-testid="participant-tile"][data-local="false"]')
    .first()
    .waitFor({ state: 'detached', timeout: 10000 });
results.leftSeenByDimas = true;

await browser.close();
console.log(JSON.stringify(results, null, 2));
