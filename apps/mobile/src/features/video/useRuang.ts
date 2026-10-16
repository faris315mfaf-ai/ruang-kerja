/**
 * Sambungan ruang rapat video native (LiveKit) — satu `Room` per layar ruang.
 *
 * Tanggung jawab: token (dari pra-gabung atau baru), AudioSession Android,
 * publikasi mikrofon/kamera sesuai pilihan pra-gabung, keadaan sambungan
 * (menyambung ulang, jaringan lemah, putus, dikeluarkan, ruang ditutup),
 * angkat tangan (atribut `hand` lewat server), waktu bicara (lapor tiap 15
 * detik, kumulatif), kehadiran (polling 15 detik), subtitle `lk.transcription`
 * dari `rk-notulen`, penanda notulen `rk.minutes`, dan keluar.
 * Perilaku = web resources/js/features/meetings/video/** (paritas).
 */
import { AudioSession } from '@livekit/react-native';
import {
  ConnectionQuality,
  ConnectionState,
  DisconnectReason,
  LocalVideoTrack,
  type LocalParticipant,
  type Participant,
  ParticipantEvent,
  type RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  VideoPresets,
  VideoQuality,
} from 'livekit-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ApiError } from '@/api/client';
import {
  aturTangan,
  kehadiranVideo,
  laporWaktuBicara,
  ruangVideo,
  tokenVideo,
  waktuBicara,
  type KehadiranVideo,
  type KodeTolakVideo,
  type OrangVideo,
  type TokenVideo,
  type WaktuBicara,
} from '@/api/video';

import { acceptCaptionStream, applyCaption, CAPTION_TOPIC, readCaptionAttributes, type CaptionLine } from './captions';
import { ambilPilihan, pakaiToken, type ArahKamera } from './sesi';
import { kodeTolak } from './teks';
import { TalkStore } from './waktuBicara';

export const IDENTITAS_NOTULEN = 'rk-notulen';
export const TOPIK_NOTULEN = 'rk.minutes';
const POLL_MS = 15_000;

export type FaseRuang =
  | { kind: 'menyambung' }
  | { kind: 'tersambung' }
  | { kind: 'ditolak'; kode: KodeTolakVideo; pesan: string }
  | { kind: 'offline' }
  | { kind: 'server'; pesan: string }
  | { kind: 'dikeluarkan' }
  | { kind: 'dibatalkan' }
  | { kind: 'selesai' }
  | { kind: 'perangkatLain' }
  | { kind: 'keluar'; masuk: number; keluar: number; sisa: number };

export interface Pemberitahuan {
  id: number;
  teks: string;
  jenis: 'tangan' | 'info';
}

export interface RuangLive {
  room: Room;
  fase: FaseRuang;
  token: TokenVideo | null;
  /** Naik setiap ada perubahan peserta/track — pemicu render ulang petak. */
  versi: number;
  menyambungUlang: boolean;
  jaringanLemah: boolean;
  /** identity → epoch ms tangan terangkat (> 0). */
  tangan: Record<string, number>;
  pembicara: string[];
  kehadiran: KehadiranVideo | null;
  captions: CaptionLine[];
  subtitleTersedia: boolean;
  /** Naik saat paket `rk.minutes` diterima (notulen disimpan orang lain). */
  versiNotulen: number;
  pemberitahuan: Pemberitahuan | null;
  talk: TalkStore | null;
  arah: ArahKamera;
  orang: (identity: string) => OrangVideo | null;
  nama: (identity: string) => string;
  sambung: () => void;
  keluar: () => Promise<void>;
  aturMic: (nyala: boolean) => Promise<void>;
  aturKamera: (nyala: boolean) => Promise<void>;
  balikKamera: () => Promise<void>;
  aturLayar: (nyala: boolean) => Promise<void>;
  angkatTangan: (naik: boolean) => Promise<void>;
  segarkanKehadiran: () => void;
}

