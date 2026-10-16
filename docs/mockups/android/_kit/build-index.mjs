#!/usr/bin/env node
/**
 * Builds docs/mockups/android/INDEX.md, gallery.html and spec/PERTANYAAN-PEMILIK.md
 * from screens/ and spec/. Run: node docs/mockups/android/_kit/build-index.mjs
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const screens = join(root, 'screens');
const modules = readdirSync(screens).filter((d) => statSync(join(screens, d)).isDirectory()).sort();

const rows = [];
let totalFiles = 0;
let totalFrames = 0;

for (const m of modules) {
    const files = readdirSync(join(screens, m)).filter((f) => f.endsWith('.html')).sort();
    const frames = files.reduce((n, f) => n + (readFileSync(join(screens, m, f), 'utf8').match(/class="phone[\s"]/g) || []).length, 0);
    totalFiles += files.length;
    totalFrames += frames;
    rows.push({ m, files, frames });
}

const specOf = (m) => (readdirSync(join(root, 'spec')).includes(`${m}.md`) ? `spec/${m}.md` : null);

let md = `# Indeks mockup Android — RuangKerja

Dibuat otomatis oleh \`_kit/build-index.mjs\` — jangan diedit tangan. Brief & aturan: [BRIEF.md](BRIEF.md). Galeri: [gallery.html](gallery.html) (buka di browser; tautan layar membuka terang & malam). Pertanyaan keputusan terkumpul: [spec/PERTANYAAN-PEMILIK.md](spec/PERTANYAAN-PEMILIK.md).

**${modules.length} modul · ${totalFiles} berkas HTML · ${totalFrames} bingkai layar** (tiap bingkai tersedia terang & malam lewat \`?tema=malam\`).

Render PNG: \`node docs/mockups/android/_kit/render.mjs [modul]\` → \`png/<modul>/<layar>-{terang,malam}.png\` (tidak di-commit).

| Modul | Berkas | Bingkai | Spesifikasi |
|---|---:|---:|---|
`;
for (const r of rows) md += `| ${r.m} | ${r.files.length} | ${r.frames} | ${specOf(r.m) ? `[${r.m}.md](${specOf(r.m)})` : '—'} |\n`;
md += `\nCatatan: \`00-fondasi\` = demo kit; \`13-fondasi-desain\` = panduan gaya Android.\n`;
writeFileSync(join(root, 'INDEX.md'), md);

let html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Galeri mockup Android</title>
<style>body{font:15px/1.5 system-ui,sans-serif;margin:0;background:#f3f6fa;color:#0b1a2b}main{max-width:1100px;margin:0 auto;padding:24px}
h1{margin:0 0 4px}h2{margin:32px 0 8px;font-size:20px}table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden}
td{padding:8px 12px;border-top:1px solid #eef2f7}a{color:#09656e;text-decoration:none;margin-right:12px}.m{color:#46576b}</style></head><body><main>
<h1>Galeri mockup Android RuangKerja</h1><p class="m">${modules.length} modul · ${totalFiles} berkas · ${totalFrames} bingkai. Tiap tautan membuka layar; “malam” = mode gelap.</p>`;
for (const r of rows) {
    html += `<h2>${r.m} <span class="m">(${r.files.length} berkas, ${r.frames} bingkai)</span>${specOf(r.m) ? ` <a href="${specOf(r.m)}">spesifikasi</a>` : ''}</h2><table>`;
    for (const f of r.files) {
        const u = `screens/${r.m}/${f}`;
        html += `<tr><td>${f.replace(/\.html$/, '')}</td><td><a href="${u}">terang</a><a href="${u}?tema=malam">malam</a></td></tr>`;
    }
    html += `</table>`;
}
html += `</main></body></html>`;
writeFileSync(join(root, 'gallery.html'), html);

// Owner questions: take every section whose heading mentions "pertanyaan" up to the next heading of the same or higher level.
let q = `# Pertanyaan & keputusan untuk pemilik — mockup Android\n\nDikumpulkan otomatis dari bagian "Pertanyaan…" tiap spesifikasi (\`_kit/build-index.mjs\`). Jawaban Anda mengunci arah implementasi; urutan per modul.\n`;
for (const m of modules) {
    const sp = specOf(m);
    if (!sp) continue;
    const lines = readFileSync(join(root, sp), 'utf8').split('\n');
    const start = lines.findIndex((l) => /^#{2,4}\s.*pertanyaan/i.test(l));
    if (start === -1) continue;
    const level = lines[start].match(/^#+/)[0].length;
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
        const h = lines[i].match(/^(#+)\s/);
        if (h && h[1].length <= level) { end = i; break; }
    }
    q += `\n## ${m}\n\n${lines.slice(start + 1, end).join('\n').trim()}\n`;
}
writeFileSync(join(root, 'spec/PERTANYAAN-PEMILIK.md'), q);
console.log(`${modules.length} modul, ${totalFiles} berkas, ${totalFrames} bingkai`);
