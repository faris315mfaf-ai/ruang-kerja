/**
 * Data detail tugas: tugas penuh (izin `can` dipertahankan bila respons tak
 * membawanya), komentar (lama → baru, "muat sebelumnya"), pembaca komentar,
 * polling 30 dtk saat layar fokus, dan penandaan baca (debounce).
 */
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  daftarKomentar,
  detailTugasPenuh,
  dibacaOleh,
  tandaiKomentarDibaca,
  type DetailTugasPenuh,
  type HalamanKomentar,
  type KomentarTugas,
  type PembacaKomentar,
} from '@/api/tugas';

import { onAntrean } from '@/offline';
import type { StatusSinkronUi } from '@/offline/ChipMenunggu';
import { eIdSementara, tugasIdItem } from '@/offline/fitur/tugasBersama';
import { detailDariBuat, komentarLokalKeTugas, terapkanDetail, useOverlayTugas } from '@/offline/fitur/tugasOverlay';

import { pesanGalat } from './util';

export interface GalatDetail {
  pesan: string;
  status: number;
}

function urut(a: KomentarTugas, b: KomentarTugas): number {
  const ta = a.created_at ?? '';
  const tb = b.created_at ?? '';
  return ta === tb ? (a.id < b.id ? -1 : 1) : ta < tb ? -1 : 1;
}

export function gabungKomentar(lama: KomentarTugas[], baru: KomentarTugas[]): KomentarTugas[] {
  const peta = new Map(lama.map((k) => [k.id, k]));
  for (const k of baru) {
    peta.set(k.id, k);
  }
  return [...peta.values()].sort(urut);
}

