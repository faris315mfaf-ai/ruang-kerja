#!/usr/bin/env node
/**
 * Membuat ulang aset ikon, splash, ikon notifikasi, dan draf aset Play dari
 * SVG/mockup (pengganti scripts/ikon.py). Butuh Playwright dari node_modules
 * akar repo (`npm install` di akar) dan `sips` (macOS) untuk membuang kanal
 * alfa gambar Play yang wajib 24-bit.
 *
 *   cd apps/mobile && node scripts/aset.mjs            # ikon + splash + notifikasi + Play
 *   node scripts/aset.mjs --tanpa-play                 # hanya aset aplikasi
 *
 * Geometri mengikuti docs/mockups/android/screens/12-android-native/25–28
 * (spec 12 §7): kanvas ikon adaptif 108 dp, tile putih 56 dp radius 14 di
 * tengah (zona aman 66 dp), rute = garis 4 dp + dua titik r 5,5 dp.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const mobile = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(mobile, '..', '..');
const { chromium } = createRequire(join(repo, 'package.json'))('playwright');
const tanpaPlay = process.argv.includes('--tanpa-play');

const AKSI = ['#0B7F86', '#1E5FD6'];
const AKSI_MALAM = ['#2DBFB1', '#5B8CF6'];
const gradien = (id, [a, b]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

// Tile + rute dalam koordinat kanvas 108.
const TILE = '<rect x="26" y="26" width="56" height="56" rx="14" fill="#fff"/>';
const RUTE =
  '<line x1="42" y1="66" x2="66" y2="42" stroke="#0B7F86" stroke-width="4" stroke-linecap="round"/>' +
  '<circle cx="41" cy="67" r="5.5" fill="#14B8A6"/><circle cx="67" cy="41" r="5.5" fill="#2F7BEA"/>';

const svg = (viewBox, isi) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="100%" height="100%">${isi}</svg>`;

const ASET = {
  // Ikon legacy (API < 26) & sumber ikon Play: latar penuh tanpa alfa.
  'assets/icon.png': [1024, svg('0 0 108 108', `<defs>${gradien('g', AKSI)}</defs><rect width="108" height="108" fill="url(#g)"/>${TILE}${RUTE}`)],
  'assets/adaptive-foreground.png': [1024, svg('0 0 108 108', TILE + RUTE)],
  'assets/adaptive-background.png': [1024, svg('0 0 108 108', `<defs>${gradien('g', AKSI)}</defs><rect width="108" height="108" fill="url(#g)"/>`)],
  // Monokrom (Android 13 ikon bertema): siluet tile, rute dilubangi.
  'assets/adaptive-monochrome.png': [
    1024,
    svg(
      '0 0 108 108',
      '<mask id="m"><rect width="108" height="108" fill="#000"/><rect x="26" y="26" width="56" height="56" rx="14" fill="#fff"/>' +
        '<line x1="42" y1="66" x2="66" y2="42" stroke="#000" stroke-width="4" stroke-linecap="round"/>' +
        '<circle cx="41" cy="67" r="5.5" fill="#000"/><circle cx="67" cy="41" r="5.5" fill="#000"/></mask>' +
        '<rect width="108" height="108" fill="#000" mask="url(#m)"/>',
    ),
  ],
  // Splash Android 12 opsi A: kanvas 288 dp tanpa latar ikon, lingkaran gradien 160 dp + tile 100 dp.
  'assets/splash-icon.png': [1024, splash(AKSI)],
  'assets/splash-icon-dark.png': [1024, splash(AKSI_MALAM)],
};

function splash(warna) {
  // viewBox 288: lingkaran r 80 di tengah; tile 100 (radius 25) berisi rute yang diskalakan dari kanvas 108.
  const s = 100 / 56;
  const geser = 144 - 54 * s;
  return svg(
    '0 0 288 288',
    `<defs>${gradien('g', warna)}</defs><circle cx="144" cy="144" r="80" fill="url(#g)"/>` +
      `<g transform="translate(${geser} ${geser}) scale(${s})">${TILE}${RUTE}</g>`,
  );
}

// Ikon notifikasi kecil: siluet rute putih + alfa, kanvas 24 dp dengan area aktif 20 dp.
const NOTIF = svg(
  '0 0 24 24',
  '<line x1="6.6" y1="17.4" x2="17.4" y2="6.6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>' +
    '<circle cx="6.2" cy="17.8" r="3.2" fill="#fff"/><circle cx="17.8" cy="6.2" r="3.2" fill="#fff"/>',
);
const NOTIF_DPI = { mdpi: 24, hdpi: 36, xhdpi: 48, xxhdpi: 72, xxxhdpi: 96 };

const browser = await chromium.launch();

async function render(path, ukuran, markup) {
  const page = await browser.newPage({ viewport: { width: ukuran, height: ukuran }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  mkdirSync(dirname(join(mobile, path)), { recursive: true });
  await page.screenshot({ path: join(mobile, path), omitBackground: true, clip: { x: 0, y: 0, width: ukuran, height: ukuran } });
  await page.close();
  console.log(`ok  ${path} (${ukuran}×${ukuran})`);
}

for (const [path, [ukuran, markup]] of Object.entries(ASET)) {
  await render(path, ukuran, markup);
}
await render('assets/notification-icon.png', 96, NOTIF);
for (const [dpi, px] of Object.entries(NOTIF_DPI)) {
  await render(`assets/notification-icon-${dpi}.png`, px, NOTIF);
}

/** PNG 24-bit (tanpa alfa) lewat JPEG berkualitas tinggi → PNG. */
function tanpaAlfa(path) {
  const jpg = path.replace(/\.png$/, '.tmp.jpg');
  execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '100', path, '--out', jpg], { stdio: 'ignore' });
  execFileSync('sips', ['-s', 'format', 'png', jpg, '--out', path], { stdio: 'ignore' });
  rmSync(jpg);
}

