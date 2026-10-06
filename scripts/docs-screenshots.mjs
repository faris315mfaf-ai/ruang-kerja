#!/usr/bin/env node
/**
 * Screenshots for docs/fitur/*.md (Fase 2 & 3 previews).
 *
 * Usage (from the repo root, app served by Herd, FEATURE_PROTOTYPE=true):
 *   node scripts/docs-screenshots.mjs                    # every module
 *   node scripts/docs-screenshots.mjs obrolan,okr        # some modules
 *   node scripts/docs-screenshots.mjs obrolan thread     # some screens of a module
 *   DOCS_BASE_URL=https://ruangkerja.test node scripts/docs-screenshots.mjs
 *
 * Output: docs/fitur/img/<module>/<screen>-<desktop|desktop-malam|ponsel>.jpg
 *   desktop        1440×900, light
 *   desktop-malam  1440×900, dark (demo accounts follow the system theme)
 *   ponsel         390×844, light, isMobile + hasTouch, deviceScaleFactor 2
 *
 * Every image is a JPEG (quality 80) so a module never mixes formats and a
 * 2× phone screenshot stays well under 600 KB. Each account signs in once via
 * the demo login form (retrying on 429) and the session is reused for all
 * variants. A failing interaction is reported and its image skipped; the
 * script exits 1 when anything failed.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.DOCS_BASE_URL ?? 'https://ruangkerja-proto.test';
const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUT = path.join(ROOT, 'docs/fitur/img');
const ONLY = process.argv[2]?.split(',') ?? null;
const ONLY_SCREENS = process.argv[3]?.split(',') ?? null;
const MAX_HEIGHT = 2600;
const MAX_HEIGHT_MOBILE = 1800;
const QUALITY = 80;

const VARIANTS = {
    desktop: { viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
    'desktop-malam': {
        viewport: { width: 1440, height: 900 },
        colorScheme: 'dark',
    },
    ponsel: {
        viewport: { width: 390, height: 844 },
        colorScheme: 'light',
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
    },
};
const ALL = ['desktop', 'desktop-malam', 'ponsel'];
const ACCOUNTS = {
    kadiv: 'kadiv@demo.test',
    direksi: 'direksi@demo.test',
    hr: 'hr@demo.test',
};

/** Helpers available to actions. */
const click = (page, mobile, locator) =>
    mobile ? locator.tap() : locator.click();
const dialog = (page) =>
    page.getByRole('dialog').first().waitFor({ timeout: 6000 });

/**
 * One entry per image set: module folder, screen name, path, account,
 * variants, optional interaction before the shot and `full` for a tall
 * capture (viewport grown to the page height, capped per platform).
 */
