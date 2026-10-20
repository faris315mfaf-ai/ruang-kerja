#!/usr/bin/env node
/**
 * Click-through of Absensi › Absen pegawai & Gaji (keputusan pemilik 20 Okt
 * 2026) against a running local site with demo accounts:
 *   1. HR opens an Alpha cell of another employee, chooses Izin, writes a
 *      reason, saves → the grid cell becomes "Izin · diatur HR".
 *   2. The same day is set back to Alpha (demo data stays as it was).
 *   3. Screens of the side sheet, the wage dialog and the phone bottom sheet.
 *
 *   E2E_BASE_URL=https://ruangkerja-hrgaji.test node tests/e2e/absen-pegawai-gaji.mjs
 *
 * Output: JSON summary + PNGs in storage/app/ui-shots/absen-pegawai/.
 */
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = (process.env.E2E_BASE_URL ?? 'https://ruangkerja.test').replace(
    /\/$/,
    '',
);
const outDir = resolve('storage/app/ui-shots/absen-pegawai');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const result = { steps: [] };
const step = (name, ok, extra = {}) => {
    result.steps.push({ name, ok, ...extra });

    if (!ok) {
        result.failed = name;
    }
};

async function signIn(account) {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    for (let attempt = 0; attempt < 8; attempt++) {
        await page.goto(`${base}/login`);
        await page
            .locator('form', {
                has: page.locator(`input[name="email"][value="${account}"]`),
            })
            .getByRole('button')
            .click();

        try {
            await page.waitForURL('**/dashboard', { timeout: 8000 });
            const state = await context.storageState();
            await context.close();

            return state;
        } catch {
            await page.waitForTimeout(10_000);
        }
    }

    throw new Error(`Gagal masuk sebagai ${account}`);
}

async function setStatus(page, label, status, reason) {
    await page.getByRole('button', { name: label, exact: true }).click();
    const group = page.getByRole('group', { name: 'Tetapkan status' });
    await group.waitFor();
    await group.getByRole('button', { name: status }).click();
    await page.getByLabel('Alasan (wajib)').fill(reason);
    await page.getByRole('button', { name: 'Simpan perubahan' }).click();
    await group.waitFor({ state: 'detached', timeout: 10_000 });
}

try {
    const hr = await signIn('hr@demo.test');
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: hr,
        viewport: { width: 1440, height: 900 },
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto(`${base}/absensi/pegawai`);
    await page.getByRole('heading', { name: 'Absen pegawai' }).waitFor();

    // An Alpha cell of someone else (HR cannot edit their own days).
    const me = await page.evaluate(() => {
        const raw =
            document.querySelector('script[data-page]')?.textContent ??
            document.getElementById('app')?.dataset.page ??
            '{}';

        return JSON.parse(raw)?.props?.auth?.user?.name ?? '';
    });
    const labels = await page
        .locator('section[aria-label^="Grid absensi"] button[aria-label]')
        .evaluateAll((buttons) =>
            buttons.map((button) => button.getAttribute('aria-label')),
        );
    const label = labels.find(
        (text) =>
            (text ?? '').endsWith(': Alpha') &&
            !(me && text?.startsWith(`${me},`)),
    );
    step('find Alpha cell', Boolean(label), { label, me });

    if (label) {
        await page.getByRole('button', { name: label, exact: true }).click();
        await page.getByRole('group', { name: 'Tetapkan status' }).waitFor();
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${outDir}/sheet-1440.png` });
        await page.keyboard.press('Escape');
        await page
            .getByRole('group', { name: 'Tetapkan status' })
            .waitFor({ state: 'detached' });

        await setStatus(
            page,
            label,
            'Izin',
            'Uji otomatis: surat izin diterima',
        );
        const izin = label.replace(/: Alpha$/, ': Izin · diatur HR');
        const changed = await page
            .getByRole('button', { name: izin, exact: true })
            .count();
        step('cell becomes Izin · diatur HR', changed === 1, { izin });
        await page.screenshot({ path: `${outDir}/grid-after-1440.png` });

        if (changed === 1) {
            await setStatus(
                page,
                izin,
                'Alpha',
                'Uji otomatis: kembalikan data demo',
            );
            const back = await page
                .getByRole('button', {
                    name: label.replace(/: Alpha$/, ': Alpha · diatur HR'),
                    exact: true,
                })
                .count();
            step('cell set back to Alpha', back === 1);
        }
    }

    // Gaji: wage dialog of the first row.
    await page.goto(`${base}/absensi/gaji`);
    await page.getByRole('heading', { name: /Gaji harian/ }).waitFor();
    const edit = page.getByRole('button', { name: /^Ubah upah / }).first();

    if ((await edit.count()) > 0) {
        await edit.click();
        await page.getByRole('heading', { name: 'Riwayat upah' }).waitFor();
        await page.waitForTimeout(600);
        await page.screenshot({ path: `${outDir}/wage-dialog-1440.png` });
        step('wage dialog opens', true);
        await page.keyboard.press('Escape');
    } else {
        step('wage dialog opens', false);
    }

    step('no page errors (desktop)', errors.length === 0, { errors });
    await context.close();

    // Phone: bottom sheet from the list.
    const phone = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: hr,
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        locale: 'id-ID',
        timezoneId: 'Asia/Jakarta',
    });
    const mobile = await phone.newPage();
    await mobile.goto(`${base}/absensi/pegawai`);
    const first = mobile.getByRole('button', { name: /Atur absensi$/ }).first();
    await first.waitFor();
    await first.click();
    await mobile.getByRole('group', { name: 'Tetapkan status' }).waitFor();
    await mobile.waitForTimeout(500);
    await mobile.screenshot({ path: `${outDir}/bottom-sheet-390.png` });
    step('phone bottom sheet opens', true);
    await phone.close();
} catch (error) {
    step('run', false, { error: String(error) });
} finally {
    await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.failed ? 1 : 0);
