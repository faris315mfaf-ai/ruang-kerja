/**
 * Kartu "Tugas hari ini" — segmen Pribadi · Tim · Semua (spec 02,
 * `03-tugas-hari-ini-keadaan`): lencana "dari absen" dan "penugasan atasan",
 * prioritas berwarna + teks, tugas selesai dicoret, kosong per segmen.
 * Ketuk baris → detail tugas.
 */
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { TugasBeranda, TugasHariIniBeranda } from '@/api/beranda';
import { useTheme } from '@/theme';
import { Badge, Card, Icon, Loading, Pressable, Segmented, SectionHeader, Tag, Text, type Tone } from '@/ui';

type Segmen = 'pribadi' | 'tim' | 'semua';

const KOSONG: Record<Segmen, { judul: string; deskripsi: string }> = {
  pribadi: { judul: 'Belum ada tugas pribadi hari ini', deskripsi: 'Tugas di workspace pribadi yang jatuh tempo hari ini.' },
  tim: { judul: 'Belum ada tugas tim hari ini', deskripsi: 'Tugas workspace tim, divisi, dan proyek Anda hari ini.' },
  semua: { judul: 'Belum ada tugas hari ini', deskripsi: 'Tugas pribadi dan tim yang jatuh tempo hari ini.' },
};

function toneStatus(kategori: string): Tone {
  switch (kategori) {
    case 'in_progress':
      return 'primary';
    case 'review':
      return 'info';
    case 'done':
      return 'success';
    default:
      return 'neutral';
  }
}

function tonePrioritas(label: string): Tone | null {
  const l = label.toLowerCase();
  if (l === 'urgent') {
    return 'danger';
  }
  if (l === 'tinggi') {
    return 'warning';
  }
  if (l === 'tanpa' || l === '') {
    return null;
  }
  return 'neutral';
}

function BarisTugas({ tugas, divider }: { tugas: TugasBeranda; divider: boolean }): React.JSX.Element {
  const { colors } = useTheme();
  const selesai = tugas.status.is_done;
  const prioritas = tonePrioritas(tugas.priority);

  return (
    <Pressable
      onPress={() => router.push(`/tugas/${tugas.id}`)}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityLabel={`Buka tugas ${tugas.title}, ${tugas.status.name}${selesai ? ', selesai' : ''}`}
      style={{
        flexDirection: 'row',
        gap: 12,
        paddingVertical: 12,
        minHeight: 64,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: colors.divider,
      }}
    >
      <View style={{ paddingTop: 2 }}>
        <Icon
          name={selesai ? 'circle-check' : tugas.status.category === 'in_progress' ? 'circle-dot' : 'circle'}
          size={26}
          color={selesai ? colors.success : tugas.status.category === 'in_progress' ? colors.primary : colors.subtle}
        />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
          <Text
            variant="title"
            numberOfLines={2}
            style={{ flex: 1, textDecorationLine: selesai ? 'line-through' : 'none', color: selesai ? colors.muted : colors.text }}
          >
            {tugas.title}
          </Text>
          <Badge tone={toneStatus(tugas.status.category)}>{tugas.status.name}</Badge>
        </View>
        <Text variant="meta" numberOfLines={1}>
          {`${tugas.key} · ${tugas.workspace.name}`}
        </Text>
        {tugas.source === 'attendance' || tugas.assigned_by_other || (prioritas !== null && !selesai) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {tugas.source === 'attendance' ? (
              <Tag tone="primary">dari absen</Tag>
            ) : null}
            {tugas.assigned_by_other ? <Tag tone="info">penugasan atasan</Tag> : null}
            {prioritas !== null && !selesai ? <Tag tone={prioritas}>{tugas.priority}</Tag> : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function KartuTugasHariIni({ data }: { data: TugasHariIniBeranda }): React.JSX.Element {
  const [segmen, setSegmen] = useState<Segmen>('pribadi');
  const items = data[segmen];

  return (
    <Card style={{ gap: 12 }}>
      <SectionHeader title="Tugas hari ini" actionLabel="Kelola tugas" onAction={() => router.push('/(tabs)/tugas')} />
      <Segmented<Segmen>
        value={segmen}
        onChange={setSegmen}
        options={[
          { value: 'pribadi', label: 'Pribadi', badge: data.counts.pribadi },
          { value: 'tim', label: 'Tim', badge: data.counts.tim },
          { value: 'semua', label: 'Semua', badge: data.counts.semua },
        ]}
      />
      {items.length === 0 ? (
        <View style={{ alignItems: 'center', gap: 4, paddingVertical: 20 }}>
          <Text variant="title" align="center">
            {KOSONG[segmen].judul}
          </Text>
          <Text variant="meta" align="center" style={{ fontSize: 14, lineHeight: 20 }}>
            {KOSONG[segmen].deskripsi}
          </Text>
        </View>
      ) : (
        <View>
          {items.map((tugas, i) => (
            <BarisTugas key={tugas.id} tugas={tugas} divider={i > 0} />
          ))}
        </View>
      )}
    </Card>
  );
}

/** Kerangka kartu saat memuat: segmen & judul tetap, baris skeleton. */
export function KerangkaTugasHariIni(): React.JSX.Element {
  return (
    <Card style={{ gap: 12 }}>
      <SectionHeader title="Tugas hari ini" />
      <Segmented<Segmen>
        value="pribadi"
        onChange={() => undefined}
        options={[
          { value: 'pribadi', label: 'Pribadi' },
          { value: 'tim', label: 'Tim' },
          { value: 'semua', label: 'Semua' },
        ]}
      />
      <Loading label="Memuat tugas hari ini…" rows={3} />
    </Card>
  );
}
