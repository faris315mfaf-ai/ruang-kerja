/**
 * Notulen otomatis — end-to-end on the local stack (manual check, see
 * transcriber/DEPLOY.md §5): local LiveKit + the worker + `php artisan
 * queue:work` + a FAKE OpenAI-compatible endpoint (never the real API).
 * Two Chromium processes join the same room, each with its own WAV file as
 * the fake microphone (Indonesian speech), leave, then the script polls the
 * status endpoint until the transcript and the AI draft arrive.
 *
 *   E2E_BASE_URL=https://ruangkerja-notulen.test E2E_MEETING=<ulid> \
 *   E2E_AUDIO_A=dimas.wav E2E_AUDIO_B=rizky.wav E2E_SECONDS=45 \
 *     node tests/e2e/notulen-otomatis.mjs
 *
 * E2E_MEETING = a video meeting with auto_minutes, organized by
 * kadiv@demo.test with anggota@demo.test invited, inside the join window.
 * WAV: 48 kHz mono 16-bit; pad B with silence so the speakers take turns.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = (process.env.E2E_BASE_URL ?? 'https://ruangkerja.test').replace(
    /\/$/,
    '',
);
const MEETING = process.env.E2E_MEETING;
const SECONDS = Number(process.env.E2E_SECONDS ?? 45);
const OUT = process.env.E2E_OUT ?? 'storage/app/ui-shots/notulen-otomatis';

if (!MEETING || !process.env.E2E_AUDIO_A || !process.env.E2E_AUDIO_B) {
    console.error('Isi E2E_MEETING, E2E_AUDIO_A dan E2E_AUDIO_B.');
    process.exit(1);
}

mkdirSync(OUT, { recursive: true });
const results = { errors: [], timeline: [] };
const log = (step) =>
    results.timeline.push(`${new Date().toISOString()} ${step}`);

async function person(email, audio) {
    const browser = await chromium.launch({
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
            `--use-file-for-fake-audio-capture=${audio}`,
            '--autoplay-policy=no-user-gesture-required',
        ],
    });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        ignoreHTTPSErrors: true,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
        permissions: ['camera', 'microphone'],
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => results.errors.push(`[${email}] ${e.message}`));
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page
        .locator('form', {
            has: page.locator(`input[name="email"][value="${email}"]`),
        })
        .getByRole('button')
        .click();
    await page.waitForURL('**/dashboard', { timeout: 15000 });

    return { browser, page };
}

async function join({ page }, label) {
    await page.goto(`${BASE}/rapat/${MEETING}/gabung`);
    await page.getByTestId('join-now').waitFor();
    await page.getByTestId('join-now').click();
    await page.waitForURL(`**/rapat/${MEETING}/ruang**`, { timeout: 15000 });
    log(`${label} joined`);
}

async function status(page) {
    return page.evaluate(async (url) => {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
        });

        return response.ok ? response.json() : { http: response.status };
    }, `${BASE}/rapat/${MEETING}/notulen-otomatis/status`);
}

const a = await person('kadiv@demo.test', process.env.E2E_AUDIO_A);
const b = await person('anggota@demo.test', process.env.E2E_AUDIO_B);

await Promise.all([join(a, 'A'), join(b, 'B')]);
await a.page.screenshot({ path: `${OUT}/ruang.png` });
await a.page.waitForTimeout(SECONDS * 1000);
log('leaving');
await b.browser.close();
await a.page.goto(`${BASE}/rapat/${MEETING}`);

let summary = null;
const deadline = Date.now() + 10 * 60 * 1000;

while (Date.now() < deadline) {
    summary = await status(a.page);
    const t = summary?.transcript?.status;
    const d = summary?.draft?.status;

    if (t === 'failed' || (t === 'ready' && d !== 'pending')) {
        break;
    }

    await a.page.waitForTimeout(5000);
}

log(`final status ${summary?.transcript?.status} / ${summary?.draft?.status}`);
const transcript = await a.page.evaluate(async (url) => {
    const response = await fetch(url, {
        headers: { Accept: 'application/json' },
    });

    return response.ok ? response.json() : { http: response.status };
}, `${BASE}/rapat/${MEETING}/notulen-otomatis/transkrip`);

await a.page.goto(`${BASE}/rapat/${MEETING}/notulen-otomatis`);
await a.page.waitForTimeout(1500);
await a.page.screenshot({ path: `${OUT}/hasil.png`, fullPage: true });
await a.browser.close();

console.log(
    JSON.stringify(
        {
            ...results,
            transcript_status: summary?.transcript?.status,
            transcript_error: summary?.transcript?.error,
            speakers: summary?.transcript?.speakers,
            segments: transcript.segments?.map(
                (s) =>
                    `${s.speaker_name} @${Math.round(s.start_ms / 1000)}s: ${s.text}`,
            ),
            draft: summary?.draft,
        },
        null,
        2,
    ),
);