/**
 * Nyalakan kamera. Track kamera yang di-mute dinyalakan ulang LiveKit dengan
 * constraint lamanya (`deviceId: 'default'`), yang ditolak WebRTC native
 * (OverconstrainedError) sehingga kamera tetap mati. Lepas track lama lalu
 * buat yang baru, sama seperti saat pertama masuk ruang.
 */
async function nyalakanKamera(lp: LocalParticipant, arah: ArahKamera): Promise<void> {
  const pub = lp.getTrackPublication(Track.Source.Camera);
  if (pub?.track && pub.isMuted) {
    await lp.unpublishTrack(pub.track, true);
  }
  await lp.setCameraEnabled(true, { facingMode: arah });
}

/** Peserta tampil (tanpa worker notulen tersembunyi). */
export function pesertaTampil(room: Room): Participant[] {
  return [room.localParticipant, ...room.remoteParticipants.values()].filter((p) => p.identity !== IDENTITAS_NOTULEN);
}

function nilaiTangan(p: Participant): number {
  const n = Number(p.attributes?.hand ?? '');
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function useRuang(id: string, tanggal: string | null, people: OrangVideo[]): RuangLive {
  const pilihan = useMemo(() => ambilPilihan(), []);
  const room = useMemo(
    () =>
      new Room({
        adaptiveStream: pilihan.hematData ? false : { pixelDensity: 'screen' },
        dynacast: true,
        videoCaptureDefaults: { facingMode: pilihan.arah, resolution: pilihan.hematData ? VideoPresets.h360.resolution : VideoPresets.h540.resolution },
        audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      }),
    [pilihan],
  );

  const [fase, setFase] = useState<FaseRuang>({ kind: 'menyambung' });
  const [token, setToken] = useState<TokenVideo | null>(null);
  const [versi, setVersi] = useState(0);
  const [menyambungUlang, setMenyambungUlang] = useState(false);
  const [jaringanLemah, setJaringanLemah] = useState(false);
  const [tangan, setTangan] = useState<Record<string, number>>({});
  const [pembicara, setPembicara] = useState<string[]>([]);
  const [kehadiran, setKehadiran] = useState<KehadiranVideo | null>(null);
  const [captions, setCaptions] = useState<CaptionLine[]>([]);
  const [subtitleTersedia, setSubtitleTersedia] = useState(false);
  const [versiNotulen, setVersiNotulen] = useState(0);
  const [pemberitahuan, setPemberitahuan] = useState<Pemberitahuan | null>(null);
  const [talk, setTalk] = useState<TalkStore | null>(null);
  const [arah, setArah] = useState<ArahKamera>(pilihan.arah);

  const hidup = useRef(true);
  const keluarSengaja = useRef(false);
  const masukPada = useRef(0);
  const talkRef = useRef<TalkStore | null>(null);
  const kameraSebelumLatar = useRef(false);
  // Matikan/nyalakan kamera saat ke/dari latar berurutan: kembali cepat dari
  // latar bisa menyalakan sebelum mematikan selesai, lalu kamera tetap mati.
  const antreKamera = useRef<Promise<unknown>>(Promise.resolve());
  const daftarOrang = useMemo(() => (token?.people && token.people.length > 0 ? token.people : people), [token, people]);
  const orang = useCallback((identity: string): OrangVideo | null => daftarOrang.find((p) => p.id === identity) ?? null, [daftarOrang]);
  const nama = useCallback(
    (identity: string): string => {
      const o = orang(identity);
      if (o) {
        return o.name;
      }
      if (identity === room.localParticipant.identity) {
        return token?.name ?? 'Anda';
      }
      // Jangan percaya nama dari LiveKit (kontrak §4) — kecuali tidak ada data server.
      return room.remoteParticipants.get(identity)?.name || 'Peserta';
    },
    [orang, room, token],
  );
  // Dibaca handler event LiveKit supaya pendaftaran event tidak diulang tiap nama berubah.
  const namaRef = useRef(nama);
  useEffect(() => {
    namaRef.current = nama;
  }, [nama]);

  const beritahu = useCallback((teks: string, jenis: Pemberitahuan['jenis']) => {
    setPemberitahuan({ id: Date.now(), teks, jenis });
  }, []);

  useEffect(() => {
    if (pemberitahuan === null) {
      return;
    }
    const t = setTimeout(() => setPemberitahuan((p) => (p?.id === pemberitahuan.id ? null : p)), 4000);
    return () => clearTimeout(t);
  }, [pemberitahuan]);

  // ── Event LiveKit ────────────────────────────────────────────────────────
  useEffect(() => {
    hidup.current = true;
    const naik = () => setVersi((v) => v + 1);
    const segarkanTangan = () => {
      const peta: Record<string, number> = {};
      for (const p of pesertaTampil(room)) {
        const n = nilaiTangan(p);
        if (n > 0) {
          peta[p.identity] = n;
        }
      }
      setTangan(peta);
    };

    const onAttr = (changed: Record<string, string>, p: Participant) => {
      segarkanTangan();
      if (!p.isLocal && 'hand' in changed && Number(changed.hand) > 0) {
        beritahu(`${namaRef.current(p.identity)} mengangkat tangan`, 'tangan');
      }
    };
    const onSpeakers = (speakers: Participant[]) => {
      const ids = speakers.map((s) => s.identity).filter((x) => x !== IDENTITAS_NOTULEN);
      talkRef.current?.record(ids, Date.now());
      setPembicara(ids);
    };
    const onState = (s: ConnectionState) => {
      setMenyambungUlang(s === ConnectionState.Reconnecting || s === ConnectionState.SignalReconnecting);
      naik();
    };
    const onQuality = (q: ConnectionQuality, p: Participant) => {
      if (p.isLocal) {
        setJaringanLemah(q === ConnectionQuality.Poor || q === ConnectionQuality.Lost);
      }
    };
    const onData = (_payload: Uint8Array, _p?: unknown, _k?: unknown, topic?: string) => {
      if (topic === TOPIK_NOTULEN) {
        setVersiNotulen((v) => v + 1);
      }
    };
    const onJoin = (p: Participant) => {
      naik();
      segarkanTangan();
      if (p.identity !== IDENTITAS_NOTULEN && masukPada.current > 0 && Date.now() - masukPada.current > 5000) {
        beritahu(`${namaRef.current(p.identity)} masuk`, 'info');
      }
    };
    const onSubscribed = (_t: unknown, pub: RemoteTrackPublication) => {
      if (pilihan.hematData && pub.kind === Track.Kind.Video) {
        pub.setVideoQuality(VideoQuality.LOW);
      }
      naik();
    };
    const onDisconnected = (reason?: DisconnectReason) => {
      if (!hidup.current) {
        return;
      }
      if (keluarSengaja.current || reason === DisconnectReason.CLIENT_INITIATED) {
        return;
      }
      if (reason === DisconnectReason.PARTICIPANT_REMOVED) {
        setFase({ kind: 'dikeluarkan' });
        return;
      }
      if (reason === DisconnectReason.DUPLICATE_IDENTITY) {
        setFase({ kind: 'perangkatLain' });
        return;
      }
      if (reason === DisconnectReason.ROOM_DELETED || reason === DisconnectReason.ROOM_CLOSED) {
        // Dibatalkan atau ruang ditutup — tanyakan server.
        ruangVideo(id, tanggal)
          .then((r) => {
            const alasan = (r.room.video.denied_reason ?? '').toLowerCase();
            setFase(alasan.includes('batal') ? { kind: 'dibatalkan' } : { kind: 'selesai' });
          })
          .catch((e: unknown) => {
            if (e instanceof ApiError && e.status === 403 && /batal/i.test(e.message)) {
              setFase({ kind: 'dibatalkan' });
            } else {
              setFase({ kind: 'selesai' });
            }
          });
        return;
      }
      setFase({ kind: 'server', pesan: 'Sambungan ke ruang rapat terputus.' });
    };

    room
      .on(RoomEvent.ParticipantConnected, onJoin)
      .on(RoomEvent.ParticipantDisconnected, naik)
      .on(RoomEvent.TrackPublished, naik)
      .on(RoomEvent.TrackUnpublished, naik)
      .on(RoomEvent.TrackSubscribed, onSubscribed)
      .on(RoomEvent.TrackUnsubscribed, naik)
      .on(RoomEvent.TrackMuted, naik)
      .on(RoomEvent.TrackUnmuted, naik)
      .on(RoomEvent.LocalTrackPublished, naik)
      .on(RoomEvent.LocalTrackUnpublished, naik)
      .on(RoomEvent.ParticipantAttributesChanged, onAttr)
      .on(RoomEvent.ActiveSpeakersChanged, onSpeakers)
      .on(RoomEvent.ConnectionStateChanged, onState)
      .on(RoomEvent.ConnectionQualityChanged, onQuality)
      .on(RoomEvent.DataReceived, onData)
      .on(RoomEvent.Disconnected, onDisconnected);

    // Subtitle: hanya stream dari worker notulen.
    try {
      room.registerTextStreamHandler(CAPTION_TOPIC, (reader, info) => {
        if (!acceptCaptionStream(info.identity)) {
          return;
        }
        const attr = readCaptionAttributes(reader.info.attributes, reader.info.id);
        let speaker = info.identity;
        if (attr.trackId) {
          for (const p of [room.localParticipant, ...room.remoteParticipants.values()]) {
            if (p.trackPublications.has(attr.trackId)) {
              speaker = p.identity;
            }
          }
        }
        setSubtitleTersedia(true);
        let teks = '';
        void (async () => {
          try {
            for await (const chunk of reader) {
              if (!hidup.current) {
                return;
              }
              teks += chunk;
              const t = teks;
              setCaptions((c) => applyCaption(c, { segmentId: attr.segmentId, speaker, text: t, final: false, at: Date.now() }));
            }
            if (hidup.current && attr.final) {
              const t = teks;
              setCaptions((c) => applyCaption(c, { segmentId: attr.segmentId, speaker, text: t, final: true, at: Date.now() }));
            }
          } catch {
            // Stream rusak hanya menghilangkan satu baris subtitle.
          }
        })();
      });
    } catch {
      // Sudah terdaftar.
    }

    const lp = room.localParticipant;
    lp.on(ParticipantEvent.AttributesChanged, segarkanTangan);

    return () => {
      hidup.current = false;
      room
        .off(RoomEvent.ParticipantConnected, onJoin)
        .off(RoomEvent.ParticipantDisconnected, naik)
        .off(RoomEvent.TrackPublished, naik)
        .off(RoomEvent.TrackUnpublished, naik)
        .off(RoomEvent.TrackSubscribed, onSubscribed)
        .off(RoomEvent.TrackUnsubscribed, naik)
        .off(RoomEvent.TrackMuted, naik)
        .off(RoomEvent.TrackUnmuted, naik)
        .off(RoomEvent.LocalTrackPublished, naik)
        .off(RoomEvent.LocalTrackUnpublished, naik)
        .off(RoomEvent.ParticipantAttributesChanged, onAttr)
        .off(RoomEvent.ActiveSpeakersChanged, onSpeakers)
        .off(RoomEvent.ConnectionStateChanged, onState)
        .off(RoomEvent.ConnectionQualityChanged, onQuality)
        .off(RoomEvent.DataReceived, onData)
        .off(RoomEvent.Disconnected, onDisconnected);
      lp.off(ParticipantEvent.AttributesChanged, segarkanTangan);
      try {
        room.unregisterTextStreamHandler(CAPTION_TOPIC);
      } catch {
        // abaikan
      }
    };
  }, [room, id, tanggal, beritahu, pilihan.hematData]);

  // ── Sambung ──────────────────────────────────────────────────────────────
  const sambung = useCallback(() => {
    void (async () => {
      setFase({ kind: 'menyambung' });
      keluarSengaja.current = false;
      let t: TokenVideo;
      try {
        t = pakaiToken(id, tanggal) ?? (await tokenVideo(id, tanggal));
      } catch (e) {
        if (!hidup.current) {
          return;
        }
        const kode = kodeTolak(e);
        if (kode === 'dikeluarkan') {
          setFase({ kind: 'dikeluarkan' });
        } else if (kode !== null) {
          setFase({ kind: 'ditolak', kode, pesan: e instanceof Error ? e.message : '' });
        } else if (e instanceof ApiError && e.status === 0) {
          setFase({ kind: 'offline' });
        } else {
          setFase({ kind: 'server', pesan: e instanceof Error ? e.message : 'Gagal meminta izin masuk ruang.' });
        }
        return;
      }
      setToken(t);
      try {
        await AudioSession.startAudioSession();
      } catch {
        // Sesi audio gagal dikonfigurasi — tetap coba sambung.
      }
      try {
        await room.connect(t.url, t.token, { autoSubscribe: true });
      } catch {
        if (hidup.current) {
          setFase({
            kind: 'server',
            pesan: 'Periksa jaringan Anda (UDP atau port 443 mungkin diblokir). Coba pindah ke data seluler.',
          });
        }
        return;
      }
      if (!hidup.current) {
        void room.disconnect();
        return;
      }
      masukPada.current = Date.now();
      // Waktu bicara: mulai dari total server.
      let awal: WaktuBicara | null = null;
      try {
        awal = await waktuBicara(id, tanggal);
      } catch {
        awal = null;
      }
      const store = new TalkStore(t.identity, awal);
      talkRef.current = store;
      setTalk(store);
      const p = ambilPilihan();
      const lp = room.localParticipant;
      if (p.mic) {
        await lp.setMicrophoneEnabled(true).catch(() => undefined);
      }
      if (p.kamera) {
        await lp
          .setCameraEnabled(true, { facingMode: p.arah, resolution: p.hematData ? VideoPresets.h360.resolution : VideoPresets.h540.resolution })
          .catch(() => undefined);
      }
      try {
        await AudioSession.selectAudioOutput(p.keluaran);
      } catch {
        // Keluaran tidak tersedia (mis. Bluetooth terputus) — pakai bawaan.
      }
      const peta: Record<string, number> = {};
      for (const x of pesertaTampil(room)) {
        const n = nilaiTangan(x);
        if (n > 0) {
          peta[x.identity] = n;
        }
      }
      setTangan(peta);
      setFase({ kind: 'tersambung' });
      setVersi((v) => v + 1);
    })();
  }, [id, tanggal, room]);

  useEffect(() => {
    sambung();
    return () => {
      keluarSengaja.current = true;
      void room.disconnect();
      void AudioSession.stopAudioSession().catch(() => undefined);
    };
  }, [room, sambung]);

  const tersambung = fase.kind === 'tersambung';

  // ── Waktu bicara: lapor tiap 15 detik ────────────────────────────────────
  useEffect(() => {
    if (!tersambung || talk === null) {
      return;
    }
    const lapor = () => {
      laporWaktuBicara(id, talk.mine(Date.now()), tanggal)
        .then((d) => talk.apply(d))
        .catch(() => undefined);
    };
    const t = setInterval(lapor, POLL_MS);
    return () => clearInterval(t);
  }, [tersambung, talk, id, tanggal]);

  // ── Kehadiran: polling 15 detik ──────────────────────────────────────────
  const segarkanKehadiran = useCallback(() => {
    kehadiranVideo(id, tanggal)
      .then((k) => {
        if (hidup.current) {
          setKehadiran(k);
        }
      })
      .catch(() => undefined);
  }, [id, tanggal]);

  useEffect(() => {
    if (!tersambung) {
      return;
    }
    segarkanKehadiran();
    const t = setInterval(segarkanKehadiran, POLL_MS);
    return () => clearInterval(t);
  }, [tersambung, segarkanKehadiran]);

  // ── Latar belakang: kamera dimatikan (Android menghentikan tangkapan) ────
  useEffect(() => {
    if (!tersambung) {
      return;
    }
    const sub = AppState.addEventListener('change', (s) => {
      const lp = room.localParticipant;
      if (s === 'background') {
        if (lp.isCameraEnabled && !lp.isScreenShareEnabled) {
          kameraSebelumLatar.current = true;
          antreKamera.current = antreKamera.current.then(() => lp.setCameraEnabled(false)).catch(() => undefined);
        }
      } else if (s === 'active' && kameraSebelumLatar.current) {
        kameraSebelumLatar.current = false;
        antreKamera.current = antreKamera.current
          .then(() => nyalakanKamera(lp, arah))
          .then(() => setVersi((v) => v + 1))
          .catch(() => undefined);
      }
    });
    return () => sub.remove();
  }, [tersambung, room, arah]);

  // ── Aksi ─────────────────────────────────────────────────────────────────
  const keluar = useCallback(async () => {
    keluarSengaja.current = true;
    const masuk = masukPada.current || Date.now();
    const sisa = Math.max(0, pesertaTampil(room).length - 1);
    const store = talkRef.current;
    if (store !== null && room.state === ConnectionState.Connected) {
      await Promise.race([laporWaktuBicara(id, store.mine(Date.now()), tanggal).catch(() => undefined), new Promise((r) => setTimeout(r, 2500))]);
    }
    await room.disconnect().catch(() => undefined);
    await AudioSession.stopAudioSession().catch(() => undefined);
    setFase({ kind: 'keluar', masuk, keluar: Date.now(), sisa });
  }, [room, id, tanggal]);

  const aturMic = useCallback(
    async (nyala: boolean) => {
      await room.localParticipant.setMicrophoneEnabled(nyala);
      setVersi((v) => v + 1);
    },
    [room],
  );

  const aturKamera = useCallback(
    async (nyala: boolean) => {
      if (nyala) {
        await nyalakanKamera(room.localParticipant, arah);
      } else {
        await room.localParticipant.setCameraEnabled(false);
      }
      setVersi((v) => v + 1);
    },
    [room, arah],
  );

  const balikKamera = useCallback(async () => {
    const baru: ArahKamera = arah === 'user' ? 'environment' : 'user';
    const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (track instanceof LocalVideoTrack) {
      await track.restartTrack({ facingMode: baru });
    }
    setArah(baru);
    setVersi((v) => v + 1);
  }, [room, arah]);

  const aturLayar = useCallback(
    async (nyala: boolean) => {
      await room.localParticipant.setScreenShareEnabled(nyala);
      setVersi((v) => v + 1);
    },
    [room],
  );

  const angkatTangan = useCallback(
    async (naik: boolean) => {
      const me = room.localParticipant.identity;
      setTangan((t) => {
        const baru = { ...t };
        if (naik) {
          baru[me] = Date.now();
        } else {
          delete baru[me];
        }
        return baru;
      });
      try {
        await aturTangan(id, naik);
      } catch (e) {
        setTangan((t) => {
          const baru = { ...t };
          if (naik) {
            delete baru[me];
          }
          return baru;
        });
        throw e;
      }
    },
    [room, id],
  );

  return {
    room,
    fase,
    token,
    versi,
    menyambungUlang,
    jaringanLemah,
    tangan,
    pembicara,
    kehadiran,
    captions,
    subtitleTersedia,
    versiNotulen,
    pemberitahuan,
    talk,
    arah,
    orang,
    nama,
    sambung,
    keluar,
    aturMic,
    aturKamera,
    balikKamera,
    aturLayar,
    angkatTangan,
    segarkanKehadiran,
  };
}
