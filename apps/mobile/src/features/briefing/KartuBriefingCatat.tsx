/**
 * Kartu "Catat briefing" (HR, Super Admin, atau karyawan yang ditunjuk hari
 * ini; spec 02, `07-briefing-pencatat`). Jendela pagi 08.00–11.00 dan sore
 * 16.00–18.00 (ditentukan server). Draf tersimpan otomatis di perangkat
 * (SecureStore, kunci per pengguna+tanggal+periode, debounce 500 ms) dan
 * dipertahankan bila simpan gagal. Simpan idempoten (upsert): kirim pertama
 * memberi notifikasi ke semua karyawan, simpan ulang hanya memperbarui isi.
 */
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { simpanBriefing, type KartuBriefing, type PeriodeBriefing } from '@/api/beranda';
import { ApiError } from '@/api/client';
import { bacaDrafBriefing, hapusDrafBriefing, simpanDrafBriefing } from '@/features/beranda/penyimpanan';
import { jamKantor } from '@/features/beranda/format';
import { useSession } from '@/session/SessionProvider';
import { Badge, Banner, Button, Card, Field, Input, Text, useSnackbar } from '@/ui';

import { DelegasiSheet } from './DelegasiSheet';

const MAKS = 10_000;

export function KartuBriefingCatat({ kartu, onDiubah }: { kartu: KartuBriefing; onDiubah: () => void }): React.JSX.Element | null {
  const { user } = useSession();
  const snackbar = useSnackbar();
  const periode: PeriodeBriefing | null = kartu.current;

  if (periode === null) {
    // Di luar jendela: hanya pengingat jendela berikutnya.
    const berikut = kartu.periods.find((p) => p.status === 'before');
    return berikut ? (
      <Banner tone="info" icon="clock" message={`Briefing ${berikut.value} dapat dicatat pukul ${berikut.starts_at}–${berikut.ends_at} WIB.`} />
    ) : null;
  }

  return <Pencatat key={`${kartu.date}-${periode}`} kartu={kartu} periode={periode} userId={user?.id ?? ''} snackbar={snackbar} onDiubah={onDiubah} />;
}

function Pencatat({
  kartu,
  periode,
  userId,
  snackbar,
  onDiubah,
}: {
  kartu: KartuBriefing;
  periode: PeriodeBriefing;
  userId: string;
  snackbar: ReturnType<typeof useSnackbar>;
  onDiubah: () => void;
}): React.JSX.Element {
  const saved = kartu.saved[periode];
  const info = kartu.periods.find((p) => p.value === periode);
  const [teks, setTeks] = useState(saved?.content ?? '');
  const [drafAt, setDrafAt] = useState<Date | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [delegasi, setDelegasi] = useState(false);
  const [terkirimLokal, setTerkirimLokal] = useState(false);
  const sudahDiubah = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Muat draf lokal (hanya bila belum ada catatan tersimpan & belum diketik).
  useEffect(() => {
    if (saved !== null || userId === '') {
      return undefined;
    }
    let batal = false;
    void bacaDrafBriefing(userId, kartu.date, periode).then((draf) => {
      if (!batal && draf !== null && !sudahDiubah.current) {
        setTeks(draf);
      }
    });
    return () => {
      batal = true;
    };
  }, [saved, userId, kartu.date, periode]);

  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const ubah = (nilai: string): void => {
    sudahDiubah.current = true;
    setTeks(nilai);
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      void simpanDrafBriefing(userId, kartu.date, periode, nilai).then((ok) => {
        if (ok && nilai !== '') {
          setDrafAt(new Date());
        }
      });
    }, 500);
  };

  const kosong = teks.trim() === '';
  const kepanjangan = teks.length > MAKS;
  const terkirim = saved !== null || terkirimLokal;
  const delegasiAda = kartu.delegations[periode];
  const bisaDelegasi = kartu.is_recorder && !terkirim;

  const kirim = async (): Promise<void> => {
    if (kosong || kepanjangan || menyimpan) {
      return;
    }
    setMenyimpan(true);
    try {
      const hasil = await simpanBriefing(periode, teks.trim());
      setTerkirimLokal(true);
      await hapusDrafBriefing(userId, kartu.date, periode);
      setDrafAt(null);
      snackbar.show({ message: hasil.created ? 'Briefing terkirim ke semua karyawan.' : hasil.message, variant: 'ok' });
      onDiubah();
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Briefing gagal disimpan. Draf Anda tetap aman.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    } finally {
      setMenyimpan(false);
    }
  };

  const labelPeriode = periode === 'pagi' ? 'Briefing pagi' : 'Briefing sore';

  return (
    <Card style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <Text variant="h3" style={{ flex: 1 }} accessibilityRole="header">
          {`${labelPeriode} · ${kartu.date_label}`}
        </Text>
        <Badge tone={terkirim ? 'success' : 'warning'}>{terkirim ? 'Terkirim' : 'Belum dicatat'}</Badge>
      </View>

      <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
        {`Jendela catat ${info?.starts_at ?? ''}–${info?.ends_at ?? ''} WIB. Notulensi terkirim ke semua karyawan lewat Inbox.`}
      </Text>

      {!kartu.is_recorder && delegasiAda ? (
        <Text variant="meta" tone="info">{`Anda ditunjuk oleh ${delegasiAda.by.name} untuk mencatat briefing ini.`}</Text>
      ) : null}
      {kartu.is_recorder && delegasiAda ? (
        <Text variant="meta" tone="info">{`Didelegasikan ke ${delegasiAda.to.name} oleh ${delegasiAda.by.name}.`}</Text>
      ) : null}

      <Field
        label={`Notulensi ${labelPeriode.toLowerCase()}`}
        error={kepanjangan ? 'Notulensi maksimal 10000 karakter.' : null}
        hint={
          kosong && !terkirim
            ? 'Tulis notulensi briefing dulu.'
            : terkirim
              ? 'Briefing terkirim ke semua karyawan. Perubahan setelah ini tersimpan tanpa notifikasi ulang.'
              : drafAt
                ? `Draf tersimpan di perangkat ini pukul ${jamKantor(drafAt)}.`
                : 'Draf tersimpan otomatis di perangkat ini.'
        }
      >
        <Input
          value={teks}
          onChangeText={ubah}
          multiline
          invalid={kepanjangan}
          placeholder="Tulis poin-poin briefing, satu poin per baris…"
          accessibilityLabel={`Notulensi ${labelPeriode.toLowerCase()}`}
          style={{ minHeight: 140 }}
        />
      </Field>

      <Button
        title={terkirim ? 'Simpan perubahan' : 'Simpan & kirim ke semua'}
        onPress={() => void kirim()}
        loading={menyimpan}
        loadingTitle="Menyimpan briefing…"
        disabled={kosong || kepanjangan}
        disabledReason="Tulis notulensi briefing dulu."
      />
      {bisaDelegasi ? <Button title="Delegasikan" variant="outline" icon="user-cog" onPress={() => setDelegasi(true)} /> : null}

      {kartu.is_recorder ? <DelegasiSheet visible={delegasi} onClose={() => setDelegasi(false)} kartu={kartu} onSukses={onDiubah} /> : null}
    </Card>
  );
}