const SHOTS = [
    // F2-1 · Obrolan
    { mod: 'obrolan', name: 'daftar', path: '/obrolan', v: ALL },
    { mod: 'obrolan', name: 'percakapan', path: '/obrolan/plq', v: ALL },
    {
        mod: 'obrolan',
        name: 'mention',
        path: '/obrolan/plq',
        v: ['desktop'],
        act: async (page) => {
            const box = page.getByPlaceholder(/Tulis pesan/).first();
            await box.click();
            await box.pressSequentially('Halo @sar', { delay: 40 });
            await page.waitForTimeout(600);
        },
    },
    {
        mod: 'obrolan',
        name: 'thread',
        path: '/obrolan/plq',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page.getByRole('button', { name: /\d+ balasan/ }).last(),
            );
            await page.waitForTimeout(900);
        },
    },
    {
        mod: 'obrolan',
        name: 'obrolan-baru',
        path: '/obrolan',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: 'Obrolan baru' })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'obrolan',
        name: 'keadaan-kosong',
        path: '/obrolan?keadaan=kosong',
        v: ['desktop'],
    },

    // F2-2 · Catatan bersama
    { mod: 'catatan', name: 'daftar', path: '/catatan', v: ALL },
    { mod: 'catatan', name: 'editor', path: '/catatan/sop-onboarding', v: ALL },
    {
        mod: 'catatan',
        name: 'catatan-baru',
        path: '/catatan',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Catatan baru/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'catatan',
        name: 'riwayat',
        path: '/catatan/sop-onboarding',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page.getByRole('button', { name: /Riwayat/ }).first(),
            );
            await page.waitForTimeout(900);
        },
    },
    {
        mod: 'catatan',
        name: 'bagikan',
        path: '/catatan/sop-onboarding',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /^Bagikan/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },

    // F2-3 · Rapat, notulen & kalender
    { mod: 'rapat-kalender', name: 'agenda', path: '/rapat', v: ALL },
    {
        mod: 'rapat-kalender',
        name: 'berlangsung',
        path: '/rapat?jam=10.42',
        v: ['desktop'],
    },
    {
        mod: 'rapat-kalender',
        name: 'pemberitahuan',
        path: '/rapat',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            const name = mobile
                ? /Contoh notifikasi/
                : /Lihat contoh pemberitahuan/;
            await click(
                page,
                mobile,
                page.getByRole('button', { name }).first(),
            );
            await page.waitForTimeout(900);
        },
    },
    {
        mod: 'rapat-kalender',
        name: 'jadwalkan-validasi',
        path: '/rapat/baru',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Periksa & kirim undangan/ })
                .first()
                .click();
            await page.waitForTimeout(600);
        },
    },
    {
        mod: 'rapat-kalender',
        name: 'jadwalkan',
        path: '/rapat/baru',
        v: ALL,
        full: true,
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page.getByRole('button', { name: /Isi contoh/ }).first(),
            );
            await page.waitForTimeout(700);
        },
    },
    {
        mod: 'rapat-kalender',
        name: 'jadwalkan-ringkasan',
        path: '/rapat/baru',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page.getByRole('button', { name: /Isi contoh/ }).first(),
            );
            await page.waitForTimeout(400);
            await click(
                page,
                mobile,
                page
                    .getByRole('button', { name: /Periksa & kirim undangan/ })
                    .first(),
            );
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'rapat-kalender',
        name: 'detail',
        path: '/rapat/koordinasi-q4',
        v: ALL,
        full: true,
    },
    {
        mod: 'rapat-kalender',
        name: 'notulen',
        path: '/rapat/standup-ops/notulen',
        v: ALL,
        full: true,
    },
    {
        mod: 'rapat-kalender',
        name: 'notulen-tugas',
        path: '/rapat/standup-ops/notulen',
        v: ['desktop'],
        full: true,
        act: async (page) => {
            await page
                .getByRole('button', { name: /Jadikan tugas/ })
                .first()
                .click();
            await page
                .getByText(/OPS-1\d\d/)
                .first()
                .waitFor({ timeout: 6000 });
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'rapat-kalender',
        name: 'notulen-final',
        path: '/rapat/standup-ops/notulen?final=1',
        v: ['desktop', 'ponsel'],
        full: true,
    },
    { mod: 'rapat-kalender', name: 'kalender', path: '/kalender', v: ALL },
    {
        mod: 'rapat-kalender',
        name: 'kalender-minggu',
        path: '/kalender',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('tab', { name: 'Minggu' })
                .or(page.getByRole('button', { name: 'Minggu' }))
                .first()
                .click();
            await page.waitForTimeout(700);
        },
    },
    {
        mod: 'rapat-kalender',
        name: 'kalender-terputus',
        path: '/kalender?keadaan=terputus',
        v: ['desktop'],
    },
    {
        mod: 'rapat-kalender',
        name: 'jadwal-manajemen',
        path: '/manajemen/jadwal',
        as: 'direksi',
        v: ALL,
    },

    // F2-4 · Otomasi, WhatsApp & Kinerja saya
    {
        mod: 'otomasi-whatsapp',
        name: 'whatsapp',
        path: '/pengaturan/whatsapp',
        v: ALL,
        full: true,
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'whatsapp-terhubung',
        path: '/pengaturan/whatsapp',
        v: ['desktop'],
        full: true,
        act: async (page) => {
            await page
                .getByLabel(/Nomor WhatsApp/)
                .first()
                .fill('0812-3456-7890');
            await page
                .getByRole('button', { name: /Kirim kode/ })
                .first()
                .click();
            const otp = page
                .locator(
                    'input[autocomplete="one-time-code"], [data-input-otp] input, input[inputmode=numeric]',
                )
                .first();
            await otp.waitFor({ timeout: 6000 });
            await otp.click();
            await page.keyboard.type('246810');
            await page
                .getByText(/Terhubung/)
                .first()
                .waitFor({ timeout: 6000 });
            await page.waitForTimeout(1500);
        },
    },
    { mod: 'otomasi-whatsapp', name: 'aturan', path: '/otomasi', v: ALL },
    {
        mod: 'otomasi-whatsapp',
        name: 'aturan-baru',
        path: '/otomasi',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            const button = page.getByRole('button', { name: /Aturan baru/ });
            await click(page, mobile, mobile ? button.last() : button.first());
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'berulang',
        path: '/otomasi/berulang',
        v: ALL,
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'berulang-baru',
        path: '/otomasi/berulang',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Tugas berulang baru/ })
                .last()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'template',
        path: '/otomasi/template',
        v: ALL,
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'template-pakai',
        path: '/otomasi/template',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Pakai template/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'kinerja',
        path: '/kinerja',
        v: ALL,
        full: true,
    },
    {
        mod: 'otomasi-whatsapp',
        name: 'keadaan-kosong',
        path: '/otomasi?keadaan=kosong',
        v: ['desktop'],
    },

    // F3-1 · F3-2 · Aplikasi ponsel
    {
        mod: 'aplikasi-ponsel',
        name: 'ringkasan',
        path: '/pratinjau/ponsel',
        v: ALL,
        full: true,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'masuk',
        path: '/pratinjau/ponsel/masuk',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'masuk-berhasil',
        path: '/pratinjau/ponsel/masuk',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page.getByRole('button', { name: 'Masuk dengan sidik jari' }),
            );
            await page
                .getByText('Berhasil · membuka beranda')
                .waitFor({ timeout: 6000 });
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'kunci',
        path: '/pratinjau/ponsel/kunci',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'widget',
        path: '/pratinjau/ponsel/widget?skenario=sedang',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'wajah-persetujuan',
        path: '/absensi/wajah',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'wajah-liveness',
        path: '/absensi/wajah',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            const boxes = page.getByRole('checkbox');
            for (let i = 0; i < (await boxes.count()); i++) {
                if (await boxes.nth(i).isVisible())
                    await click(page, mobile, boxes.nth(i));
            }
            await click(
                page,
                mobile,
                page
                    .getByRole('button', { name: /Setuju & daftarkan wajah/ })
                    .first(),
            );
            await click(
                page,
                mobile,
                page.getByRole('button', { name: /Mulai pemindaian/ }).first(),
            );
            await page.waitForTimeout(1800);
        },
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'integritas',
        path: '/pratinjau/ponsel/integritas?skenario=lokasi-palsu',
        v: ALL,
        act: async (page) => {
            await page.waitForTimeout(4500);
        },
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'offline',
        path: '/pratinjau/ponsel/offline',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'offline-sinkron',
        path: '/pratinjau/ponsel/offline',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Coba kirim sekarang/ })
                .first()
                .click();
            await page.waitForTimeout(7000);
        },
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'aksi-cepat',
        path: '/pratinjau/ponsel/aksi-cepat',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'perangkat',
        path: '/pengaturan/perangkat',
        v: ALL,
    },
    {
        mod: 'aplikasi-ponsel',
        name: 'perangkat-cabut',
        path: '/pengaturan/perangkat',
        v: ['desktop'],
        act: async (page) => {
            await page.getByRole('button', { name: /Cabut/ }).nth(1).click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },

    // F3-3 · OKR
    { mod: 'okr', name: 'daftar', path: '/okr', v: ALL, full: true },
    { mod: 'okr', name: 'detail', path: '/okr/q4-ops-1', v: ALL, full: true },
    {
        mod: 'okr',
        name: 'checkin',
        path: '/okr/q4-ops-1',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /^Check-in/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'okr',
        name: 'tambah-kr',
        path: '/okr/q4-ops-1',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Tambah key result/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'okr',
        name: 'keadaan-kosong',
        path: '/okr?keadaan=kosong',
        v: ['desktop'],
    },

    // F3-3 · Mesin fingerprint
    {
        mod: 'mesin-fingerprint',
        name: 'daftar',
        path: '/admin/mesin-absensi',
        as: 'hr',
        v: ALL,
    },
    {
        mod: 'mesin-fingerprint',
        name: 'detail',
        path: '/admin/mesin-absensi',
        as: 'hr',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /^Detail / })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'mesin-fingerprint',
        name: 'tambah',
        path: '/admin/mesin-absensi',
        as: 'hr',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Tambah mesin/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(400);
        },
    },
    {
        mod: 'mesin-fingerprint',
        name: 'tambah-adms',
        path: '/admin/mesin-absensi',
        as: 'hr',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Tambah mesin/ })
                .first()
                .click();
            await dialog(page);
            const form = page.getByRole('dialog');
            await form.getByLabel('Nomor seri (SN)').fill('CQZ7232460999');
            await form.getByLabel('Nama mesin').fill('Lobi Kantor Cabang');
            await form.getByLabel('Lokasi kantor').click();
            await page.getByRole('option').first().click();
            await form.getByRole('button', { name: 'Tambah mesin' }).click();
            await form
                .getByText('Nomor seri terdaftar')
                .first()
                .waitFor({ timeout: 8000 });
            await page.waitForTimeout(500);
        },
    },

    // SPKD · Dashboard per peran
    {
        mod: 'dashboard-peran',
        name: 'dirut',
        path: '/peran/dirut',
        as: 'direksi',
        v: ALL,
    },
    {
        mod: 'dashboard-peran',
        name: 'dirut-keputusan',
        path: '/peran/dirut',
        as: 'direksi',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page
                    .getByRole('button', {
                        name: mobile
                            ? /Putuskan DEP/
                            : /Putuskan perpanjangan DEP/,
                    })
                    .first(),
            );
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'dashboard-peran',
        name: 'direktur',
        path: '/peran/direktur',
        as: 'direksi',
        v: ['desktop', 'ponsel'],
    },
    {
        mod: 'dashboard-peran',
        name: 'direktur-setujui',
        path: '/peran/direktur',
        as: 'direksi',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Setujui 4 item/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    { mod: 'dashboard-peran', name: 'hr', path: '/peran/hr', as: 'hr', v: ALL },
    {
        mod: 'dashboard-peran',
        name: 'hr-cuti',
        path: '/peran/hr',
        as: 'hr',
        v: ['desktop', 'ponsel'],
        act: async (page, mobile) => {
            await click(
                page,
                mobile,
                page.getByRole('button', { name: /Tinjau cuti Sari/ }).first(),
            );
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'dashboard-peran',
        name: 'corsec',
        path: '/peran/corsec',
        v: ['desktop'],
    },
    {
        mod: 'dashboard-peran',
        name: 'corsec-disposisi',
        path: '/peran/corsec',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Disposisi surat/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'dashboard-peran',
        name: 'marketing',
        path: '/peran/marketing',
        v: ['desktop'],
    },
    {
        mod: 'dashboard-peran',
        name: 'marketing-review',
        path: '/peran/marketing',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Review brosur/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'dashboard-peran',
        name: 'programming',
        path: '/peran/programming',
        v: ALL,
    },
    {
        mod: 'dashboard-peran',
        name: 'programming-bug',
        path: '/peran/programming',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Tangani bug kritis/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'dashboard-peran',
        name: 'implementer',
        path: '/peran/implementer',
        v: ['desktop'],
    },
    {
        mod: 'dashboard-peran',
        name: 'implementer-tiket',
        path: '/peran/implementer',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Perbarui tiket P1/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
    {
        mod: 'dashboard-peran',
        name: 'analis',
        path: '/peran/analis',
        v: ['desktop'],
    },
    {
        mod: 'dashboard-peran',
        name: 'analis-uat',
        path: '/peran/analis',
        v: ['desktop'],
        act: async (page) => {
            await page
                .getByRole('button', { name: /Jalankan UAT SIMRS/ })
                .first()
                .click();
            await dialog(page);
            await page.waitForTimeout(500);
        },
    },
];

const IGNORE = /WebSocket|wss?:\/\/|reverb|status of 429|Too Many Requests/i;

async function signIn(browser, email) {
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        ...VARIANTS.desktop,
    });
    const page = await context.newPage();

    for (let attempt = 0; attempt < 10; attempt++) {
        await page.goto(`${BASE}/login`);
        const form = page
            .locator(`input[name=email][value="${email}"]`)
            .locator('xpath=ancestor::form');
        await form.locator('button').first().click();
        await page.waitForLoadState('networkidle').catch(() => {});
        if (!page.url().includes('/login')) {
            const state = await context.storageState();
            await context.close();
            return state;
        }
        console.log(`  login ${email} ditolak (mungkin 429), menunggu 15 dtk…`);
        await page.waitForTimeout(15000);
    }

    throw new Error(`Tidak bisa masuk sebagai ${email}`);
}

