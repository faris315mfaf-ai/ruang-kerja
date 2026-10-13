/**
 * Sheet "Delegasikan briefing" (HR/Super Admin, spec 02, `08-briefing-delegasi`):
 * pilih periode yang belum selesai/tersimpan, cari karyawan (min. 2 huruf,
 * `GET /orang?q=`), delegasikan untuk hari ini (`POST /briefing/delegasi`).
 * Memilih orang lain untuk periode yang sudah didelegasikan menggantikannya.
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { cariOrang, delegasiBriefing, type KartuBriefing, type OrangRingkas, type PeriodeBriefing } from '@/api/beranda';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';
import { radius, useTheme } from '@/theme';
import { Avatar, BottomSheet, Button, Field, Icon, Pressable, SearchInput, Segmented, Skeleton, Text, useSnackbar } from '@/ui';

type StatusCari = 'diam' | 'mencari' | 'selesai' | 'gagal';

export function DelegasiSheet({
  visible,
  onClose,
  kartu,
  onSukses,
}: {
  visible: boolean;
  onClose: () => void;
  kartu: KartuBriefing;
  onSukses: () => void;
}): React.JSX.Element {
  const { colors } = useTheme();
  const { user } = useSession();
  const snackbar = useSnackbar();

  const periode = useMemo(() => kartu.periods.filter((p) => p.status !== 'after' && kartu.saved[p.value] === null), [kartu]);
  const [pilihPeriode, setPilihPeriode] = useState<PeriodeBriefing | null>(null);
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<OrangRingkas[]>([]);
  const [status, setStatus] = useState<StatusCari>('diam');
  const [terpilih, setTerpilih] = useState<OrangRingkas | null>(null);
  const [mengirim, setMengirim] = useState(false);

  const aktif: PeriodeBriefing | null = pilihPeriode !== null && periode.some((p) => p.value === pilihPeriode) ? pilihPeriode : (periode.find((p) => p.value === kartu.current)?.value ?? periode[0]?.value ?? null);

  // Pencarian dengan jeda 350 ms; hasil basi dibuang bila ketikan berubah.
  useEffect(() => {
    if (!visible) {
      return undefined;
    }
    const kata = q.trim();
    if (kata.length < 2) {
      const t = setTimeout(() => {
        setHasil([]);
        setStatus('diam');
      }, 0);
      return () => clearTimeout(t);
    }
    let batal = false;
    const t = setTimeout(() => {
      setStatus('mencari');
      cariOrang(kata)
        .then((baris) => {
          if (!batal) {
            setHasil(baris.filter((o) => o.id !== user?.id));
            setStatus('selesai');
          }
        })
        .catch(() => {
          if (!batal) {
            setHasil([]);
            setStatus('gagal');
          }
        });
    }, 350);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [q, visible, user?.id]);

  const tutup = (): void => {
    setQ('');
    setHasil([]);
    setTerpilih(null);
    setStatus('diam');
    onClose();
  };

  const kirim = async (): Promise<void> => {
    if (!terpilih || aktif === null || mengirim) {
      return;
    }
    setMengirim(true);
    try {
      await delegasiBriefing(terpilih.id, aktif);
      snackbar.show({ message: `Pencatatan didelegasikan ke ${terpilih.name}.`, variant: 'ok' });
      tutup();
      onSukses();
    } catch (err) {
      snackbar.show({
        message: err instanceof ApiError ? (err.firstValidationError ?? err.message) : 'Delegasi gagal disimpan.',
        variant: err instanceof ApiError && err.status === 0 ? 'offline' : 'bad',
      });
    } finally {
      setMengirim(false);
    }
  };

  const delegasiLama = aktif !== null ? kartu.delegations[aktif] : undefined;

  return (
    <BottomSheet visible={visible} onClose={tutup} title="Delegasikan briefing" scrollable>
      <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
        Orang yang ditunjuk mencatat briefing hari ini menggantikan Anda.
      </Text>

      {periode.length === 0 ? (
        <Text variant="body" tone="muted">
          Tidak ada periode yang bisa didelegasikan: semua periode sudah dicatat atau jendelanya sudah lewat.
        </Text>
      ) : (
        <>
          {periode.length > 1 ? (
            <Field label="Periode briefing">
              <Segmented<PeriodeBriefing> value={aktif ?? periode[0]!.value} onChange={setPilihPeriode} options={periode.map((p) => ({ value: p.value, label: p.value === 'pagi' ? 'Pagi' : 'Sore' }))} />
            </Field>
          ) : null}

          <Field label="Cari karyawan" hint={q.trim().length < 2 ? 'Ketik minimal 2 huruf nama karyawan.' : undefined}>
            <SearchInput value={q} onChangeText={setQ} placeholder="Ketik nama karyawan…" />
          </Field>

          {status === 'mencari' ? (
            <View accessibilityLiveRegion="polite" accessibilityLabel="Mencari karyawan…" style={{ gap: 8 }}>
              <Skeleton height={56} />
              <Skeleton height={56} />
              <Skeleton height={56} />
            </View>
          ) : null}
          {status === 'gagal' ? (
            <Text variant="meta" tone="danger" accessibilityLiveRegion="polite">
              Pencarian gagal dimuat. Coba lagi.
            </Text>
          ) : null}
          {status === 'selesai' && hasil.length === 0 ? (
            <Text variant="meta" accessibilityLiveRegion="polite">
              Tidak ada karyawan dengan nama itu.
            </Text>
          ) : null}
          {status === 'selesai' && hasil.length > 0 ? (
            <View style={{ gap: 8 }}>
              {hasil.map((o) => {
                const dipilih = terpilih?.id === o.id;
                return (
                  <Pressable
                    key={o.id}
                    onPress={() => setTerpilih(o)}
                    scaleTo={0.99}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: dipilih }}
                    accessibilityLabel={`${o.name}${o.position ? `, ${o.position}` : ''}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 12,
                      minHeight: 60,
                      paddingHorizontal: 12,
                      borderRadius: radius.lg,
                      borderWidth: dipilih ? 2 : 1,
                      borderColor: dipilih ? colors.primary : colors.border,
                      backgroundColor: colors.surface,
                    }}
                  >
                    <Avatar name={o.name} />
                    <View style={{ flex: 1 }}>
                      <Text variant="title" numberOfLines={1}>
                        {o.name}
                      </Text>
                      <Text variant="meta" numberOfLines={1}>
                        {[o.position, o.division].filter((x): x is string => !!x).join(' · ')}
                      </Text>
                    </View>
                    {dipilih ? <Icon name="circle-check" size={22} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {terpilih ? (
            <Text variant="meta" accessibilityLiveRegion="polite">{`Dipilih: ${terpilih.name}.`}</Text>
          ) : null}
          {delegasiLama ? (
            <Text variant="meta" tone="warning">
              {`Periode ${aktif === 'pagi' ? 'Pagi' : 'Sore'} sudah didelegasikan ke ${delegasiLama.to.name} — memilih orang lain menggantikannya.`}
            </Text>
          ) : null}

          <Button
            title="Delegasikan pencatatan"
            onPress={() => void kirim()}
            disabled={!terpilih || aktif === null}
            disabledReason="Pilih karyawan dulu"
            loading={mengirim}
            loadingTitle="Mendelegasikan…"
          />
        </>
      )}
    </BottomSheet>
  );
}
