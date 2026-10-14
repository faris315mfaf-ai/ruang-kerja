'use no memo';
/**
 * Tampilan widget layar utama (mockup docs/mockups/android/screens/12-android-native/
 * 01-widget-checkin.html & 02-widget-tugas-rapat.html), digambar dengan primitif
 * `react-native-android-widget` (FlexWidget/TextWidget/SvgWidget).
 *
 * Aturan pustaka: komponen di sini fungsi biasa TANPA hook — pohonnya dibangun
 * (`buildWidgetTree`) dengan memanggil fungsinya langsung di proses tanpa UI.
 * "use no memo" mematikan React Compiler untuk berkas ini. Semua warna dari `Palet`
 * (turunan token tema), semua keadaan dari `keadaan.ts`.
 */
import { FlexWidget, SvgWidget, TextWidget, type FlexWidgetStyle } from 'react-native-android-widget';

import { fontFamily } from '@/theme/fonts';

import { AKSI_SEGARKAN, TAUTAN, jamWib, type BarisTugas, type KeadaanCheckIn, type KeadaanRapat, type KeadaanTugas } from './keadaan';
import { svgIkon, type NamaIkon } from './ikon';
import { redupkan, type Palet } from './palet';

// ── Klik ─────────────────────────────────────────────────────────────────────

interface Klik {
  clickAction: string;
  clickActionData?: Record<string, unknown>;
}

function bukaUri(uri: string): Klik {
  return { clickAction: 'OPEN_URI', clickActionData: { uri } };
}

const BUKA_APLIKASI: Klik = { clickAction: 'OPEN_APP' };
const SEGARKAN: Klik = { clickAction: AKSI_SEGARKAN };

// ── Primitif ─────────────────────────────────────────────────────────────────

function Teks({ t, ukuran, tebal, warna, baris = 1, tengah = false, spasi }: { t: string; ukuran: number; tebal: 400 | 500 | 600 | 700; warna: string; baris?: number; tengah?: boolean; spasi?: number }) {
  return (
    <TextWidget
      text={t}
      truncate="END"
      maxLines={baris}
      style={{
        fontSize: ukuran,
        fontFamily: fontFamily[tebal],
        color: warna as `#${string}`,
        ...(tengah ? { textAlign: 'center' as const } : {}),
        ...(spasi !== undefined ? { letterSpacing: spasi } : {}),
      }}
    />
  );
}

function Ikon({ nama, warna, ukuran }: { nama: NamaIkon; warna: string; ukuran: number }) {
  return <SvgWidget svg={svgIkon(nama, warna)} style={{ width: ukuran, height: ukuran }} />;
}

function Lingkaran({ ukuran, latar, gradien, p, children }: { ukuran: number; latar?: string; gradien?: boolean; p: Palet; children?: React.JSX.Element }) {
  return (
    <FlexWidget
      style={{
        width: ukuran,
        height: ukuran,
        borderRadius: ukuran / 2,
        alignItems: 'center',
        justifyContent: 'center',
        ...(gradien === true ? { backgroundGradient: { from: p.aksi[0] as `#${string}`, to: p.aksi[1] as `#${string}`, orientation: 'TL_BR' as const } } : { backgroundColor: (latar ?? p.permukaan2) as `#${string}` }),
      }}
    >
      {children}
    </FlexWidget>
  );
}

/** Pil tombol 44 dp ("Gabung", "Detail", "Segarkan", "Masuk"). */
function Pil({ label, menonjol, p, klik }: { label: string; menonjol: boolean; p: Palet; klik?: Klik }) {
  return (
    <FlexWidget
      {...klik}
      accessibilityLabel={klik ? label : undefined}
      style={{
        height: 44,
        borderRadius: 22,
        paddingHorizontal: 16,
        alignItems: 'center',
        justifyContent: 'center',
        ...(menonjol ? { backgroundGradient: { from: p.aksi[0] as `#${string}`, to: p.aksi[1] as `#${string}`, orientation: 'TL_BR' as const } } : { backgroundColor: p.tautanLembut as `#${string}` }),
      }}
    >
      <Teks t={label} ukuran={15} tebal={700} warna={menonjol ? p.onAksi : p.tautan} />
    </FlexWidget>
  );
}

