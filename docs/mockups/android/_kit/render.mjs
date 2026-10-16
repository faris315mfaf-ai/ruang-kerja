#!/usr/bin/env node
/**
 * Renders Android mockups to PNG (phone frames (412px wide by default, @2x)) in light and dark, and
 * reports missing icons and horizontal overflow.
 *
 *   node docs/mockups/android/_kit/render.mjs                       # everything
 *   node docs/mockups/android/_kit/render.mjs 03-absensi            # one module folder
 *   node docs/mockups/android/_kit/render.mjs 03-absensi/checkin    # files containing the text
 *   node docs/mockups/android/_kit/render.mjs 03-absensi --tema terang
 *
 * Output: docs/mockups/android/png/<module>/<screen>-{terang,malam}.png (gitignored).
 */
import { mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const temaIdx = args.indexOf('--tema');
const temaArg = temaIdx === -1 ? 'keduanya' : args[temaIdx + 1];
const filters = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--tema');
const temas = temaArg === 'keduanya' ? ['terang', 'malam'] : [temaArg];

function walk(dir) {
    return readdirSync(dir).flatMap((name) => {
        const p = join(dir, name);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.html') ? [p] : [];
    });
}

const files = walk(join(root, 'screens'))
    .filter((f) => filters.length === 0 || filters.some((x) => relative(join(root, 'screens'), f).includes(x)))
    .sort();

if (files.length === 0) {
    console.error('Tidak ada layar cocok.');
    process.exit(1);
}

const browser = await chromium.launch();
const problems = [];
let count = 0;

for (const file of files) {
    const rel = relative(join(root, 'screens'), file);
    const outDir = join(root, 'png', dirname(rel));
    mkdirSync(outDir, { recursive: true });
    const base = rel.replace(/\.html$/, '').split('/').pop();

    for (const tema of temas) {
        const ctx = await browser.newContext({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 2 });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.goto(`${pathToFileURL(file).href}?tema=${tema}`);
        await page.waitForSelector('html[data-siap="1"]');
        await page.evaluate(() => document.fonts.ready);
        const info = await page.evaluate(() => {
            const phones = [...document.querySelectorAll('.phone')];
            return {
                phones: phones.length,
                missingIcons: [...document.querySelectorAll('i[data-i]')].filter((i) => !i.firstChild).map((i) => i.dataset.i),
                overflow: phones.some((p) => p.scrollWidth > p.clientWidth + 1),
            };
        });
        if (info.phones === 0) problems.push(`${rel}: tidak ada .phone`);
        if (info.missingIcons.length) problems.push(`${rel}: ikon tidak ada → ${[...new Set(info.missingIcons)].join(', ')}`);
        if (info.overflow) problems.push(`${rel} (${tema}): konten melebar horizontal`);
        errors.forEach((e) => problems.push(`${rel}: JS error ${e}`));

        const phones = await page.$$('.phone');
        for (let i = 0; i < phones.length; i++) {
            const suffix = phones.length > 1 ? `-${i + 1}` : '';
            await phones[i].screenshot({ path: join(outDir, `${base}${suffix}-${tema}.png`) });
            count++;
        }
        await ctx.close();
    }
}

await browser.close();
console.log(`${count} PNG dari ${files.length} berkas.`);
if (problems.length) {
    console.log('\nMASALAH:\n- ' + problems.join('\n- '));
    process.exitCode = 2;
}
