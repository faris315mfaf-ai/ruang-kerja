// Uji cepat matematika peta Absen (fungsi murni).
// Jalankan: node scripts/cek-peta.mjs   (Node ≥ 22.18, type-stripping bawaan)
import assert from 'node:assert/strict';

import { jarakM, keDunia, meterPerPiksel, perluPerbarui, susunPeta } from '../src/features/absensi/petaMath.ts';

// Monas (-6.1754, 106.8272) pada zoom 17 → ubin x 104430, y 67 ribuan
const m = keDunia(-6.1754, 106.8272, 17);
assert.equal(Math.floor(m.x / 256), 104_430);
assert.ok(Math.floor(m.y / 256) > 67_500 && Math.floor(m.y / 256) < 68_000);
assert.ok(Math.abs(meterPerPiksel(0, 0) - 156_543.03392) < 1e-6);
assert.ok(Math.abs(meterPerPiksel(60, 10) - (156_543.03392 * 0.5) / 1024) < 1e-3);

const kantor = { latitude: -6.2, longitude: 106.8, radiusM: 100 };
const lebar = 360;
const tinggi = 168;

// Pengguna di titik kantor (radius 100 m dalam kartu 168 dp) → zoom 16 agar seluruh lingkaran terlihat; ubin menutupi kartu
const diKantor = susunPeta({ kantor, titik: { ...kantor, accuracy: 10 }, lebar, tinggi });
assert.equal(diKantor.zoom, 16);
assert.ok(Math.abs(diKantor.kantor.x - lebar / 2) < 0.01 && Math.abs(diKantor.kantor.y - tinggi / 2) < 0.01);
assert.ok(Math.abs(diKantor.kantor.r - 100 / meterPerPiksel(-6.2, 16)) < 0.01);
assert.ok(diKantor.ubin.length >= 6 && diKantor.ubin.length <= 20);
assert.ok(diKantor.ubin.every((u) => u.z === 17));
// Seluruh kartu tertutup ubin
const minL = Math.min(...diKantor.ubin.map((u) => u.left));
const maxR = Math.max(...diKantor.ubin.map((u) => u.left + u.size));
const minT = Math.min(...diKantor.ubin.map((u) => u.top));
const maxB = Math.max(...diKantor.ubin.map((u) => u.top + u.size));
assert.ok(minL <= 0 && maxR >= lebar && minT <= 0 && maxB >= tinggi);

// Pengguna ~700 m di timur → zoom turun, keduanya terlihat di dalam kartu
const timur = { latitude: -6.2, longitude: 106.8 + 700 / 110_540, accuracy: 20 };
assert.ok(Math.abs(jarakM(kantor, timur) - 700) < 5);
const r2 = susunPeta({ kantor, titik: timur, lebar, tinggi });
assert.ok(r2.zoom < 16 && r2.zoom >= 15);
assert.ok(r2.pengguna.x > 0 && r2.pengguna.x < lebar && !r2.pengguna.terpotong);
assert.ok(r2.kantor.x - r2.kantor.r >= 0 && r2.kantor.x + r2.kantor.r <= lebar);

// Pengguna 5 km jauhnya → dijepit di tepi, ditandai terpotong
const jauh = { latitude: -6.2, longitude: 106.8 + 5000 / 110_540, accuracy: 30 };
const r3 = susunPeta({ kantor, titik: jauh, lebar, tinggi });
assert.equal(r3.zoom, 15);
assert.equal(r3.pengguna.terpotong, true);
assert.ok(r3.pengguna.x <= lebar && r3.pengguna.y <= tinggi);

// Radius kecil (30 m) → zoom 17 dengan ubin zoom 18
const kecil = susunPeta({ kantor: { ...kantor, radiusM: 30 }, titik: { ...kantor, accuracy: 5 }, lebar, tinggi });
assert.equal(kecil.zoom, 17);
assert.ok(kecil.ubin.every((u) => u.z === 18));

// Tanpa kantor → berpusat di pengguna; tanpa keduanya → null
const tanpaKantor = susunPeta({ kantor: null, titik: { latitude: -6.2, longitude: 106.8, accuracy: 15 }, lebar, tinggi });
assert.equal(tanpaKantor.kantor, null);
assert.equal(tanpaKantor.pengguna.x, lebar / 2);
assert.equal(susunPeta({ kantor: null, titik: null, lebar, tinggi }), null);
assert.equal(susunPeta({ kantor, titik: null, lebar: 0, tinggi }), null);

// Tanpa titik pengguna: hanya kantor
assert.equal(susunPeta({ kantor, titik: null, lebar, tinggi }).pengguna, null);

// Pembatas pembaruan: bergeser ≤ 15 m diabaikan
const t0 = { latitude: -6.2, longitude: 106.8, accuracy: 10 };
assert.equal(perluPerbarui(t0, { ...t0, longitude: 106.8 + 8 / 110_540 }), false);
assert.equal(perluPerbarui(t0, { ...t0, longitude: 106.8 + 40 / 110_540 }), true);
assert.equal(perluPerbarui(t0, { ...t0, accuracy: 80 }), true);
assert.equal(perluPerbarui(null, t0), true);
assert.equal(perluPerbarui(null, null), false);

// Bujur antimeridian: indeks ubin x dibungkus
const sisi = susunPeta({ kantor: { latitude: 0, longitude: 179.9999, radiusM: 50 }, titik: null, lebar, tinggi });
assert.ok(sisi.ubin.every((u) => u.x >= 0 && u.x < 2 ** u.z));

console.log('cek-peta: OK');
