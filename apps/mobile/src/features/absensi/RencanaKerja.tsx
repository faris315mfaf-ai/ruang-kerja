/**
 * Poin bernomor untuk absen: "Rencana kerja" (check-in) dan "Laporan kerja"
 * (check-out), 1–8 poin (maks. 300 karakter), baris punya kunci stabil. Keduanya
 * terkirim ke grup WhatsApp manajemen; rencana juga menjadi tugas pribadi.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Badge, Card, Icon, IconButton, Input, Pressable, Text } from '@/ui';

import { type PoinRencana } from './store';

const TEKS = {
  rencana: {
    judul: 'Rencana kerja hari ini',
    petunjuk: null,
    contoh: 'Mis. Selesaikan laporan mingguan',
    label: 'Poin rencana kerja',
    tambah: 'Tambah poin rencana kerja',
    penuh: 'Maksimal 8 poin rencana kerja.',
    bantu: 'Terkirim ke grup WhatsApp manajemen. Tiap poin juga menjadi tugas pribadi hari ini.',
  },
  laporan: {
    judul: 'Laporan kerja hari ini',
    petunjuk: 'Apa yang sudah Anda kerjakan hari ini?',
    contoh: 'Mis. Menyelesaikan laporan mingguan',
    label: 'Poin laporan kerja',
    tambah: 'Tambah poin laporan kerja',
    penuh: 'Maksimal 8 poin laporan kerja.',
    bantu: 'Ikut terkirim ke grup WhatsApp manajemen bersama foto selfie.',
  },
} as const;

export function RencanaKerja({
  jenis = 'rencana',
  galat = null,
  poin,
  ubah,
  tambah,
  hapus,
  onLihatPesan,
  wajib = true,
  disabled = false,
}: {
  /** `rencana` = check-in, `laporan` = check-out. */
  jenis?: 'rencana' | 'laporan';
  /** Galat validasi server (mis. `errors.work_report`), tampil di bawah isian. */
  galat?: string | null;
  poin: PoinRencana[];
  ubah: (id: string, teks: string) => void;
  tambah: () => string | null;
  hapus: (id: string) => void;
  /** Tanpa ini tautan "Lihat pesan" disembunyikan. */
  onLihatPesan?: () => void;
  wajib?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const [fokusId, setFokusId] = useState<string | null>(null);
  const penuh = poin.length >= 8;
  const t = TEKS[jenis];

  return (
    <Card style={{ gap: 12 }}>
      <View style={s.kepala}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="title" weight={700}>
            {t.judul}
          </Text>
          {t.petunjuk ? <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>{t.petunjuk}</Text> : null}
          <Text variant="meta">{wajib ? 'Wajib · ' : 'Opsional · '}1–8 poin, maks. 300 karakter</Text>
        </View>
        <Badge tone={wajib ? 'warning' : 'neutral'} dot={false}>
          {wajib ? 'Wajib' : 'Opsional'}
        </Badge>
      </View>

      {poin.map((p, i) => (
        <View key={p.id} style={s.baris}>
          <View style={[s.nomor, { backgroundColor: colors.linkSoft }]}>
            <Text variant="meta" weight={700} style={{ color: colors.link }}>
              {i + 1}
            </Text>
          </View>
          <Input
            value={p.teks}
            onChangeText={(t) => {
              if (t.includes('\n')) {
                // Enter pada kolom multibaris = poin baru (maks. 8).
                ubah(p.id, t.replace(/\n+/g, ' ').trimEnd());
                if (!penuh && t.replace(/\n/g, '').trim() !== '') {
                  setFokusId(tambah());
                }
                return;
              }
              ubah(p.id, t);
            }}
            placeholder={i === 0 ? t.contoh : `Poin ${i + 1}`}
            invalid={galat !== null && i === 0}
            maxLength={300}
            multiline
            editable={!disabled}
            autoFocus={fokusId === p.id}
            accessibilityLabel={`${t.label} ${i + 1}`}
            style={{ flex: 1, minHeight: 52, paddingVertical: 12, textAlignVertical: 'center' }}
          />
          {poin.length > 1 ? (
            <IconButton icon="circle-x" label={`Hapus poin ${i + 1}`} variant="ghost" size={44} onPress={() => hapus(p.id)} disabled={disabled} />
          ) : null}
        </View>
      ))}

      {galat ? (
        <Text variant="meta" tone="danger" accessibilityLiveRegion="polite" style={{ fontSize: 14, lineHeight: 20 }}>
          {galat}
        </Text>
      ) : null}

      {!penuh ? (
        <Pressable
          onPress={() => setFokusId(tambah())}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={t.tambah}
          style={[s.tambah, { borderColor: colors.borderStrong }]}
        >
          <Icon name="plus" size={20} color={colors.link} />
          <Text variant="label" weight={700} tone="link">
            Tambah poin
          </Text>
        </Pressable>
      ) : (
        <Text variant="meta">{t.penuh}</Text>
      )}

      <View style={s.bantu}>
        <Icon name="message-circle" size={18} color={colors.muted} />
        <Text variant="meta" style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
          {t.bantu}
        </Text>
      </View>
      {onLihatPesan ? (
        <Pressable onPress={onLihatPesan} accessibilityRole="button" accessibilityLabel="Lihat pesan yang akan dikirim" style={s.lihat}>
          <Icon name="eye" size={18} color={colors.link} />
          <Text variant="label" weight={700} tone="link">
            Lihat pesan yang akan dikirim
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({
  kepala: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomor: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tambah: { minHeight: 48, borderRadius: radius.control, borderWidth: 1.5, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bantu: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lihat: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
});
