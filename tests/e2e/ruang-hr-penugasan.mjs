#!/usr/bin/env node
/**
 * Click-through of Ruang HR › Penugasan (keputusan pemilik 20 Okt 2026)
 * against a running local site with demo accounts:
 *   1. HR fills "Tugaskan pegawai" for one employee (Rizky Aditya,
 *      anggota@demo.test) and submits → the task shows in the list.
 *   2. Rizky sees the task in Tugas saya.
 *   3. Another employee (Arif Nugroho, programmer@demo.test) does not see it
 *      on the Penugasan HR board nor in Tugas saya.
 *
 *   E2E_BASE_URL=https://ruangkerja-hrgaji.test node tests/e2e/ruang-hr-penugasan.mjs
 *
 * Leaves one task "E2E penugasan …" in the demo data. Output: JSON summary +
 * PNGs in storage/app/ui-shots/ruang-hr/.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = (process.env.E2E_BASE_URL ?? 'https://ruangkerja.test').replace(
    /\/$/,
    '',
);
const outDir = resolve('storage/app/ui-shots/ruang-hr');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const result = { steps: [] };
const step = (name, ok, extra = {}) => {
    result.steps.push({ name, ok, ...extra });

    if (!ok) {
        result.failed ??= name;
    }
};

async function signIn(account) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    for (let attempt = 0; attempt < 8; attempt++) {
        await page.goto(`${base}/login`);
        const form = page.locator('form', {
            has: page.locator(`input[name="email"][value="${account}"]`),
        });

        if ((await form.count()) === 0 && !page.url().endsWith('/login')) {
            break;
        }

        await form.getByRole('button').click();

        try {
            await page.waitForURL(
                (url) =>
                    url.pathname === '/dashboard' || url.pathname === '/hr',
                { timeout: 8000 },
            );
            const state = await context.storageState();
            await context.close();

            return state;
        } catch {
            await page.waitForTimeout(10_000);
        }
    }

    throw new Error(`Gagal masuk sebagai ${account}`);
}

async function open(state, path, width = 1440) {
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: state,
        viewport: { width, height: 900 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
    });
    const page = await context.newPage();
    const response = await page.goto(`${base}${path}`);
    await page.waitForLoadState('networkidle');

    return { context, page, status: response?.status() ?? 0 };
}

const title = `E2E penugasan ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`;

try {
    const hr = await signIn('hr@demo.test');
    const { context, page } = await open(hr, '/hr/penugasan');

    const board = await page
        .getByRole('link', { name: 'Buka board' })
        .getAttribute('href');
    step('board link', Boolean(board), { board });

    const form = page.locator('aside', {
        has: page.getByText('Tugaskan pegawai'),
    });
    await form.getByLabel('Judul tugas').fill(title);
    const combobox = form.getByRole('combobox', { name: 'Tambah penerima' });
    await combobox.click();
    await combobox.fill('Rizky Aditya');
    await form
        .getByRole('option', { name: /Rizky Aditya/ })
        .first()
        .click();
    const submit = form.getByRole('button', { name: /^Tugaskan 1 orang/ });
    step('submit enabled for 1 person', await submit.isEnabled());
    await page.screenshot({ path: `${outDir}/form-1440.png` });
    await submit.click();
    await page.getByText(title).first().waitFor({ timeout: 15_000 });
    step('task listed in Penugasan', true);
    await page.screenshot({ path: `${outDir}/list-1440.png`, fullPage: true });
    await context.close();

    const rizky = await signIn('anggota@demo.test');
    const mine = await open(rizky, '/tugas');
    const seen = await mine.page.getByText(title).count();
    step('recipient sees it in Tugas saya', seen > 0, { seen });
    await mine.page.screenshot({
        path: `${outDir}/rizky-tugas.png`,
        fullPage: true,
    });
    await mine.context.close();

    const arif = await signIn('programmer@demo.test');
    const other = await open(arif, board ?? '/w/PHR');
    const leaked = await other.page.getByText(title).count();
    step('other employee does not see it on the board', leaked === 0, {
        status: other.status,
        leaked,
    });
    await other.context.close();
    const otherMine = await open(arif, '/tugas');
    const leakedMine = await otherMine.page.getByText(title).count();
    step('other employee does not see it in Tugas saya', leakedMine === 0);
    await otherMine.context.close();
} catch (error) {
    step('exception', false, { error: String(error) });
} finally {
    await browser.close();
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.failed ? 1 : 0);
}
