/**
 * Kartu "Ringkasan" form (mockup 04–10) dari `GET /pengajuan/pratinjau`:
 * durasi besar, catatan saldo (non-staf saja; staf tidak pernah menerima
 * saldo), peringatan rekan & benturan, dan "Alur persetujuan" per langkah.
 */
import { StyleSheet, View } from 'react-native';

import type { JenisForm, LangkahAlur, Pratinjau, RekanAbsen } from '@/api/pengajuan';
import { radius, useTheme } from '@/theme';
import { Avatar, Card, Icon, Skeleton, Text } from '@/ui';

import { angkaHari, daftarTanggal, durasiMenit, hariTanggalPendek, rentangTanggal, rupiah } from './format';
import type { NilaiForm } from './nilaiForm';

/** "Dimas Pratama, lalu HR" — teks kecil di atas tombol kirim. */
export function teksAlur(flow: LangkahAlur[]): string {
  if (flow.length === 0) {
    return '';
  }
  const nama = flow.map((l, i) => (i === 0 ? (l.approver?.name ?? l.label) : (l.label || l.approver?.name || '')));
  return `Disetujui oleh ${nama.join(', lalu ')}`;
}

export function PeringatanRekan({ rekan, akhiran = 'Atasan Anda akan melihat info ini saat memutuskan.' }: { rekan: RekanAbsen; akhiran?: string }): React.JSX.Element | null {
  const { colors } = useTheme();
  if (rekan.people.length === 0) {
    return null;
  }
  const pertama = rekan.people[0];
  const lain = rekan.people.length - 1;
  const teks = `${pertama?.name ?? ''}${lain > 0 ? ` dan ${lain} rekan lain` : ''} juga tidak masuk ${daftarTanggal(pertama?.dates ?? [])}.`;
  return (
    <View style={[s.peringatan, { backgroundColor: colors.warningSoft }]} accessibilityRole="text">
      <Icon name="triangle-alert" size={20} color={colors.warning} />
      <Text variant="label" weight={500} style={{ flex: 1, color: colors.warning, lineHeight: 21 }}>
        <Text variant="label" style={{ color: colors.warning }}>
          {teks}
        </Text>{' '}
        {akhiran}
      </Text>
    </View>
  );
}

export function AlurPersetujuan({ flow }: { flow: LangkahAlur[] }): React.JSX.Element {
  const { colors } = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text variant="meta">Alur persetujuan</Text>
      <View style={s.alur}>
        {flow.map((l, i) => (
          <View key={l.step_order} style={s.langkah}>
            {i > 0 ? <Icon name="chevron-right" size={16} color={colors.subtle} /> : null}
            <Avatar name={l.approver?.name ?? l.label} size="sm" />
            <View style={{ flexShrink: 1 }}>
              <Text variant="label" numberOfLines={1}>
                {l.approver?.name ?? l.label}
              </Text>
              <Text variant="meta" numberOfLines={1}>
                {l.step_order} · {l.approver ? l.label.toLowerCase() : 'siapa pun pemegang peran'}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export function KartuRingkasan({
  jenis,
  nilai,
  data,
  memuat,
  staf,
}: {
  jenis: JenisForm;
  nilai: NilaiForm;
  data: Pratinjau | null;
  memuat: boolean;
  staf: boolean;
}): React.JSX.Element | null {
  const { colors } = useTheme();
  if (!data) {
    return memuat ? (
      <Card>
        <Skeleton width="40%" height={14} />
        <Skeleton width="60%" height={28} style={{ marginTop: 10 }} />
        <Skeleton width="80%" height={14} style={{ marginTop: 10 }} />
      </Card>
    ) : null;
  }
  const k = jenis.category;
  const p = data.period;
  let besar = '';
  let kecil = '';
  let tanggalKanan = '';
  let catatan = '';

  if (k === 'procurement') {
    const total = Number(nilai.quantity || 0) * Number(nilai.unit_price || 0);
    besar = total > 0 ? rupiah(total) : 'Rp —';
    kecil = '';
    tanggalKanan = `Dikirim ${hariTanggalPendek(new Date().toISOString())}`;
    catatan = `${nilai.quantity || 0} ${nilai.unit || 'unit'} · tanggal = tanggal kirim, tidak memengaruhi absensi`;
  } else if (p) {
    tanggalKanan = rentangTanggal(p.start_at, p.end_at);
    if (k === 'correction') {
      besar = 'Koreksi';
      kecil = '1 hari';
      const bagian = [nilai.check_in ? `Jam masuk ${nilai.check_in.replace(':', '.')}` : null, nilai.check_out ? `Jam pulang ${nilai.check_out.replace(':', '.')}` : null].filter(Boolean);
      catatan = bagian.join(' · ');
    } else if (p.minutes) {
      const teks = durasiMenit(p.minutes).split(' ');
      besar = teks[0] ?? '';
      kecil = teks.slice(1).join(' ');
    } else if (p.days !== null) {
      besar = angkaHari(p.days);
      kecil = jenis.counts_calendar_days ? 'hari' : 'hari kerja';
    }
    if (!catatan) {
      if (!staf && data.balance) {
        catatan = `Saldo ${data.balance.year}: ${angkaHari(data.balance.before)} → ${angkaHari(data.balance.after)} hari`;
      } else if (jenis.annual_quota_days === null && k !== 'overtime') {
        catatan = 'Tidak memotong saldo cuti';
      }
    }
  }

  const galatPeriode = data.errors ? Object.values(data.errors)[0] : null;

  return (
    <Card style={{ gap: 0, padding: 0 }}>
      <View style={{ padding: 16, gap: 4 }}>
        <View style={s.atas}>
          <Text variant="meta">Ringkasan</Text>
          <Text variant="meta">{tanggalKanan}</Text>
        </View>
        {galatPeriode ? (
          <View style={s.baris}>
            <Icon name="circle-alert" size={16} color={colors.danger} />
            <Text variant="label" weight={500} tone="danger" style={{ flex: 1 }}>
              {galatPeriode}
            </Text>
          </View>
        ) : besar ? (
          <Text>
            <Text variant="h1" weight={800}>
              {besar}
            </Text>
            {kecil ? (
              <Text variant="body" tone="muted">
                {` ${kecil}`}
              </Text>
            ) : null}
          </Text>
        ) : null}
        {catatan ? <Text variant="meta">{catatan}</Text> : null}
        {data.overlap ? (
          <View style={[s.peringatan, { backgroundColor: colors.dangerSoft, marginTop: 8 }]}>
            <Icon name="circle-alert" size={20} color={colors.danger} />
            <Text variant="label" weight={500} style={{ flex: 1, color: colors.danger }}>
              {data.overlap}
            </Text>
          </View>
        ) : null}
        {data.colleagues && data.colleagues.people.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <PeringatanRekan rekan={data.colleagues} />
          </View>
        ) : null}
      </View>
      {data.flow.length > 0 ? (
        <View style={[s.bawah, { borderTopColor: colors.divider }]}>
          <AlurPersetujuan flow={data.flow} />
        </View>
      ) : null}
    </Card>
  );
}

export function sapaPemutus(flow: LangkahAlur[]): string {
  const pertama = flow[0]?.approver?.name;
  return pertama ? `${pertama} sudah diberi tahu.` : 'Penyetuju sudah diberi tahu.';
}

const s = StyleSheet.create({
  atas: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  peringatan: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: radius.lg },
  bawah: { borderTopWidth: 1, padding: 16 },
  alur: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 10, columnGap: 6 },
  langkah: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
});
