/**
 * Video RuangKerja "Notulen Hidup" (arah C) — two people join the same
 * LiveKit room with fake camera & microphone (manual check, needs the local LiveKit: docs/SETUP-LOKAL.md
 * "Rapat video"). Prints a JSON result and writes screenshots.
 *
 *   E2E_BASE_URL=https://ruangkerja-rapat.test E2E_MEETING=<ulid> \
 *     node tests/e2e/rapat-video-two-users.mjs
 *
 * E2E_MEETING = a `video` meeting organized by kadiv@demo.test (Dimas) with
 * anggota@demo.test (Rizky) invited, inside the join window (now between 15
 * minutes before the start and 2 hours after the end). E2E_OBSERVER = a third
 * invited demo account that opens the detail page (default maya.lestari@).
 * Checks the arah C room: minutes in the centre (desktop) and in the phone's
 * Notulen tab, live minutes after the organizer types, raised hand through
 * the server, chat, Kehadiran + mute, attendance on the detail page, leave.
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

// Arah C: the live minutes are in the centre for both, with the navigator
// and "Waktu bicara" on desktop and the Video | Notulen tabs on the phone.
await a.getByTestId('minutes-doc').waitFor({ timeout: 10000 });
await a.getByRole('navigation', { name: 'Bagian notulen' }).waitFor();
await a.getByTestId('talk-time').waitFor();
await b.getByRole('tab', { name: /Notulen/ }).click();
await b.getByTestId('minutes-doc').waitFor({ timeout: 10000 });
results.minutesInRoom = true;
await b.screenshot({ path: `${OUT}/rizky-mobile-notulen.png` });
await b.getByRole('tab', { name: /Video/ }).click();

// The organizer types in the minutes → Rizky sees it after the autosave
// (LiveKit nudge / minutes.updated → GET …/notulen/data).
const marker = `Uji e2e ${Date.now()}`;
const field = a.getByRole('textbox', { name: /^Catatan / }).first();

if (await field.count()) {
    await field.click();
    await field.press('End');
    await field.type(` ${marker}`);
    await b.getByRole('tab', { name: /Notulen/ }).click();
    await b.getByText(marker, { exact: false }).waitFor({ timeout: 15000 });
    results.minutesLive = true;
    await b.getByRole('tab', { name: /Video/ }).click();
}

// Raise hand (Rizky, through the server: POST …/video/tangan) → Dimas sees
// the hand badge on the tile.
await b.getByRole('button', { name: 'Angkat tangan' }).click();
await a
    .getByText(/mengangkat tangan/)
    .first()
    .waitFor({ timeout: 8000 });
results.handRaised = true;

// Chat from Dimas → Rizky opens "Obrolan" from the bar.
await a.getByRole('button', { name: 'Obrolan' }).click();
await a.getByLabel('Kirim pesan ke semua orang').fill('Halo dari Dimas');
await a.getByRole('button', { name: 'Kirim pesan' }).click();
await b.getByRole('button', { name: 'Obrolan' }).click();
await b.getByText('Halo dari Dimas').waitFor({ timeout: 5000 });
results.chatDelivered = true;
await b.screenshot({ path: `${OUT}/rizky-mobile-chat.png` });
await b.getByRole('button', { name: /Tutup obrolan/ }).click();
await a.getByRole('button', { name: /Tutup obrolan/ }).click();

// Kehadiran panel + organizer mutes Rizky.
await a.getByRole('button', { name: 'Kehadiran' }).click();
await a.getByTestId('attendance').waitFor();
await a.waitForTimeout(500);
await a.screenshot({ path: `${OUT}/dimas-desktop-kehadiran.png` });
const moderate = a.getByRole('button', { name: /^Moderasi / }).first();

if (await moderate.count()) {
    await moderate.click();
    await a.getByRole('menuitem', { name: /^Bisukan / }).click();
    await b
        .getByRole('button', { name: 'Nyalakan mikrofon' })
        .waitFor({ timeout: 8000 });
    results.organizerMuted = true;
}

// Detail page shows people in the room (LiveKit webhook → attendance).
const detail = await browser.newContext({ ignoreHTTPSErrors: true });
const c = await detail.newPage();
await signIn(c, process.env.E2E_OBSERVER ?? 'maya.lestari@demo.test');
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
