/**
 * Logika form pengajuan (baru, ubah draf, revisi & kirim ulang): memuat jenis
 * + detail, pratinjau server ber-debounce, draf perangkat (SecureStore) untuk
 * form baru, simpan draf server (POST /draf, PATCH), kirim / kirim ulang,
 * lampiran (lokal sebelum ada id, langsung ke server sesudahnya), galat 422
 * per isian, jenis yang dikunci saat mengisi, dan keadaan offline.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError } from '@/api/client';
import {
  daftarJenis,
  detailPengajuan,
  hapusLampiran,
  kirimBaru,
  kirimDraf,
  kirimUlang,
  pratinjau as ambilPratinjau,
  simpanDrafBaru,
  ubahPengajuan,
  unggahLampiran,
  type BerkasLokal,
  type DaftarJenis,
  type DetailPengajuan,
  type ItemPengajuan,
  type JenisForm,
  type KategoriPengajuan,
  type Pratinjau,
} from '@/api/pengajuan';
import { useSession } from '@/session/SessionProvider';

import { jamKantor, kategoriDariSlug } from './format';
import type { ItemLampiran } from './Lampiran';
import { adaIsian, galatServer, keIsianServer, nilaiDariServer, nilaiKosong, periksaNilai, siapPratinjau, type NilaiForm } from './nilaiForm';
import { bacaDrafPerangkat, hapusDrafPerangkat, tandaiDaftarBerubah, tulisDrafPerangkat } from './simpanan';

export interface ParamForm {
  /** Id jenis (leave_type_id). */
  tipe?: string;
  /** Kode jenis (mis. KOR) atau slug kategori (koreksi, izin, …). */
  jenis?: string;
  /** Tanggal awal YYYY-MM-DD (pintu koreksi dari Absensi). */
  tanggal?: string;
  /** Pengajuan yang diubah (draf / perlu revisi). */
  id?: string;
}

export type HasilKirim = { ok: true; item: ItemPengajuan } | { ok: false };

let kunciLokal = 0;
const kunciBaru = (): string => `lokal-${Date.now()}-${(kunciLokal += 1)}`;

function cariJenis(data: DaftarJenis, p: ParamForm): JenisForm | null {
  const semua = data.categories.flatMap((c) => c.types);
  if (p.tipe) {
    return semua.find((t) => t.id === p.tipe) ?? null;
  }
  if (p.jenis) {
    const kode = semua.find((t) => t.code.toUpperCase() === p.jenis?.toUpperCase());
    if (kode) {
      return kode;
    }
    const kategori = kategoriDariSlug(p.jenis);
    const daftar = data.categories.find((c) => c.value === kategori)?.types ?? [];
    return daftar.find((t) => !t.locked && t.eligible) ?? daftar[0] ?? null;
  }
  return null;
}

function lampiranServer(detail: DetailPengajuan): ItemLampiran[] {
  return detail.attachments.map((a) => ({ jenis: 'server' as const, kunci: a.id, data: a }));
}