if (!tanpaPlay) {
  const play = join(mobile, 'store', 'play');
  mkdirSync(play, { recursive: true });

  // Ikon Play 512 × 512 (latar penuh; Play memberi sudut sendiri).
  await render('store/play/icon-512.png', 512, ASET['assets/icon.png'][1]);
  tanpaAlfa(join(play, 'icon-512.png'));

  const layar = join(repo, 'docs/mockups/android/screens/12-android-native');
  const ctx = await browser.newContext({ viewport: { width: 2600, height: 1400 }, deviceScaleFactor: 2 });

  /** `jpeg` = screenshot (Play menerima JPEG; jauh lebih kecil dari PNG 24-bit). */
  async function bingkai(berkas, keluaran, ukuranAkhir, jpeg = false) {
    const page = await ctx.newPage();
    await page.goto(`${pathToFileURL(join(layar, berkas)).href}?tema=terang`);
    await page.waitForSelector('html[data-siap="1"]');
    await page.evaluate(() => document.fonts.ready);
    const phones = page.locator('.phone');
    const n = await phones.count();
    for (let i = 0; i < n; i += 1) {
      const nama = keluaran(i);
      const tujuan = join(play, nama);
      await phones.nth(i).screenshot({ path: tujuan });
      if (ukuranAkhir) {
        execFileSync('sips', ['-z', String(ukuranAkhir[1]), String(ukuranAkhir[0]), tujuan, '--out', tujuan], { stdio: 'ignore' });
      }
      if (jpeg) {
        execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', tujuan, '--out', tujuan.replace(/\.png$/, '.jpg')], { stdio: 'ignore' });
        rmSync(tujuan);
      } else {
        tanpaAlfa(tujuan);
      }
      console.log(`ok  store/play/${jpeg ? nama.replace(/\.png$/, '.jpg') : nama}`);
    }
    await page.close();
  }

  // Feature graphic A & B: render ×2 lalu diperkecil ke 1024 × 500.
  await bingkai('28-play-feature-graphic.html', (i) => `feature-graphic-${'ab'[i] ?? i}.png`, [1024, 500]);
  // Screenshot ponsel (540×960 ×2 = 1080×1920) & tablet (1112×944 ×2 = 2224×1888) — draf dari mockup.
  await bingkai('29-play-screenshot-ponsel.html', (i) => `ponsel-${i + 1}.png`, undefined, true);
  await bingkai('30-play-screenshot-tablet.html', (i) => `tablet-${i + 1}.png`, undefined, true);
  await ctx.close();
}

await browser.close();
