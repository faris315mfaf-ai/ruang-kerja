/**
 * Profil — data kepegawaian baca-saja (HR yang mengubah). Varian staf (tim,
 * no. karyawan) dan Kepala Divisi (divisi dipimpin); NIK tidak pernah tampil.
 * Mockup: docs/mockups/android/screens/01-akses-akun/13-profil (4 keadaan).
 */
import { Linking, View } from 'react-native';

import { EMAIL_HR, tglPendekYMD } from '@/features/settings/konstanta';
import { BarisNilai, KartuIdentitas, LencanaPeran } from '@/features/settings/parts';
import { barisJabatan, daftarLabelPeran } from '@/features/settings/profile';
import { useProfilLengkap } from '@/features/settings/useProfilLengkap';
import { Banner, Button, Card, ErrorState, OfflineBanner, Screen, Skeleton, SubAppBar } from '@/ui';

function SkeletonProfil(): React.JSX.Element {
  return (
    <>
      <Skeleton height={124} />
      <Card>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }}>
            <Skeleton height={18} width={90} />
            <Skeleton height={18} width={150} />
          </View>
        ))}
      </Card>
    </>
  );
}

export default function LayarProfil(): React.JSX.Element {
  const { profil, peran, memuat, offline, galat, muatUlang } = useProfilLengkap();
  const labelPeran = daftarLabelPeran(profil);
  const memimpin = peran.kadiv && profil.divisiDipimpin.length > 0;

  const baris: { label: string; nilai: string | null; sub?: string | null }[] = [
    { label: 'Nama', nilai: profil.name },
    { label: 'Email', nilai: profil.email || null },
    { label: 'No. karyawan', nilai: profil.noKaryawan },
    { label: 'Divisi', nilai: profil.divisi },
    {
      label: 'Divisi dipimpin',
      nilai: memimpin ? (profil.divisiDipimpin.length === 1 && profil.divisi ? profil.divisi : `${profil.divisiDipimpin.length} divisi`) : null,
    },
    { label: 'Tim', nilai: profil.tim?.name ?? null },
    { label: 'Jabatan', nilai: profil.jabatan },
    { label: 'Atasan langsung', nilai: profil.atasan?.name ?? null },
    { label: 'Mode kerja', nilai: profil.modeKerja },
    { label: 'Bergabung', nilai: profil.bergabung ? tglPendekYMD(profil.bergabung) : null },
  ];
  const terisi = baris.filter((b) => b.nilai !== null && b.nilai !== '');

  return (
    <Screen header={<SubAppBar title="Profil" />} onRefresh={() => void muatUlang()} refreshing={memuat && profil.lengkap}>
      {offline ? <OfflineBanner /> : null}

      {memuat && !profil.lengkap && !offline ? (
        <SkeletonProfil />
      ) : galat && !profil.lengkap ? (
        <ErrorState message={galat} onRetry={() => void muatUlang()} />
      ) : (
        <>
          <KartuIdentitas
            nama={profil.name}
            baris={barisJabatan(profil)}
            lencana={
              labelPeran.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {labelPeran.map((label, i) => (
                    <LencanaPeran key={label} ikon={i === 0 ? 'shield' : undefined}>
                      {label}
                    </LencanaPeran>
                  ))}
                </View>
              ) : undefined
            }
          />

          <Card style={{ paddingVertical: 6, paddingHorizontal: 20, gap: 0 }}>
            {terisi.map((b, i) => (
              <BarisNilai key={b.label} label={b.label} nilai={b.nilai ?? ''} sub={b.sub} divider={i < terisi.length - 1} />
            ))}
          </Card>

          <Banner tone="info" message="Jabatan, divisi, atasan, dan mode kerja diatur HR. Hubungi HR bila ada yang perlu diperbaiki." />

          {peran.staf ? (
            <Button title="Hubungi HR" variant="outline" icon="mail" onPress={() => void Linking.openURL(`mailto:${EMAIL_HR}`).catch(() => undefined)} />
          ) : null}
        </>
      )}
    </Screen>
  );
}
