/**
 * Layar "Segera hadir" bersama: dipakai setiap butir menu yang fiturnya belum
 * dibangun di aplikasi (tidak ada tombol mati). Dibuka lewat `bukaSegera()`
 * → rute `/segera` (app/segera.tsx).
 */
import { router } from 'expo-router';

import { Banner, Button, EmptyState, Screen, SubAppBar, type AnyIconName } from '@/ui';

import { useKirimTautan } from './useKirimTautan';

export interface ParamSegera {
  judul: string;
  /** Nama ikon Lucide untuk ubin. */
  ikon?: AnyIconName;
  /** Kalimat tambahan di bawah penjelasan baku. */
  catatan?: string;
  /** Path web (daftar putih server) bila fitur ada di desktop → tombol "Kirim tautan". */
  tautan?: string;
  /** `true` = fitur memang hanya ada di desktop (bukan "akan hadir"). */
  desktop?: boolean;
  /** Aksi lain yang sudah tersedia di aplikasi. */
  aksiJudul?: string;
  aksiRute?: string;
}

type ParamMentah = Record<string, string | string[] | undefined>;

function satu(nilai: string | string[] | undefined): string | undefined {
  return Array.isArray(nilai) ? nilai[0] : nilai;
}

export function bacaParamSegera(p: ParamMentah): ParamSegera {
  return {
    judul: satu(p.judul) ?? 'Fitur ini',
    ikon: (satu(p.ikon) as AnyIconName | undefined) ?? 'hourglass',
    catatan: satu(p.catatan),
    tautan: satu(p.tautan),
    desktop: satu(p.desktop) === '1',
    aksiJudul: satu(p.aksiJudul),
    aksiRute: satu(p.aksiRute),
  };
}

/** Buka layar "Segera hadir" untuk fitur yang belum ada di aplikasi. */
export function bukaSegera(param: ParamSegera): void {
  const params: Record<string, string> = { judul: param.judul };
  if (param.ikon) params.ikon = param.ikon;
  if (param.catatan) params.catatan = param.catatan;
  if (param.tautan) params.tautan = param.tautan;
  if (param.desktop) params.desktop = '1';
  if (param.aksiJudul) params.aksiJudul = param.aksiJudul;
  if (param.aksiRute) params.aksiRute = param.aksiRute;
  router.push({ pathname: '/segera', params });
}

export function ComingSoon({ judul, ikon = 'hourglass', catatan, tautan, desktop = false, aksiJudul, aksiRute }: ParamSegera): React.JSX.Element {
  const { kirim, mengirim } = useKirimTautan();
  return (
    <Screen header={<SubAppBar title={judul} />} contentStyle={{ paddingTop: 24 }}>
      <EmptyState
        icon={ikon}
        title={desktop ? 'Tersedia di desktop' : 'Segera hadir'}
        description={`${
          desktop
            ? `${judul} dikelola di RuangKerja versi desktop.`
            : `${judul} belum tersedia di aplikasi ponsel dan akan hadir di versi berikutnya.`
        }${catatan ? ` ${catatan}` : ''}`}
        variant="plain"
      />
      {aksiJudul && aksiRute ? <Button title={aksiJudul} variant="tonal" onPress={() => router.push(aksiRute as never)} /> : null}
      {tautan ? (
        <>
          <Banner
            tone="info"
            icon="monitor"
            message={desktop ? 'Buka tautan di komputer Anda untuk melanjutkan.' : 'Untuk sementara, fitur ini bisa dipakai di RuangKerja versi desktop.'}
          />
          <Button title="Kirim tautan ke email saya" variant="outline" icon="mail" loading={mengirim} onPress={() => void kirim(tautan)} />
        </>
      ) : null}
    </Screen>
  );
}
