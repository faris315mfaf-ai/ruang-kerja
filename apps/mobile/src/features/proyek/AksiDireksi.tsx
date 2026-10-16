/**
 * Aksi pengarah Direksi (mockup 06 › 03, 10): sheet "Minta update" (catatan
 * opsional ≤500), sheet "Beri arahan" (wajib ≤2.000, boleh mengutip update/
 * hambatan), dialog "Tandai keputusan selesai?" (label keputusan pemilik:
 * "Tandai selesai", bukan "Setujui"). Server tidak punya urungkan untuk minta
 * update/arahan → dikirim setelah jeda "Urungkan" 6 detik.
 */
import { useState } from 'react';
import { View } from 'react-native';

import { beriArahan, mintaUpdate, tandaiKeputusanSelesai } from '@/api/proyek';
import { useTheme } from '@/theme';
import { BottomSheet, Button, Field, Input, Text, useDialog, useSnackbar } from '@/ui';

import { pesanGalat, useTundaKirim } from './tunda';

type Target =
  | { jenis: 'minta'; key: string; nama: string; pic: string | null }
  | { jenis: 'arahan'; key: string; nama: string; updateId: string | null; kutipan: string | null; pic: string | null };

export interface AksiDireksi {
  mintaUpdate: (p: { key: string; nama: string; pic: string | null }) => void;
  beriArahan: (p: { key: string; nama: string; pic: string | null; updateId?: string | null; kutipan?: string | null }) => void;
  tandaiSelesai: (p: { key: string; updateId: string; keputusan: string }) => Promise<void>;
  elemen: React.ReactNode;
}

export function useAksiDireksi(onBerubah?: () => void): AksiDireksi {
  const [target, setTarget] = useState<Target | null>(null);
  const dialog = useDialog();
  const snackbar = useSnackbar();

  const tandaiSelesai = async ({ key, updateId, keputusan }: { key: string; updateId: string; keputusan: string }): Promise<void> => {
    const ok = await dialog.confirm({
      title: 'Tandai keputusan selesai?',
      message: `"${keputusan}"\n\nPIC diberi tahu bahwa keputusan ini sudah ditangani. Ini tidak sama dengan persetujuan formal.`,
      confirmLabel: 'Tandai selesai',
    });
    if (!ok) return;
    try {
      const r = await tandaiKeputusanSelesai(key, updateId);
      snackbar.show({ message: r.message, variant: 'ok' });
      onBerubah?.();
    } catch (err) {
      snackbar.show({ message: pesanGalat(err, 'Keputusan gagal ditandai selesai.'), variant: 'bad' });
      onBerubah?.();
    }
  };

  return {
    mintaUpdate: (p) => setTarget({ jenis: 'minta', ...p }),
    beriArahan: (p) => setTarget({ jenis: 'arahan', key: p.key, nama: p.nama, pic: p.pic, updateId: p.updateId ?? null, kutipan: p.kutipan ?? null }),
    tandaiSelesai,
    elemen: <SheetAksi target={target} onClose={() => setTarget(null)} onTerkirim={onBerubah} />,
  };
}

function SheetAksi({ target, onClose, onTerkirim }: { target: Target | null; onClose: () => void; onTerkirim?: () => void }): React.JSX.Element {
  const { colors } = useTheme();
  const tunda = useTundaKirim();
  const [teks, setTeks] = useState('');
  const [galat, setGalat] = useState<string | null>(null);
  const [kunciLama, setKunciLama] = useState<Target | null>(null);
  if (target !== kunciLama) {
    setKunciLama(target);
    setTeks('');
    setGalat(null);
  }
  const arahan = target?.jenis === 'arahan';
  const batas = arahan ? 2000 : 500;

  const kirim = (): void => {
    if (!target) return;
    const isi = teks.trim();
    if (arahan && isi === '') {
      setGalat('Tulis arahan untuk PIC.');
      return;
    }
    if (isi.length > batas) {
      setGalat(arahan ? 'Arahan maksimal 2.000 karakter.' : 'Catatan maksimal 500 karakter.');
      return;
    }
    const t = target;
    onClose();
    if (t.jenis === 'minta') {
      tunda({
        pesan: `Permintaan update ke ${t.pic ?? 'PIC'} akan dikirim.`,
        kirim: () => mintaUpdate(t.key, isi === '' ? null : isi).then((r) => r.message),
        selesai: onTerkirim,
      });
    } else {
      tunda({
        pesan: `Arahan untuk ${t.pic ?? 'PIC'} akan dikirim.`,
        kirim: () => beriArahan(t.key, isi, t.updateId).then((r) => r.message),
        selesai: onTerkirim,
      });
    }
  };

  return (
    <BottomSheet visible={target !== null} onClose={onClose} title={arahan ? 'Beri arahan' : 'Minta update'} showClose>
      {target ? (
        <View style={{ gap: 16 }}>
          <Text variant="body" tone="muted" style={{ fontSize: 15, lineHeight: 22 }}>
            {arahan
              ? `${target.nama} · arahan dikirim ke ${target.pic ?? 'PIC'} sebagai notifikasi dan tampil di riwayat update.`
              : `${target.nama} · ${target.pic ?? 'PIC'} mendapat notifikasi "Perlu tindakan" untuk menulis update.`}
          </Text>
          {target.jenis === 'arahan' && target.kutipan ? (
            <View style={{ borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12, paddingVertical: 4 }} accessible accessibilityLabel={`Mengutip: ${target.kutipan}`}>
              <Text variant="meta">Mengutip update</Text>
              <Text variant="body" style={{ fontSize: 15 }} numberOfLines={4}>
                {target.kutipan}
              </Text>
            </View>
          ) : null}
          <Field label={arahan ? 'Arahan' : 'Catatan (opsional)'} required={arahan} error={galat} counter={`${teks.length}/${batas}`}>
            <Input
              value={teks}
              onChangeText={(v) => {
                setTeks(v);
                setGalat(null);
              }}
              multiline
              maxLength={batas}
              invalid={galat !== null}
              placeholder={arahan ? 'Mis. Prioritaskan landing page, kutipan saya kirim Rabu.' : 'Mis. Mohon sertakan status vendor video.'}
              accessibilityLabel={arahan ? 'Arahan untuk PIC' : 'Catatan permintaan update'}
            />
          </Field>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button title="Batal" variant="outline" onPress={onClose} style={{ flex: 1 }} />
            <Button title={arahan ? 'Kirim arahan' : 'Minta update'} icon="send" onPress={kirim} style={{ flex: 1.4 }} />
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}
