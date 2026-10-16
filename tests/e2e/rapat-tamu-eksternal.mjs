/**
 * Tamu eksternal rapat video — alur nyata dengan dua peramban (manual check,
 * butuh LiveKit lokal: docs/SETUP-LOKAL.md "Rapat video"). Penyelenggara (kadiv@demo.test)
 * menambah tamu, tamu (tanpa akun) minta masuk dari tautan pribadi, penyelenggara
 * mengizinkan, keduanya saling terlihat, lalu penyelenggara mengeluarkan tamu.
 *
 *   E2E_BASE_URL=http://localhost:8001 E2E_MEETING=<ulid rapat video kadiv> \
 *     node tests/e2e/rapat-tamu-eksternal.mjs
 *
 * Token tautan tamu tidak pernah dicetak. Screenshot: storage/app/ui-shots/rapat-tamu/.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL ?? 'http://localhost:8001').replace(/\/$/, '');
const MEETING = process.env.E2E_MEETING;
const OUT = process.env.E2E_OUT ?? 'storage/app/ui-shots/rapat-tamu';
if (!MEETING) {
    console.error('Isi E2E_MEETING dengan id rapat video milik kadiv@demo.test.');
    process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'],
});
const results = { errors: [], steps: {} };

async function newPage(name, viewport, withLogin) {
    const context = await browser.newContext({ viewport, locale: 'id-ID', timezoneId: 'Asia/Jakarta', permissions: ['camera', 'microphone'], isMobile: viewport.width < 768, hasTouch: viewport.width < 768 });
    const page = await context.newPage();
    page.on('pageerror', (e) => results.errors.push(`[${name}] pageerror ${e.message}`));
    page.on('console', (m) => {
        if (m.type() === 'error' && !/favicon|DevTools|Failed to load resource/.test(m.text())) results.errors.push(`[${name}] console ${m.text()}`);
    });
    if (withLogin) {
        await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        await page.locator('form', { has: page.locator('input[name="email"][value="kadiv@demo.test"]') }).getByRole('button').click();
        await page.waitForURL('**/dashboard', { timeout: 15000 });
    }
    return page;
}