export function useFormPengajuan(param: ParamForm) {
  const { user } = useSession();
  const userId = user?.id ?? 'anon';
  const staf = user?.is_staff_only ?? true;

  const [dataJenis, setDataJenis] = useState<DaftarJenis | null>(null);
  const [jenis, setJenis] = useState<JenisForm | null>(null);
  const [detail, setDetail] = useState<DetailPengajuan | null>(null);
  const [requestId, setRequestId] = useState<string | null>(param.id ?? null);
  const [nilai, setNilai] = useState<NilaiForm>(() => nilaiKosong(param.tanggal ?? ''));
  const [awal, setAwal] = useState<NilaiForm>(() => nilaiKosong(param.tanggal ?? ''));
  const [lampiran, setLampiran] = useState<ItemLampiran[]>([]);
  const [memuat, setMemuat] = useState(true);
  const tanggalAwal = useRef(param.tanggal ?? '');
  const [galatMuat, setGalatMuat] = useState<ApiError | null>(null);

  const [pratinjau, setPratinjau] = useState<Pratinjau | null>(null);
  const [memuatPratinjau, setMemuatPratinjau] = useState(false);
  const [luring, setLuring] = useState(false);

  const [galat, setGalat] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ tone: 'bad' | 'warn' | 'info'; judul?: string; pesan: string } | null>(null);
  const [dipulihkan, setDipulihkan] = useState(false);
  const [terkunciServer, setTerkunciServer] = useState<string | null>(null);
  const [disimpanPada, setDisimpanPada] = useState<string | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [sibukLampiran, setSibukLampiran] = useState(false);

  const kategori: KategoriPengajuan | null = jenis?.category ?? null;
  const revisi = detail?.status === 'revision_requested';
  const terkunci = (jenis?.locked ?? false) || terkunciServer !== null;
  const lampiranLokal = useMemo(() => lampiran.flatMap((l) => (l.jenis === 'lokal' ? [l.berkas] : [])), [lampiran]);

  // ── Muat ──────────────────────────────────────────────────────────────────
  const muat = useCallback(async (): Promise<void> => {
    setMemuat(true);
    setGalatMuat(null);
    try {
      const data = await daftarJenis();
      setDataJenis(data);
      if (param.id) {
        const d = await detailPengajuan(param.id);
        setDetail(d);
        const tipe = data.categories.flatMap((c) => c.types).find((t) => t.id === d.type.id) ?? null;
        setJenis(
          tipe ?? {
            ...d.type,
            eligible: true,
            ineligible_reason: null,
            needs_substitute: d.type.category === 'leave',
            modes: d.type.category === 'permit' ? ['days', 'hours'] : null,
            fields: [],
          },
        );
        if (d.form) {
          const n = nilaiDariServer(d.form, d.substitute?.name ?? null);
          setNilai(n);
          setAwal(n);
        }
        setLampiran(lampiranServer(d));
        setDisimpanPada(jamKantor(d.updated_at));
      } else {
        const tipe = cariJenis(data, param);
        setJenis(tipe);
        // Form baru: tanggal bawaan = tanggal dari pintu masuk, atau hari ini (zona kantor dari server).
        tanggalAwal.current = param.tanggal ?? data.today;
        const kosong = nilaiKosong(tanggalAwal.current);
        setNilai(kosong);
        setAwal(kosong);
        if (tipe) {
          const lokal = await bacaDrafPerangkat(userId, tipe.category);
          // Pintu koreksi membawa tanggal sendiri: draf lama hanya dipulihkan bila tanggalnya sama.
          if (lokal && lokal.typeId === tipe.id && (!param.tanggal || lokal.nilai.date === param.tanggal || lokal.nilai.start_date === param.tanggal)) {
            setNilai(lokal.nilai);
            setDipulihkan(true);
          }
        }
      }
      setLuring(false);
    } catch (err) {
      const e = err instanceof ApiError ? err : new ApiError({ status: 500, message: 'Form tidak dapat dimuat.' });
      setGalatMuat(e);
    } finally {
      setMemuat(false);
    }
  }, [param, userId]);

  useEffect(() => {
    void muat();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sekali per layar
  }, []);

  // ── Pratinjau (debounce 400 ms) ───────────────────────────────────────────
  const isianPratinjau = useMemo(() => (jenis ? JSON.stringify(keIsianServer(jenis, nilai)) : ''), [jenis, nilai]);
  const versiPratinjau = useRef(0);
  const segarkanPratinjau = useCallback(async (): Promise<void> => {
    if (!jenis || !kategori || !siapPratinjau(kategori, jenis, nilai)) {
      setPratinjau(null);
      return;
    }
    const versi = (versiPratinjau.current += 1);
    setMemuatPratinjau(true);
    try {
      const hasil = await ambilPratinjau(keIsianServer(jenis, nilai), requestId);
      if (versi === versiPratinjau.current) {
        setPratinjau(hasil);
        setLuring(false);
      }
    } catch (err) {
      if (versi === versiPratinjau.current && err instanceof ApiError && err.status === 0) {
        setLuring(true);
      }
    } finally {
      if (versi === versiPratinjau.current) {
        setMemuatPratinjau(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isianPratinjau mewakili jenis+nilai
  }, [isianPratinjau, requestId]);

  useEffect(() => {
    if (memuat || !jenis) {
      return;
    }
    const t = setTimeout(() => void segarkanPratinjau(), 400);
    return () => clearTimeout(t);
  }, [memuat, jenis, segarkanPratinjau]);

  // ── Draf perangkat (form baru saja; debounce 500 ms) ──────────────────────
  const kotor = adaIsian(nilai, awal) || lampiranLokal.length > 0;
  useEffect(() => {
    if (memuat || !jenis || requestId || terkunci || !adaIsian(nilai, awal)) {
      return;
    }
    const t = setTimeout(() => {
      void tulisDrafPerangkat(userId, jenis.category, { typeId: jenis.id, nilai, savedAt: new Date().toISOString() });
    }, 500);
    return () => clearTimeout(t);
  }, [memuat, jenis, nilai, awal, requestId, terkunci, userId]);

  // ── Ubah isian ────────────────────────────────────────────────────────────
  const ubah = useCallback(<K extends keyof NilaiForm>(k: K, v: NilaiForm[K]): void => {
    setNilai((lama) => ({ ...lama, [k]: v }));
    setGalat((lama) => {
      if (!lama[k as string]) {
        return lama;
      }
      const baru = { ...lama };
      delete baru[k as string];
      return baru;
    });
  }, []);

  const gantiTipe = useCallback((t: JenisForm): void => {
    setJenis(t);
    setGalat({});
  }, []);

  const buangDrafPerangkat = useCallback(async (): Promise<void> => {
    if (jenis) {
      await hapusDrafPerangkat(userId, jenis.category);
    }
    const kosong = nilaiKosong(tanggalAwal.current);
    setNilai(kosong);
    setAwal(kosong);
    setDipulihkan(false);
  }, [jenis, userId]);

  // ── Galat 422 ─────────────────────────────────────────────────────────────
  const tanganiGalat = useCallback(
    async (err: unknown, tindakan: 'kirim' | 'draf'): Promise<void> => {
      if (!(err instanceof ApiError)) {
        setBanner({ tone: 'bad', pesan: 'Terjadi galat. Coba lagi.' });
        return;
      }
      if (err.status === 0) {
        setLuring(true);
        if (jenis && !requestId) {
          await tulisDrafPerangkat(userId, jenis.category, { typeId: jenis.id, nilai, savedAt: new Date().toISOString() });
        }
        setBanner({ tone: 'warn', judul: 'Anda sedang offline.', pesan: 'Draf tetap tersimpan di perangkat. Pengiriman butuh koneksi.' });
        return;
      }
      if (err.status === 422) {
        const peta = galatServer(err.errors);
        const pesanJenis = peta.leave_type_id;
        if (pesanJenis && /belum bisa diajukan/i.test(pesanJenis)) {
          setTerkunciServer(pesanJenis);
          if (jenis && !requestId) {
            await tulisDrafPerangkat(userId, jenis.category, { typeId: jenis.id, nilai, savedAt: new Date().toISOString() });
          }
          setBanner({ tone: 'bad', judul: 'Pengiriman ditolak.', pesan: `${pesanJenis} Isian disimpan di perangkat ini.` });
          return;
        }
        if (peta.status) {
          setBanner({ tone: 'bad', pesan: peta.status });
          return;
        }
        setGalat(peta);
        // Batas jam sakit/izin terlewati saat form terbuka: segarkan payload jenis agar "hari ini" terkunci.
        if (jenis && /batas pengajuan|sudah lewat/i.test(`${peta.start_date ?? ''} ${peta.date ?? ''}`)) {
          void daftarJenis()
            .then((d) => {
              setDataJenis(d);
              const baru = d.categories.flatMap((c) => c.types).find((t) => t.id === jenis.id);
              if (baru) {
                setJenis(baru);
              }
            })
            .catch(() => undefined);
        }
        const jumlah = Object.keys(peta).length;
        // Hanya batas jam: pesannya sudah tampil di isian tanggal + banner batas di form, jangan digandakan di atas.
        if (jumlah === 1 && /^batas pengajuan/i.test(peta.start_date ?? peta.date ?? '')) {
          setBanner(null);
          return;
        }
        const umum = jumlah === 0 ? err.message : null;
        setBanner({
          tone: 'bad',
          pesan: umum ?? (jumlah > 1 ? `Periksa ${jumlah} isian yang ditandai merah sebelum ${tindakan === 'kirim' ? 'mengirim' : 'menyimpan'}.` : (Object.values(peta)[0] ?? err.message)),
        });
        return;
      }
      setBanner({ tone: 'bad', pesan: err.message });
    },
    [jenis, nilai, requestId, userId],
  );

  // ── Lampiran ──────────────────────────────────────────────────────────────
  const tambahLampiran = useCallback(
    async (berkas: BerkasLokal[]): Promise<void> => {
      setGalat((g) => {
        const b = { ...g };
        delete b.attachments;
        return b;
      });
      if (requestId && !luring) {
        setSibukLampiran(true);
        try {
          const d = await unggahLampiran(requestId, berkas);
          setDetail(d);
          setLampiran((lama) => [...lampiranServer(d), ...lama.filter((l) => l.jenis === 'lokal')]);
        } catch (err) {
          if (err instanceof ApiError && err.status === 422) {
            setGalat((g) => ({ ...g, attachments: galatServer(err.errors).attachments ?? galatServer(err.errors).file ?? err.message }));
          } else if (err instanceof ApiError && err.status === 0) {
            setLuring(true);
            setLampiran((lama) => [...lama, ...berkas.map((b) => ({ jenis: 'lokal' as const, kunci: kunciBaru(), berkas: b }))]);
          } else {
            setGalat((g) => ({ ...g, attachments: err instanceof ApiError ? err.message : 'Lampiran gagal diunggah.' }));
          }
        } finally {
          setSibukLampiran(false);
        }
        return;
      }
      setLampiran((lama) => [...lama, ...berkas.map((b) => ({ jenis: 'lokal' as const, kunci: kunciBaru(), berkas: b }))]);
    },
    [luring, requestId],
  );

  const hapusSatuLampiran = useCallback(
    async (item: ItemLampiran): Promise<void> => {
      if (item.jenis === 'lokal' || !requestId) {
        setLampiran((lama) => lama.filter((l) => l.kunci !== item.kunci));
        return;
      }
      setSibukLampiran(true);
      try {
        const d = await hapusLampiran(requestId, item.data.id);
        setDetail(d);
        setLampiran((lama) => [...lampiranServer(d), ...lama.filter((l) => l.jenis === 'lokal')]);
      } catch (err) {
        setGalat((g) => ({ ...g, attachments: err instanceof ApiError ? err.message : 'Lampiran gagal dihapus.' }));
      } finally {
        setSibukLampiran(false);
      }
    },
    [requestId],
  );

  /** Unggah lampiran lokal yang tertunda ke pengajuan yang sudah punya id. */
  const unggahTertunda = useCallback(
    async (id: string): Promise<void> => {
      if (lampiranLokal.length === 0) {
        return;
      }
      const d = await unggahLampiran(id, lampiranLokal);
      setDetail(d);
      setLampiran(lampiranServer(d));
    },
    [lampiranLokal],
  );

  // ── Simpan draf ───────────────────────────────────────────────────────────
  const simpanDraf = useCallback(async (): Promise<boolean> => {
    if (!jenis || menyimpan || mengirim) {
      return false;
    }
    setBanner(null);
    if (luring) {
      if (!requestId) {
        await tulisDrafPerangkat(userId, jenis.category, { typeId: jenis.id, nilai, savedAt: new Date().toISOString() });
        return true;
      }
      setBanner({ tone: 'warn', judul: 'Anda sedang offline.', pesan: 'Perubahan draf ini baru bisa disimpan saat terhubung.' });
      return false;
    }
    setMenyimpan(true);
    try {
      const isian = keIsianServer(jenis, nilai);
      let d: DetailPengajuan;
      if (requestId) {
        d = await ubahPengajuan(requestId, isian);
        await unggahTertunda(requestId);
      } else {
        d = await simpanDrafBaru(isian, lampiranLokal);
        setRequestId(d.id);
        setLampiran(lampiranServer(d));
        await hapusDrafPerangkat(userId, jenis.category);
        setDipulihkan(false);
      }
      setDetail(d);
      setAwal(nilai);
      setGalat({});
      setDisimpanPada(jamKantor(new Date().toISOString()));
      tandaiDaftarBerubah();
      return true;
    } catch (err) {
      await tanganiGalat(err, 'draf');
      return false;
    } finally {
      setMenyimpan(false);
    }
  }, [jenis, menyimpan, mengirim, luring, requestId, userId, nilai, unggahTertunda, lampiranLokal, tanganiGalat]);

  // ── Kirim ─────────────────────────────────────────────────────────────────
  const kirim = useCallback(async (): Promise<HasilKirim> => {
    if (!jenis || !dataJenis || mengirim || terkunci) {
      return { ok: false };
    }
    setBanner(null);
    const g = periksaNilai(jenis, nilai, {
      wajibLampiran: pratinjau?.attachment_required ?? false,
      jumlahLampiran: lampiran.length,
      hariIni: dataJenis.today,
    });
    if (Object.keys(g).length > 0) {
      setGalat(g);
      const n = Object.keys(g).length;
      setBanner({ tone: 'bad', pesan: n > 1 ? `Periksa ${n} isian yang ditandai merah sebelum mengirim.` : (Object.values(g)[0] ?? '') });
      return { ok: false };
    }
    setMengirim(true);
    try {
      const isian = keIsianServer(jenis, nilai);
      let item: ItemPengajuan;
      if (requestId) {
        await unggahTertunda(requestId);
        item = revisi ? await kirimUlang(requestId, isian) : await kirimDraf(requestId, isian);
      } else {
        item = await kirimBaru(isian, lampiranLokal);
      }
      await hapusDrafPerangkat(userId, jenis.category);
      tandaiDaftarBerubah();
      setAwal(nilai);
      setLampiran((l) => l.filter((x) => x.jenis === 'server'));
      return { ok: true, item };
    } catch (err) {
      await tanganiGalat(err, 'kirim');
      return { ok: false };
    } finally {
      setMengirim(false);
    }
  }, [jenis, dataJenis, mengirim, terkunci, nilai, pratinjau, lampiran.length, requestId, revisi, unggahTertunda, lampiranLokal, userId, tanganiGalat]);

  const pilihanTipe = useMemo(() => (dataJenis && kategori ? (dataJenis.categories.find((c) => c.value === kategori)?.types ?? []) : []), [dataJenis, kategori]);

  return {
    staf,
    dataJenis,
    jenis,
    pilihanTipe,
    gantiTipe,
    detail,
    requestId,
    revisi,
    nilai,
    ubah,
    lampiran,
    tambahLampiran,
    hapusSatuLampiran,
    sibukLampiran,
    memuat,
    galatMuat,
    muat,
    pratinjau,
    memuatPratinjau,
    segarkanPratinjau,
    luring,
    galat,
    banner,
    setBanner,
    dipulihkan,
    buangDrafPerangkat,
    terkunci,
    terkunciServer,
    disimpanPada,
    menyimpan,
    mengirim,
    simpanDraf,
    kirim,
    kotor,
  };
}

export type FormPengajuan = ReturnType<typeof useFormPengajuan>;