async function capture(page, file, full, mobile) {
    if (!full) {
        await page.screenshot({
            path: file,
            type: 'jpeg',
            quality: QUALITY,
            animations: 'disabled',
        });
        return;
    }
    // Grow the viewport to the page height (capped) instead of Playwright's
    // fullPage mode, so fixed chrome (MenuBar, Dock, tab bar) stays at the
    // top/bottom edge instead of floating over the middle of the page.
    const original = page.viewportSize();
    await page.evaluate(() => window.scrollTo(0, 0));
    const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
    );
    const cap = mobile ? MAX_HEIGHT_MOBILE : MAX_HEIGHT;
    await page.setViewportSize({
        width: original.width,
        height: Math.max(original.height, Math.min(height, cap)),
    });
    await page.waitForTimeout(700);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
        path: file,
        type: 'jpeg',
        quality: QUALITY,
        animations: 'disabled',
    });
    await page.setViewportSize(original);
}

const shots = SHOTS.filter(
    (shot) =>
        (!ONLY || ONLY.includes(shot.mod)) &&
        (!ONLY_SCREENS || ONLY_SCREENS.includes(shot.name)),
);
const browser = await chromium.launch();
const failures = [];
let written = 0;

for (const [key, email] of Object.entries(ACCOUNTS)) {
    const forAccount = shots.filter((shot) => (shot.as ?? 'kadiv') === key);
    if (forAccount.length === 0) continue;

    console.log(`Masuk sebagai ${email} (${forAccount.length} layar)`);
    const storageState = await signIn(browser, email);

    for (const [variant, options] of Object.entries(VARIANTS)) {
        const list = forAccount.filter((shot) => shot.v.includes(variant));
        if (list.length === 0) continue;

        const context = await browser.newContext({
            ignoreHTTPSErrors: true,
            locale: 'id-ID',
            timezoneId: 'Asia/Jakarta',
            permissions: ['clipboard-read', 'clipboard-write'],
            storageState,
            ...options,
        });
        const mobile = Boolean(options.isMobile);

        for (const shot of list) {
            const page = await context.newPage();
            const errors = [];
            page.on('pageerror', (error) => errors.push(error.message));
            page.on('console', (message) => {
                if (message.type() === 'error' && !IGNORE.test(message.text()))
                    errors.push(message.text().slice(0, 160));
            });

            const dir = path.join(OUT, shot.mod);
            fs.mkdirSync(dir, { recursive: true });
            const file = path.join(dir, `${shot.name}-${variant}.jpg`);
            const label = `${shot.mod}/${shot.name}-${variant}`;

            try {
                const response = await page.goto(BASE + shot.path);
                if (!response || response.status() !== 200)
                    throw new Error(`HTTP ${response?.status()}`);
                if (page.url().includes('/login'))
                    throw new Error('sesi berakhir');
                await page.waitForLoadState('networkidle').catch(() => {});
                await page.waitForTimeout(1200);
                if (shot.act) await shot.act(page, mobile);
                await capture(page, file, shot.full, mobile);
                const kb = Math.round(fs.statSync(file).size / 1024);
                written++;
                console.log(
                    `  ok ${label} (${kb} KB)${errors.length ? ` · galat: ${errors.join(' | ')}` : ''}`,
                );
            } catch (error) {
                failures.push(`${label}: ${error.message.split('\n')[0]}`);
                console.log(`  XX ${label}: ${error.message.split('\n')[0]}`);
            }
            await page.close();
        }
        await context.close();
    }
}

await browser.close();
console.log(`\n${written} gambar ditulis ke ${path.relative(ROOT, OUT)}`);
if (failures.length) {
    console.log(`${failures.length} gagal:\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
}
