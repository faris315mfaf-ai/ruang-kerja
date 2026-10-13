/**
 * Satu gelembung pesan (mockup 07/08/14/15): nama penulis + avatar di ujung
 * kelompok, isi, lampiran Drive, jam/"disunting"/centang, chip reaksi,
 * ringkasan thread, dan keadaan kirim (mengirim / gagal terkirim).
 */
import { Linking, StyleSheet, View } from 'react-native';

import type { LampiranPesan, Pesan } from '@/api/obrolan';
import { jam } from '@/lib/format';
import { radius, useTheme } from '@/theme';
import { Avatar, AvatarStack, Gradient, Icon, Pressable, Text, toneColor } from '@/ui';

import { IsiPesan } from './IsiPesan';
import { ikonBerkas, LABEL_BERKAS, namaPenulis, pesanDihapus, ringkasReaksi, ukuranBerkas } from './util';

export type StatusKirim = 'terkirim' | 'mengirim' | 'gagal';

export interface GelembungProps {
  pesan: Pesan;
  saya: string | null;
  /** Kanal bernama (workspace/publik/privat/grup) memperlihatkan nama & avatar; DM tidak. */
  tampilIdentitas: boolean;
  awalKelompok: boolean;
  akhirKelompok: boolean;
  status?: StatusKirim;
  sorot?: string;
  /** Tampilkan ringkasan thread (hanya linimasa kanal). */
  tampilThread?: boolean;
  /** Teks status baca kecil di bawah gelembung milik sendiri ("Dibaca Maya, Rizky +1"). */
  labelBaca?: string | null;
  onTekanLama?: () => void;
  /** Ketuk gelembung (mis. hasil pencarian → buka thread). */
  onTekan?: () => void;
  onReaksi?: (emoji: string, aktif: boolean) => void;
  onBukaThread?: () => void;
  onCobaLagi?: () => void;
  onHapusGagal?: () => void;
  onTekanBaca?: () => void;
}

function KartuLampiran({ berkas, milikSaya }: { berkas: LampiranPesan; milikSaya: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const putih = toneColor(colors, 'onPrimary');
  const rincian = [LABEL_BERKAS[berkas.kind] ?? 'Berkas', ukuranBerkas(berkas.size_bytes)].filter((x) => x !== '').join(' · ');
  const aman = berkas.web_view_link !== null && /^https:\/\//i.test(berkas.web_view_link);
  return (
    <Pressable
      onPress={() => {
        if (aman) {
          void Linking.openURL(berkas.web_view_link as string).catch(() => undefined);
        }
      }}
      disabled={!aman}
      accessibilityRole="link"
      accessibilityLabel={`Buka ${berkas.name}, ${rincian}`}
      style={[s.lampiran, { backgroundColor: milikSaya ? 'rgba(255,255,255,0.18)' : colors.surface2 }]}
    >
      <View style={[s.ubinBerkas, { backgroundColor: milikSaya ? 'rgba(255,255,255,0.22)' : colors.infoSoft }]}>
        <Icon name={ikonBerkas(berkas.kind)} size={22} color={milikSaya ? putih : colors.info} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1} style={milikSaya ? { color: putih } : undefined}>
          {berkas.name}
        </Text>
        <Text variant="meta" numberOfLines={1} style={milikSaya ? { color: 'rgba(255,255,255,0.8)' } : undefined}>
          {rincian}
        </Text>
      </View>
      <Icon name="external-link" size={20} color={milikSaya ? putih : colors.muted} />
    </Pressable>
  );
}