export function useDetailTugas(id: string | undefined): {
  t: DetailTugasPenuh | null;
  terapkan: (baru: DetailTugasPenuh) => void;
  ubahLokal: (fn: (t: DetailTugasPenuh) => DetailTugasPenuh) => void;
  memuat: boolean;
  galat: GalatDetail | null;
  hilang: boolean;
  basi: boolean;
  muat: () => Promise<void>;
  komentar: KomentarTugas[];
  setKomentar: React.Dispatch<React.SetStateAction<KomentarTugas[]>>;
  metaKomentar: HalamanKomentar['meta'] | null;
  bisaKomentar: boolean;
  memuatKomentar: boolean;
  galatKomentar: string | null;
  muatKomentarLama: () => Promise<void>;
  muatKomentarBaru: () => Promise<void>;
  pembaca: PembacaKomentar[];
  melacakBaca: boolean;
  muatPembaca: () => Promise<void>;
  masihAdaLama: boolean;
  memuatLama: boolean;
  /** Tugas sementara (dibuat offline, belum ada di server). */
  sementara: boolean;
  /** Perubahan di HP untuk tugas ini belum diterima server. */
  sinkron: StatusSinkronUi | null;
  pesanGagal: string | null;
} {
  const [t, setT] = useState<DetailTugasPenuh | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<GalatDetail | null>(null);
  const [hilang, setHilang] = useState(false);
  const [basi, setBasi] = useState(false);
  const [komentar, setKomentar] = useState<KomentarTugas[]>([]);
  const [meta, setMeta] = useState<HalamanKomentar['meta'] | null>(null);
  const [bisaKomentar, setBisaKomentar] = useState(false);
  const [memuatKomentar, setMemuatKomentar] = useState(true);
  const [galatKomentar, setGalatKomentar] = useState<string | null>(null);
  const [halamanLama, setHalamanLama] = useState(1);
  const [memuatLama, setMemuatLama] = useState(false);
  const [pembaca, setPembaca] = useState<PembacaKomentar[]>([]);
  const [melacak, setMelacak] = useState(false);
  const sudahDitandai = useRef<string | null>(null);
  const sudahMuat = useRef(false);
  const tmp = eIdSementara(id);
  const ov = useOverlayTugas();
  const entri = id ? ov.per[id] : undefined;
  const itemBuat = tmp && id ? ov.buat.find((b) => b.tmpId === id) : undefined;

  const terapkan = useCallback((baru: DetailTugasPenuh): void => {
    setT((lama) => ({
      ...baru,
      can: baru.can ?? lama?.can ?? ({} as DetailTugasPenuh['can']),
      locked_reason: baru.locked_reason ?? lama?.locked_reason ?? ({} as DetailTugasPenuh['locked_reason']),
      banner: baru.banner === undefined ? (lama?.banner ?? null) : baru.banner,
    }));
  }, []);

  const ubahLokal = useCallback((fn: (t: DetailTugasPenuh) => DetailTugasPenuh): void => {
    setT((lama) => (lama ? fn(lama) : lama));
  }, []);

  const muat = useCallback(async (): Promise<void> => {
    if (!id) {
      setGalat({ pesan: 'Tugas tidak ditemukan.', status: 404 });
      setMemuat(false);
      return;
    }
    if (tmp) {
      // Tugas baru dari HP belum ada di server: tampilan berasal dari antrean.
      setMemuat(false);
      return;
    }
    const senyap = sudahMuat.current;
    if (!senyap) {
      setMemuat(true);
    }
    try {
      terapkan(await detailTugasPenuh(id));
      setGalat(null);
      setBasi(false);
      setHilang(false);
      sudahMuat.current = true;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : -1;
      if (status === 404 && senyap) {
        setHilang(true);
      } else if (senyap && status === 0) {
        setBasi(true);
      } else if (!senyap) {
        setGalat({ pesan: pesanGalat(err, 'Tidak dapat memuat tugas.'), status });
      }
    } finally {
      setMemuat(false);
    }
  }, [id, tmp, terapkan]);

  const muatKomentarBaru = useCallback(async (): Promise<void> => {
    if (!id) {
      return;
    }
    if (tmp) {
      setMemuatKomentar(false);
      return;
    }
    try {
      const h = await daftarKomentar(id, 1);
      setMeta(h.meta);
      setBisaKomentar(h.can.comment);
      setKomentar((lama) => gabungKomentar(lama, h.comments));
      setGalatKomentar(null);
    } catch (err) {
      setGalatKomentar((lama) => (komentar.length === 0 ? pesanGalat(err, 'Tidak dapat memuat komentar.') : lama));
    } finally {
      setMemuatKomentar(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- komentar.length hanya untuk keputusan pesan galat
  }, [id, tmp]);

  const muatKomentarLama = useCallback(async (): Promise<void> => {
    if (!id || memuatLama) {
      return;
    }
    setMemuatLama(true);
    try {
      const h = await daftarKomentar(id, halamanLama + 1);
      setHalamanLama(h.meta.current_page);
      setKomentar((lama) => gabungKomentar(lama, h.comments));
    } catch (err) {
      setGalatKomentar(pesanGalat(err, 'Tidak dapat memuat komentar sebelumnya.'));
    } finally {
      setMemuatLama(false);
    }
  }, [id, halamanLama, memuatLama]);

  const muatPembaca = useCallback(async (): Promise<void> => {
    if (!id || tmp) {
      return;
    }
    try {
      const h = await dibacaOleh(id);
      setPembaca(h.readers);
      setMelacak(h.tracking);
    } catch {
      // Pembaca hanya pelengkap tampilan.
    }
  }, [id, tmp]);

  useEffect(() => {
    void muat();
    void muatKomentarBaru();
    void muatPembaca();
  }, [muat, muatKomentarBaru, muatPembaca]);

  // Item antrean untuk tugas ini berhasil terkirim: sisipkan komentar asli lalu muat ulang senyap.
  useEffect(() => {
    if (!id || tmp) {
      return undefined;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lepas = onAntrean((p) => {
      if (p.tipe !== 'sukses' || !p.item.jenis.startsWith('tugas.') || tugasIdItem(p.item) !== id) {
        return;
      }
      if (p.item.jenis === 'tugas.komentar') {
        const c = (p.respons as { comment?: KomentarTugas } | null)?.comment;
        if (c) {
          setKomentar((lama) => gabungKomentar(lama, [c]));
        }
      }
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        void muat();
        void muatKomentarBaru();
      }, 250);
    });
    return () => {
      lepas();
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [id, tmp, muat, muatKomentarBaru]);

  // Polling 30 detik saat layar fokus.
  useFocusEffect(
    useCallback(() => {
      if (tmp) {
        return undefined;
      }
      const timer = setInterval(() => {
        void muat();
        void muatKomentarBaru();
        void muatPembaca();
      }, 30_000);
      return () => clearInterval(timer);
    }, [tmp, muat, muatKomentarBaru, muatPembaca]),
  );

  // Tandai baca (debounce 1,5 dtk) bila komentar terbaru belum dicatat.
  const bolehLacak = !tmp && t?.can.track_reads === true;
  const terbaru = komentar.length > 0 ? (komentar[komentar.length - 1] as KomentarTugas).id : null;
  useEffect(() => {
    if (!id || !bolehLacak || !terbaru || sudahDitandai.current === terbaru) {
      return undefined;
    }
    const timer = setTimeout(() => {
      sudahDitandai.current = terbaru;
      void tandaiKomentarDibaca(id, terbaru)
        .then(() => muatPembaca())
        .catch(() => {
          sudahDitandai.current = null;
        });
    }, 1500);
    return () => clearTimeout(timer);
  }, [id, bolehLacak, terbaru, muatPembaca]);

  const tTampil = useMemo(() => {
    if (tmp) {
      return itemBuat ? detailDariBuat(itemBuat, entri) : null;
    }
    return t ? terapkanDetail(t, entri) : null;
  }, [tmp, itemBuat, entri, t]);
  const komentarLokal = useMemo(() => (entri?.komentar ?? []).map((k) => komentarLokalKeTugas(k, entri?.komentarSinkron ?? 'menunggu')), [entri]);
  const komentarTampil = useMemo(() => (komentarLokal.length > 0 ? [...komentar, ...komentarLokal] : komentar), [komentar, komentarLokal]);
  const sinkron: StatusSinkronUi | null = itemBuat?.sinkron === 'gagal' || entri?.sinkron === 'gagal' ? 'gagal' : (itemBuat?.sinkron ?? entri?.sinkron ?? null);
  const galatTampil: GalatDetail | null = tmp && !tTampil ? { pesan: 'Tugas baru ini sudah dikirim atau dibuang dari antrean.', status: 404 } : galat;

  return {
    t: tTampil,
    terapkan,
    ubahLokal,
    memuat: tmp ? false : memuat,
    galat: galatTampil,
    hilang,
    basi,
    muat,
    komentar: komentarTampil,
    setKomentar,
    metaKomentar: meta,
    bisaKomentar,
    memuatKomentar,
    galatKomentar,
    muatKomentarLama,
    muatKomentarBaru,
    pembaca,
    melacakBaca: melacak,
    muatPembaca,
    masihAdaLama: meta !== null && halamanLama < meta.last_page,
    memuatLama,
    sementara: tmp,
    sinkron,
    pesanGagal: itemBuat?.pesanGagal ?? entri?.pesanGagal ?? null,
  };
}