/** Same-origin JSON call from the organizer's session (XSRF cookie → header). */
async function api(page, method, path, body) {
    return page.evaluate(
        async ({ method, path, body }) => {
            const xsrf = decodeURIComponent((document.cookie.match(/XSRF-TOKEN=([^;]+)/) ?? [])[1] ?? '');
            const res = await fetch(path, { method, headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-XSRF-TOKEN': xsrf }, credentials: 'same-origin', ...(body ? { body: JSON.stringify(body) } : {}) });
            let json = null;
            try { json = await res.json(); } catch { /* empty */ }
            return { status: res.status, json };
        },
        { method, path, body },
    );
}

const org = await newPage('Dimas', { width: 1440, height: 900 }, true);
const guest = await newPage('Tamu', { width: 390, height: 844 }, false);

// 1. Organizer adds a guest and gets the private link.
const created = await api(org, 'POST', `/rapat/${MEETING}/tamu`, { email: 'budi.mitra@example.com', name: 'Budi Mitra' });
results.steps.addGuest = created.status;
const list = await api(org, 'GET', `/rapat/${MEETING}/tamu`);
const mine = (list.json?.guests ?? list.json?.data ?? []).find((g) => (g.email ?? '').includes('budi.mitra'));
const link = mine?.link_url;
if (!link) {
    console.log(JSON.stringify({ ...results, fatal: 'tautan tamu tidak ada di jawaban', listStatus: list.status, keys: Object.keys(list.json ?? {}) }, null, 2));
    process.exit(1);
}
const guestPath = new URL(link).pathname;
const participantId = mine.id;

// 2. Organizer joins the room.
await org.goto(`${BASE}/rapat/${MEETING}/gabung`);
await org.getByTestId('join-now').waitFor();
await org.getByTestId('join-now').click();
await org.waitForURL(/\/ruang/);
await org.locator('[data-testid="participant-tile"][data-local="true"]').first().waitFor({ timeout: 15000 });
results.steps.organizerInRoom = true;

// 3. Guest opens the link, types a name, asks to join.
await guest.goto(`${BASE}${guestPath}`, { waitUntil: 'domcontentloaded' });
await guest.getByLabel('Nama Anda').waitFor({ timeout: 15000 });
await guest.screenshot({ path: `${OUT}/1-tamu-form.png` });
await guest.getByLabel('Nama Anda').fill('Budi Mitra');
await guest.getByRole('button', { name: /Minta masuk/ }).click();
await guest.getByText(/menunggu/i).first().waitFor({ timeout: 15000 });
await guest.screenshot({ path: `${OUT}/2-tamu-menunggu.png` });
results.steps.guestWaiting = true;

// 4. Organizer sees the lobby, admits.
let waiting = 0;
for (let i = 0; i < 12 && waiting === 0; i++) {
    await org.waitForTimeout(1500);
    const lobby = await api(org, 'GET', `/rapat/${MEETING}/video/ruang-tunggu`);
    waiting = (lobby.json?.waiting ?? lobby.json?.data ?? []).length;
}
results.steps.lobbyCount = waiting;
await org.screenshot({ path: `${OUT}/3-penyelenggara-ruang-tunggu.png` });
const admit = await api(org, 'POST', `/rapat/${MEETING}/video/ruang-tunggu/${participantId}/izinkan`);
results.steps.admit = admit.status;

// 5. Guest passes the pre-join and enters.
const guestJoin = guest.getByRole('button', { name: 'Masuk ke rapat' });
await guestJoin.waitFor({ timeout: 20000 });
await guest.screenshot({ path: `${OUT}/4-tamu-prejoin.png` });
await guestJoin.click();
await guest.locator('[data-testid="participant-tile"][data-local="true"]').first().waitFor({ timeout: 20000 });
let t0 = Date.now();
await guest.locator('[data-testid="participant-tile"][data-local="false"]').first().waitFor({ timeout: 15000 });
results.steps.guestSeesOrganizerMs = Date.now() - t0;
await org.locator('[data-testid="participant-tile"][data-local="false"]').first().waitFor({ timeout: 15000 });
await org.waitForTimeout(1200);
results.steps.organizerSeesGuestLabel = (await org.getByText(/\(Tamu\)|Tamu/).count()) > 0;
await guest.screenshot({ path: `${OUT}/5-tamu-ruang.png` });
await org.screenshot({ path: `${OUT}/6-penyelenggara-ruang.png` });

// 6. Guest must not reach app data.
const probe = await guest.evaluate(async () => {
    const out = {};
    for (const p of ['/dashboard', '/rapat', '/tugas-saya']) {
        const r = await fetch(p, { redirect: 'manual', headers: { Accept: 'application/json' } });
        out[p] = r.status === 0 ? 'redirect' : r.status;
    }
    return out;
});
results.steps.guestProbe = probe;

// 7. Organizer kicks the guest → guest sees the removal screen and cannot return.
const kick = await api(org, 'DELETE', `/rapat/${MEETING}/video/peserta/${encodeURIComponent(`guest:${participantId}`)}`);
results.steps.kick = kick.status;
await guest.getByText(/dikeluarkan/i).first().waitFor({ timeout: 20000 }).catch(() => results.errors.push('tamu: layar "dikeluarkan" tidak muncul'));
await guest.screenshot({ path: `${OUT}/7-tamu-dikeluarkan.png` });
const retry = await guest.evaluate(async (p) => (await fetch(`/api/tamu/${p}/token`, { method: 'POST', headers: { Accept: 'application/json' } })).status, guestPath.split('/').pop());
results.steps.tokenAfterKick = retry;

// 8. Cleanup: revoke the guest link.
const revoke = await api(org, 'DELETE', `/rapat/${MEETING}/tamu/${participantId}`);
results.steps.revoke = revoke.status;
const dead = await guest.evaluate(async (p) => (await fetch(`/api/tamu/${p}/info`, { headers: { Accept: 'application/json' } })).status, guestPath.split('/').pop());
results.steps.infoAfterRevoke = dead;

console.log(JSON.stringify(results, null, 2));
await browser.close();