export function Gelembung({
  pesan,
  saya,
  tampilIdentitas,
  awalKelompok,
  akhirKelompok,
  status = 'terkirim',
  sorot,
  tampilThread = false,
  labelBaca,
  onTekanLama,
  onTekan,
  onReaksi,
  onBukaThread,
  onCobaLagi,
  onHapusGagal,
  onTekanBaca,
}: GelembungProps): React.JSX.Element {
  const { colors, shadows } = useTheme();
  const milikSaya = saya !== null && pesan.user_id === saya;
  const dihapus = pesanDihapus(pesan);
  const nama = namaPenulis(pesan);
  const reaksi = dihapus ? [] : ringkasReaksi(pesan, saya);
  const balasan = pesan.reply_count ?? 0;
  const pending = status !== 'terkirim';
  const jamTeks = jam(pesan.created_at);
  const putih = toneColor(colors, 'onPrimary');

  const labelAksesibilitas = dihapus
    ? `${milikSaya ? 'Anda' : nama}, ${jamTeks}, pesan ini dihapus`
    : `${milikSaya ? 'Anda' : nama}, ${jamTeks}, ${pesan.body_text}${reaksi.length > 0 ? `, ${reaksi.reduce((n, r) => n + r.count, 0)} reaksi` : ''}${balasan > 0 ? `, ${balasan} balasan` : ''}`;

  const avatarKolom = !milikSaya && tampilIdentitas ? (
    <View style={s.kolomAvatar}>{akhirKelompok ? <Avatar name={nama} size="sm" /> : null}</View>
  ) : null;

  const isiBubble = dihapus ? (
    <Text variant="body" tone="subtle" style={{ fontStyle: 'italic' }}>
      {pesan.deleted_label ?? 'Pesan ini dihapus'}
    </Text>
  ) : (
    <>
      {pesan.body_text !== '' || pesan.body !== null ? <IsiPesan pesan={pesan} milikSaya={milikSaya} sorot={sorot} /> : null}
      {pesan.attachments.length > 0 ? (
        <View style={{ gap: 6, marginTop: pesan.body_text !== '' ? 6 : 0 }}>
          {pesan.attachments.map((b) => (
            <KartuLampiran key={b.id} berkas={b} milikSaya={milikSaya} />
          ))}
        </View>
      ) : null}
    </>
  );

  const meta = (
    <View style={s.meta}>
      {pesan.edited_at && !dihapus ? (
        <Text variant="meta" style={{ color: milikSaya ? 'rgba(255,255,255,0.85)' : colors.subtle, fontSize: 12 }}>
          disunting ·
        </Text>
      ) : null}
      <Text variant="meta" style={{ color: milikSaya ? 'rgba(255,255,255,0.85)' : colors.subtle, fontSize: 12 }}>
        {jamTeks}
      </Text>
      {milikSaya && !dihapus ? (
        <Icon
          name={status === 'mengirim' ? 'clock' : status === 'gagal' ? 'circle-alert' : 'check'}
          size={14}
          color={milikSaya ? putih : colors.subtle}
        />
      ) : null}
    </View>
  );

  const bubbleGaya = [
    s.bubble,
    { borderRadius: 20 },
    awalKelompok ? null : milikSaya ? { borderTopRightRadius: 8 } : { borderTopLeftRadius: 8 },
    akhirKelompok ? null : milikSaya ? { borderBottomRightRadius: 8 } : { borderBottomLeftRadius: 8 },
  ];

  const bubble = (
    <Pressable
      onPress={onTekan}
      onLongPress={onTekanLama}
      delayLongPress={350}
      scaleTo={0.99}
      disabled={!onTekanLama && !onTekan}
      accessible
      accessibilityLabel={labelAksesibilitas}
      accessibilityActions={onTekanLama ? [{ name: 'aksi', label: 'Buka aksi pesan' }] : undefined}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'aksi') {
          onTekanLama?.();
        }
      }}
      style={[
        ...bubbleGaya,
        dihapus
          ? { borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.borderStrong, backgroundColor: 'transparent' }
          : milikSaya
            ? { boxShadow: shadows.button, opacity: pending ? 0.75 : 1 }
            : { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, boxShadow: shadows.card },
      ]}
    >
      {milikSaya && !dihapus ? <Gradient name="aksi" style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} /> : null}
      {!milikSaya && awalKelompok && tampilIdentitas && nama !== '' ? (
        <Text variant="meta" weight={700} tone="link" numberOfLines={1} style={{ marginBottom: 2 }}>
          {nama}
        </Text>
      ) : null}
      {isiBubble}
      {dihapus ? null : meta}
    </Pressable>
  );

  return (
    <View style={[s.baris, milikSaya ? s.barisSaya : null, { marginTop: awalKelompok ? 10 : 2 }]}>
      {avatarKolom}
      <View style={[s.kolom, milikSaya ? { alignItems: 'flex-end' } : null]}>
        {bubble}

        {reaksi.length > 0 ? (
          <View style={[s.reaksi, milikSaya ? { justifyContent: 'flex-end' } : null]}>
            {reaksi.map((r) => (
              <Pressable
                key={r.emoji}
                onPress={() => onReaksi?.(r.emoji, !r.mine)}
                disabled={!onReaksi || (pesan.can !== undefined && !pesan.can.react)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Reaksi ${r.emoji}, ${r.count} orang${r.mine ? ', termasuk Anda' : ''}`}
                accessibilityState={{ selected: r.mine }}
                style={[
                  s.chip,
                  r.mine ? { backgroundColor: colors.linkSoft, borderColor: colors.primary } : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={{ fontSize: 15, lineHeight: 20 }} maxFontSizeMultiplier={1.3}>
                  {r.emoji}
                </Text>
                <Text variant="meta" weight={700} tone={r.mine ? 'link' : 'muted'}>
                  {r.count}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {tampilThread && balasan > 0 ? (
          <Pressable
            onPress={onBukaThread}
            accessibilityRole="button"
            accessibilityLabel={`${balasan} balasan, buka thread`}
            style={s.thread}
            hitSlop={6}
          >
            <AvatarStack names={(pesan.participants ?? []).map((p) => p.name)} max={3} size="sm" />
            <Text variant="label" weight={700} tone="link">
              {balasan} balasan
            </Text>
            {pesan.last_reply_at ? (
              <Text variant="meta">· {jam(pesan.last_reply_at)}</Text>
            ) : null}
            <Icon name="chevron-right" size={18} color={colors.link} />
          </Pressable>
        ) : null}

        {status === 'gagal' ? (
          <View style={s.gagal}>
            <Text variant="meta" weight={700} tone="danger">
              Gagal terkirim
            </Text>
            <Text variant="meta" weight={700} tone="link" onPress={onCobaLagi} accessibilityRole="button" style={s.tautan}>
              Coba lagi
            </Text>
            <Text variant="meta" weight={700} tone="muted" onPress={onHapusGagal} accessibilityRole="button" style={s.tautan}>
              Hapus
            </Text>
          </View>
        ) : null}

        {labelBaca ? (
          <Pressable onPress={onTekanBaca} accessibilityRole="button" accessibilityLabel={labelBaca} style={s.baca} hitSlop={6}>
            <Icon name="check-check" size={16} color={colors.link} />
            <Text variant="meta" weight={700} tone="link">
              {labelBaca}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.link} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 2 },
  barisSaya: { justifyContent: 'flex-end' },
  kolomAvatar: { width: 32, alignSelf: 'stretch', justifyContent: 'flex-end' },
  kolom: { maxWidth: '84%', flexShrink: 1, gap: 4 },
  bubble: { overflow: 'hidden', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8, minWidth: 64 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 2 },
  reaksi: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 32, paddingHorizontal: 10, borderRadius: radius.full, borderWidth: 1 },
  thread: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  gagal: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tautan: { textDecorationLine: 'underline', paddingVertical: 6 },
  baca: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  lampiran: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, minWidth: 220 },
  ubinBerkas: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