/** Rangka kartu widget (latar, garis tepi, sudut 28 dp). */
function Kartu({ p, klik, label, children, gaya }: { p: Palet; klik: Klik; label: string; children?: React.JSX.Element | (React.JSX.Element | false | null)[]; gaya?: FlexWidgetStyle }) {
  return (
    <FlexWidget
      {...klik}
      accessibilityLabel={label}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: p.kartu as `#${string}`,
        borderColor: p.kartuBorder as `#${string}`,
        borderWidth: 1,
        borderRadius: 28,
        ...gaya,
      }}
    >
      {children}
    </FlexWidget>
  );
}

// ── Check-in 2×1 ─────────────────────────────────────────────────────────────

/** Tinggi di bawah ini (dp): sembunyikan overline "ABSEN" agar tiga baris tidak terpotong. */
const RINGKAS_DP = 80;

export function WidgetCheckIn({ k, p, tinggi }: { k: KeadaanCheckIn; p: Palet; tinggi: number }) {
  const ringkas = tinggi > 0 && tinggi < RINGKAS_DP;
  const klik = k.segarkan ? SEGARKAN : k.bukaAplikasi ? BUKA_APLIKASI : bukaUri(TAUTAN.absen);
  const warnaIkon = k.menonjol ? p.onAksi : k.jenis === 'pulang' || k.jenis === 'libur' ? p.teksSamar : p.teks;
  return (
    <Kartu p={p} klik={klik} label={k.label} gaya={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 12, paddingVertical: 6 }}>
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
        {ringkas ? null : <Teks t="ABSEN" ukuran={12} tebal={700} warna={p.tautan} spasi={0.8} />}
        <Teks t={k.judul} ukuran={16} tebal={700} warna={p.teks} />
        <Teks t={k.sub} ukuran={13} tebal={500} warna={p.teksRedam} />
      </FlexWidget>
      <FlexWidget style={{ marginLeft: 8 }}>
        <Lingkaran ukuran={44} gradien={k.menonjol} p={p}>
          <Ikon nama={k.ikon} warna={warnaIkon} ukuran={22} />
        </Lingkaran>
      </FlexWidget>
    </Kartu>
  );
}

// ── Tugas hari ini 4×2 ───────────────────────────────────────────────────────

function Cincin({ baris, p }: { baris: BarisTugas; p: Palet }) {
  if (baris.selesai) {
    return (
      <Lingkaran ukuran={22} latar={p.sukses} p={p}>
        <Ikon nama="check" warna={p.onAksi} ukuran={14} />
      </Lingkaran>
    );
  }
  const warna = baris.cincin === 'bahaya' ? p.bahaya : baris.cincin === 'peringatan' ? p.peringatan : baris.cincin === 'primer' ? p.primer : p.garisKuat;
  return <FlexWidget style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: warna as `#${string}` }} />;
}

function BarisTugasView({ baris, p }: { baris: BarisTugas; p: Palet }) {
  const warnaMeta = baris.nadaMeta === 'bahaya' ? p.bahaya : baris.nadaMeta === 'sukses' ? p.sukses : p.teksRedam;
  return (
    <FlexWidget
      {...bukaUri(TAUTAN.detailTugas(baris.id))}
      accessibilityLabel={`${baris.selesai ? 'Selesai: ' : ''}${baris.judul}, ${baris.meta}. Buka tugas.`}
      style={{ width: 'match_parent', height: 44, flexDirection: 'row', alignItems: 'center' }}
    >
      <Cincin baris={baris} p={p} />
      <FlexWidget style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
        <Teks t={baris.judul} ukuran={15} tebal={600} warna={baris.selesai ? p.teksSamar : p.teks} />
      </FlexWidget>
      <Teks t={baris.meta} ukuran={13} tebal={600} warna={warnaMeta} />
    </FlexWidget>
  );
}

