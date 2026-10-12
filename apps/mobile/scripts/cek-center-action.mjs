// Uji cepat mesin keadaan tombol tengah tab bar (fungsi murni).
// Jalankan: node scripts/cek-center-action.mjs   (Node ≥ 22.18, type-stripping bawaan)
import assert from 'node:assert/strict';

import { CHECKOUT_LEAD_MINUTES, centerAction, nextCenterBoundary } from '../src/ui/centerAction.ts';

const end = '2026-10-13T10:00:00.000Z'; // jam pulang
const at = (offsetMenit) => new Date(Date.parse(end) + offsetMenit * 60_000);

assert.equal(CHECKOUT_LEAD_MINUTES, 60);
// Belum check-in / tidak diketahui / tak bisa absen → Absen
assert.equal(centerAction('check_in', end, at(-300)), 'absen');
assert.equal(centerAction(null, end, at(-300)), 'absen');
assert.equal(centerAction('unavailable', end, at(-300)), 'absen');
// Sudah check-in, jauh dari jam pulang → Workspace
assert.equal(centerAction('check_out', end, at(-300)), 'workspace');
assert.equal(centerAction('check_out', end, at(-61)), 'workspace');
// Jam pulang − 60 menit tercapai → Absen
assert.equal(centerAction('check_out', end, at(-60)), 'absen');
assert.equal(centerAction('check_out', end, at(30)), 'absen');
// Jam pulang tak diketahui → Workspace
assert.equal(centerAction('check_out', null, at(0)), 'workspace');
assert.equal(centerAction('check_out', 'bukan-tanggal', at(0)), 'workspace');
// Sudah check-out → Workspace
assert.equal(centerAction('done', end, at(-300)), 'workspace');
assert.equal(centerAction('done', end, at(60)), 'workspace');

// Pergantian terjadwal
assert.equal(nextCenterBoundary('check_out', end, at(-300))?.getTime(), at(-60).getTime());
assert.equal(nextCenterBoundary('check_out', end, at(-30)), null);
assert.equal(nextCenterBoundary('check_in', end, at(-300)), null);
assert.equal(nextCenterBoundary('done', end, at(-300)), null);

console.log('centerAction: semua pemeriksaan lolos');
