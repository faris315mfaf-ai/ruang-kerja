#!/usr/bin/env node
/**
 * Screenshots of running pages for UI review by any coding agent (Claude
 * Code, Codex, …) or a human: desktop 1440 and phone 390, light and dark,
 * signed in with a local demo account. Also reports page errors, failed
 * requests (4xx/5xx) and horizontal scrolling. Open the PNGs to compare
 * them with docs/mockups/png and docs/ruangkerja-design.
 *
 *   node scripts/ui-shots.mjs /dashboard /tugas
 *   node scripts/ui-shots.mjs /w/PRG --akun programmer@demo.test --lebar 1440,834,390 --tema terang
 *
 * Options:
 *   --akun   demo account email (default kadiv@demo.test; see /login)
 *   --lebar  comma-separated widths (default 1440,390)
 *   --tema   terang | malam | keduanya (default keduanya)
 *   --penuh  full-page screenshots
 *   --keluar output directory (default storage/app/ui-shots, ignored by git)
 *   --larang comma-separated texts that must NOT appear on the page (e.g. names
 *            of another company: multi-company isolation checks)
 *   --wajib  comma-separated texts that must appear on the page
 * Base URL: E2E_BASE_URL, else https://ruangkerja.test (Herd).
 * Requires APP_ENV=local + DEMO_LOGIN_ENABLED=true and built assets
 * (`npm run build`) or a running `npm run dev`.
 */
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);

    return index === -1 ? fallback : args[index + 1];
};
const flag = (name) => args.includes(`--${name}`);
const valued = new Set([
    '--akun',
    '--lebar',
    '--tema',
    '--keluar',
    '--larang',
    '--wajib',
]);
const routes = args.filter(
    (arg, index) => !arg.startsWith('--') && !valued.has(args[index - 1]),
);

if (routes.length === 0) {
    console.error(
        'Pakai: node scripts/ui-shots.mjs <rute…> [--akun email] [--lebar 1440,390] [--tema terang|malam|keduanya] [--penuh]',
    );
    process.exit(1);
}

const base = (process.env.E2E_BASE_URL ?? 'https://ruangkerja.test').replace(
    /\/$/,
    '',
);
const account = option('akun', 'kadiv@demo.test');
const widths = option('lebar', '1440,390').split(',').map(Number);
const theme = option('tema', 'keduanya');
const schemes =
    theme === 'terang'
        ? ['light']
        : theme === 'malam'
          ? ['dark']
          : ['light', 'dark'];
const outDir = resolve(option('keluar', 'storage/app/ui-shots'));
const texts = (name) =>
    option(name, '')
        .split(',')
        .map((text) => text.trim())
        .filter(Boolean);
const forbidden = texts('larang');
const required = texts('wajib');
const IGNORED = [/WebSocket connection to .* failed/, /status of 429/];

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

// Sign in once (demo login is rate limited), then reuse the session.
const loginContext = await browser.newContext({ ignoreHTTPSErrors: true });
const loginPage = await loginContext.newPage();
let signedIn = false;

for (let attempt = 0; attempt < 8 && !signedIn; attempt++) {
    await loginPage.goto(`${base}/login`);
    const form = loginPage.locator('form', {
        has: loginPage.locator(`input[name="email"][value="${account}"]`),
    });

    if ((await form.count()) === 0) {
        console.error(
            `Akun demo ${account} tidak ada di /login (APP_ENV=local, DEMO_LOGIN_ENABLED=true, php artisan db:seed).`,
        );
        await browser.close();
        process.exit(1);
    }

    await form.getByRole('button').click();

    try {
        // Beranda: /dashboard, or /hr for HR (Ruang HR, keputusan pemilik 20 Okt 2026).
        await loginPage.waitForURL(
            (url) => url.pathname === '/dashboard' || url.pathname === '/hr',
            { timeout: 8000 },
        );
        signedIn = true;
    } catch {
        await loginPage.waitForTimeout(10_000); // 429: wait for the limiter
    }
}

if (!signedIn) {
    console.error(
        'Gagal masuk dengan akun demo (batas laju login?). Coba lagi sebentar.',
    );
    await browser.close();
    process.exit(1);
}

const state = await loginContext.storageState();
await loginContext.close();

let problems = 0;

for (const route of routes) {
    for (const width of widths) {
        for (const scheme of schemes) {
            const phone = width < 768;
            const context = await browser.newContext({
                ignoreHTTPSErrors: true,
                storageState: state,
                colorScheme: scheme,
                viewport: { width, height: phone ? 844 : 900 },
                isMobile: phone,
                hasTouch: phone,
                deviceScaleFactor: phone ? 2 : 1,
                locale: 'id-ID',
                timezoneId: 'Asia/Jakarta',
            });
            const page = await context.newPage();
            const errors = [];

            page.on('pageerror', (error) =>
                errors.push(`pageerror: ${error.message}`),
            );
            page.on('console', (message) => {
                if (
                    message.type() === 'error' &&
                    !IGNORED.some((pattern) => pattern.test(message.text()))
                ) {
                    errors.push(`console: ${message.text()}`);
                }
            });
            page.on('response', (response) => {
                if (response.status() >= 400 && response.status() !== 429) {
                    errors.push(`HTTP ${response.status()} ${response.url()}`);
                }
            });

            const response = await page.goto(`${base}${route}`);
            await page.waitForLoadState('networkidle').catch(() => {});
            await page.waitForTimeout(500);

            const overflow = await page.evaluate(
                () =>
                    document.documentElement.scrollWidth >
                    document.documentElement.clientWidth,
            );
            const slug =
                route
                    .replace(/^\//, '')
                    .replace(/[^a-z0-9]+/gi, '-')
                    .replace(/-$/, '') || 'root';
            const file = join(
                outDir,
                `${slug}-${width}-${scheme === 'light' ? 'terang' : 'malam'}.png`,
            );

            await page.screenshot({ path: file, fullPage: flag('penuh') });

            const text =
                forbidden.length + required.length > 0
                    ? await page.evaluate(() => document.body.innerText)
                    : '';
            const found = forbidden.filter((needle) => text.includes(needle));
            const missing = required.filter((needle) => !text.includes(needle));
            const notes = [
                response ? `HTTP ${response.status()}` : 'tanpa respons',
                overflow ? 'GULIR HORIZONTAL' : null,
                ...found.map((needle) => `TEKS TERLARANG: ${needle}`),
                ...missing.map((needle) => `TEKS TIDAK ADA: ${needle}`),
                ...errors,
            ].filter(Boolean);

            if (
                overflow ||
                found.length > 0 ||
                missing.length > 0 ||
                errors.length > 0 ||
                (response && response.status() >= 400)
            ) {
                problems++;
            }

            console.log(`${file}\n  ${notes.join('\n  ')}`);
            await context.close();
        }
    }
}

await browser.close();
console.log(
    problems === 0
        ? '\nSelesai: tanpa galat.'
        : `\nSelesai: ${problems} tangkapan bermasalah.`,
);
process.exit(problems === 0 ? 0 : 2);