function Chip({ t, tinggi, p }: { t: string; tinggi: number; p: Palet }) {
  return (
    <FlexWidget style={{ height: tinggi, borderRadius: tinggi / 2, paddingHorizontal: tinggi >= 28 ? 10 : 8, marginLeft: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: p.permukaan2 as `#${string}` }}>
      <Teks t={t} ukuran={tinggi >= 28 ? 13 : 12} tebal={700} warna={p.teksRedam} />
    </FlexWidget>
  );
}

function BadanKeadaan({ ikon, nadaLembut, warnaIkon, judul, sub, p, tombol }: { ikon: NamaIkon; nadaLembut: string; warnaIkon: string; judul: string; sub: string; p: Palet; tombol?: boolean }) {
  return (
    <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <Lingkaran ukuran={44} latar={nadaLembut} p={p}>
        <Ikon nama={ikon} warna={warnaIkon} ukuran={24} />
      </Lingkaran>
      <FlexWidget style={{ marginTop: 6 }}>
        <Teks t={judul} ukuran={16} tebal={700} warna={p.teks} tengah />
      </FlexWidget>
      {sub !== '' ? <Teks t={sub} ukuran={13} tebal={500} warna={p.teksRedam} tengah /> : null}
      {tombol === true ? (
        <FlexWidget style={{ marginTop: 8 }}>
          <Pil label="Masuk" menonjol p={p} klik={BUKA_APLIKASI} />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

export function WidgetTugas({ k, p }: { k: KeadaanTugas; p: Palet }) {
  const klik: Klik = k.jenis === 'sesi' ? BUKA_APLIKASI : k.jenis === 'tanpaData' ? SEGARKAN : bukaUri(TAUTAN.tabTugas);
  // Data lama: baris cache diredupkan (padanan `opacity: .55` mockup), kepala tetap jelas.
  const pb = k.lama !== null ? redupkan(p) : p;
  const hitungan = k.selesai !== null && k.total !== null && k.total > 0 ? `${k.selesai}/${k.total}` : null;
  return (
    <Kartu p={p} klik={klik} label={k.label} gaya={{ flexDirection: 'column', paddingHorizontal: 18, paddingTop: 12, paddingBottom: k.tersembunyi > 0 || k.lama !== null ? 4 : 10 }}>
      <FlexWidget style={{ width: 'match_parent', height: 28, flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
        <Lingkaran ukuran={28} latar={p.tautanLembut} p={p}>
          <Ikon nama="list-checks" warna={p.tautan} ukuran={16} />
        </Lingkaran>
        <FlexWidget {...bukaUri(TAUTAN.tabTugas)} accessibilityLabel="Tugas hari ini. Buka tab Tugas." style={{ flex: 1, marginLeft: 8 }}>
          <Teks t="Tugas hari ini" ukuran={16} tebal={700} warna={p.teks} />
        </FlexWidget>
        <Chip t={k.segmenLabel} tinggi={28} p={p} />
        {hitungan !== null ? <Chip t={hitungan} tinggi={24} p={p} /> : null}
      </FlexWidget>
      {k.jenis === 'normal' ? (
        <FlexWidget style={{ width: 'match_parent', flexDirection: 'column' }}>
          {k.baris.map((b) => (
            <BarisTugasView key={b.id} baris={b} p={pb} />
          ))}
          {k.tersembunyi > 0 ? (
            <FlexWidget {...bukaUri(TAUTAN.tabTugas)} accessibilityLabel={`${k.tersembunyi} tugas lagi. Buka tab Tugas.`} style={{ width: 'match_parent', height: 16, justifyContent: 'center' }}>
              <Teks t={`+${k.tersembunyi} lagi`} ukuran={13} tebal={700} warna={p.tautan} />
            </FlexWidget>
          ) : null}
        </FlexWidget>
      ) : null}
      {k.jenis === 'semuaSelesai' ? <BadanKeadaan ikon="check" nadaLembut={p.suksesLembut} warnaIkon={p.sukses} judul={k.judul} sub={k.sub} p={p} /> : null}
      {k.jenis === 'kosong' ? <BadanKeadaan ikon="calendar-check" nadaLembut={p.tautanLembut} warnaIkon={p.tautan} judul={k.judul} sub={k.sub} p={p} /> : null}
      {k.jenis === 'sesi' ? <BadanKeadaan ikon="lock" nadaLembut={p.permukaan2} warnaIkon={p.teksRedam} judul={k.judul} sub={k.sub} p={p} tombol /> : null}
      {k.jenis === 'tanpaData' ? <BadanKeadaan ikon="cloud-off" nadaLembut={p.permukaan2} warnaIkon={p.teksRedam} judul={k.judul} sub={k.sub} p={p} /> : null}
      {k.lama !== null && k.jenis !== 'tanpaData' ? (
        <FlexWidget {...SEGARKAN} accessibilityLabel="Belum diperbarui. Ketuk untuk menyegarkan." style={{ width: 'match_parent', height: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Ikon nama="cloud-off" warna={p.teksRedam} ukuran={14} />
          <FlexWidget style={{ flex: 1, marginLeft: 6 }}>
            <Teks t={`Belum diperbarui · terakhir ${k.lama.ts !== null ? jamWib(k.lama.ts) : '—'} · ketuk untuk segarkan`} ukuran={12} tebal={500} warna={p.teksRedam} />
          </FlexWidget>
        </FlexWidget>
      ) : null}
    </Kartu>
  );
}

// ── Rapat berikutnya 4×1 ─────────────────────────────────────────────────────

/** Tinggi di bawah ini (dp): sembunyikan overline/chip agar tiga baris tidak terpotong. */
const RINGKAS_RAPAT_DP = 84;

export function WidgetRapat({ k, p, tinggi }: { k: KeadaanRapat; p: Palet; tinggi: number }) {
  const ringkas = tinggi > 0 && tinggi < RINGKAS_RAPAT_DP;
  const klik: Klik = k.segarkanKartu ? SEGARKAN : k.bukaAplikasi ? BUKA_APLIKASI : k.tautanKartu !== null ? bukaUri(k.tautanKartu) : BUKA_APLIKASI;
  const berlangsung = k.jenis === 'berlangsung';
  const aksiKlik: Klik | undefined = k.aksi === null ? undefined : k.aksi.segarkan ? SEGARKAN : k.aksi.tautan !== null ? bukaUri(k.aksi.tautan) : BUKA_APLIKASI;
  const sub = ringkas && k.chip !== null ? `Berlangsung · ${k.sub}` : k.sub;
  return (
    <Kartu p={p} klik={klik} label={k.label} gaya={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6 }}>
      <FlexWidget
        style={{
          width: 48,
          height: 48,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          ...(berlangsung ? { backgroundGradient: { from: p.aksi[0] as `#${string}`, to: p.aksi[1] as `#${string}`, orientation: 'TL_BR' as const } } : { backgroundColor: p.tautanLembut as `#${string}` }),
        }}
      >
        <Ikon nama={k.ikon} warna={berlangsung ? p.onAksi : p.tautan} ukuran={24} />
      </FlexWidget>
      <FlexWidget style={{ flex: 1, marginLeft: 12, marginRight: 8, flexDirection: 'column', justifyContent: 'center' }}>
        {ringkas ? null : k.chip !== null ? (
          <FlexWidget style={{ height: 20, borderRadius: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: p.suksesLembut as `#${string}` }}>
            <Teks t={k.chip} ukuran={12} tebal={700} warna={p.sukses} />
          </FlexWidget>
        ) : k.overline !== null ? (
          <Teks t={k.overline.toUpperCase()} ukuran={12} tebal={700} warna={p.tautan} spasi={0.8} />
        ) : null}
        <Teks t={k.judul} ukuran={16} tebal={700} warna={p.teks} />
        <Teks t={sub} ukuran={13} tebal={500} warna={p.teksRedam} />
      </FlexWidget>
      {k.aksi !== null ? <Pil label={k.aksi.label} menonjol={k.aksi.menonjol} p={p} klik={aksiKlik} /> : null}
    </Kartu>
  );
}
