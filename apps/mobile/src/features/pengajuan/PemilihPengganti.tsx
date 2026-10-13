/**
 * Pemilih pengganti selama cuti (`needs_substitute`): SelectField membuka
 * sheet bercari `GET /orang?q=` (karyawan aktif).
 */
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { ApiError } from '@/api/client';
import { cariRekan, type Orang } from '@/api/pengajuan';
import { Avatar, BottomSheet, Field, ListRow, Loading, SearchInput, SelectField, Text } from '@/ui';

export function PemilihPengganti({
  idTerpilih,
  namaTerpilih,
  onPilih,
  error,
  disabled = false,
}: {
  idTerpilih: string;
  namaTerpilih: string;
  onPilih: (orang: Orang | null) => void;
  error?: string | null;
  disabled?: boolean;
}): React.JSX.Element {
  const [buka, setBuka] = useState(false);
  const [q, setQ] = useState('');
  const [hasil, setHasil] = useState<Orang[]>([]);
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  useEffect(() => {
    if (!buka) {
      return;
    }
    let batal = false;
    const t = setTimeout(() => {
      setMemuat(true);
      cariRekan(q.trim())
        .then((orang) => {
          if (!batal) {
            setHasil(orang);
            setGalat(null);
          }
        })
        .catch((err: unknown) => {
          if (!batal) {
            setGalat(err instanceof ApiError ? err.message : 'Daftar rekan gagal dimuat.');
          }
        })
        .finally(() => {
          if (!batal) {
            setMemuat(false);
          }
        });
    }, 300);
    return () => {
      batal = true;
      clearTimeout(t);
    };
  }, [buka, q]);

  return (
    <>
      <Field label="Pengganti selama cuti" error={error} hint="Rekan yang menangani pekerjaan Anda.">
        <SelectField value={idTerpilih ? namaTerpilih || 'Rekan terpilih' : null} placeholder="Pilih rekan" onPress={() => setBuka(true)} disabled={disabled} invalid={!!error} accessibilityLabel="Pengganti selama cuti" />
      </Field>
      <BottomSheet visible={buka} onClose={() => setBuka(false)} title="Pilih pengganti" scrollable snapPoints={['85%']}>
        <View style={{ gap: 12 }}>
          <SearchInput value={q} onChangeText={setQ} placeholder="Cari nama rekan" autoFocus />
          {idTerpilih ? (
            <ListRow
              icon="x"
              title="Tanpa pengganti"
              onPress={() => {
                onPilih(null);
                setBuka(false);
              }}
              divider
            />
          ) : null}
          {memuat && hasil.length === 0 ? <Loading rows={4} /> : null}
          {galat ? (
            <Text variant="meta" tone="danger">
              {galat}
            </Text>
          ) : null}
          {!memuat && !galat && hasil.length === 0 ? <Text variant="meta">Tidak ada rekan yang cocok.</Text> : null}
          {hasil.map((o) => (
            <ListRow
              key={o.id}
              leading={<Avatar name={o.name} size="md" />}
              title={o.name}
              subtitle={[o.position, o.division].filter(Boolean).join(' · ') || undefined}
              trailing={o.id === idTerpilih ? <Text variant="label" tone="primary">Terpilih</Text> : undefined}
              onPress={() => {
                onPilih(o);
                setBuka(false);
              }}
              divider
            />
          ))}
        </View>
      </BottomSheet>
    </>
  );
}
