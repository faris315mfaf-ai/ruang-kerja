/**
 * Struktur organisasi (mockup 11 › 06): daftar bertingkat Direksi → divisi →
 * tim → orang (bukan bagan), cari orang/unit di klien, buka/ciutkan semua.
 * Unduh PNG ditunda di ponsel (keputusan pemilik): menu ⋯ menampilkan banner
 * desktop + Kirim tautan. Staf → 404 "Halaman tidak ditemukan".
 * `GET /organisasi/struktur` (docs/sesi/ponsel-b5b-hr.md §3).
 */
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { strukturOrganisasi, type OrangStruktur, type StrukturOrganisasi, type TimStruktur, type UnitStruktur } from '@/api/hr';
import { usePeranHr } from '@/features/hr/akses';
import { useMuat } from '@/features/hr/useMuat';
import { useTautanDesktop } from '@/features/hr/useTautanDesktop';
import { jam } from '@/lib/format';
import { useTheme } from '@/theme';
import { Avatar, Banner, BottomSheet, Card, DesktopOnlyBanner, EmptyState, ErrorState, Icon, Loading, LockedState, Pressable, Screen, SearchInput, SheetAction, SubAppBar, Tag, Text, errorKindFromStatus } from '@/ui';

function cocok(o: OrangStruktur | null, q: string): boolean {
  return o !== null && (o.name.toLowerCase().includes(q) || (o.position ?? '').toLowerCase().includes(q));
}

function saringTim(t: TimStruktur, q: string): TimStruktur | null {
  if (t.name.toLowerCase().includes(q) || (t.code ?? '').toLowerCase() === q) return t;
  const anggota = t.members.filter((o) => cocok(o, q));
  const ketua = cocok(t.lead, q) ? t.lead : null;
  return ketua || anggota.length > 0 ? { ...t, lead: ketua, members: anggota } : null;
}

function saringUnit(u: UnitStruktur, q: string): UnitStruktur | null {
  if (u.name.toLowerCase().includes(q) || (u.code ?? '').toLowerCase() === q) return u;
  const kepala = cocok(u.head, q) ? u.head : null;
  const tim = u.teams.map((t) => saringTim(t, q)).filter((t): t is TimStruktur => t !== null);
  const anggota = u.members.filter((o) => cocok(o, q));
  const anak = u.children.map((c) => saringUnit(c, q)).filter((c): c is UnitStruktur => c !== null);
  return kepala || tim.length || anggota.length || anak.length ? { ...u, head: kepala, teams: tim, members: anggota, children: anak } : null;
}

function semuaId(units: UnitStruktur[]): string[] {
  return units.flatMap((u) => [u.id, ...semuaId(u.children)]);
}

export default function StrukturLayar(): React.JSX.Element {
  const { colors } = useTheme();
  const peran = usePeranHr();
  const m = useMuat<StrukturOrganisasi>('struktur', strukturOrganisasi);
  const tautan = useTautanDesktop();
  const [cari, setCari] = useState('');
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  const [menu, setMenu] = useState(false);
  const d = m.data;
  const q = cari.trim().toLowerCase();

  const hasil = useMemo(() => {
    if (!d) return null;
    if (q === '') return { board: d.chart.board, divisions: d.chart.divisions, unassigned: d.chart.unassigned };
    return {
      board: d.chart.board ? saringUnit(d.chart.board, q) : null,
      divisions: d.chart.divisions.map((u) => saringUnit(u, q)).filter((u): u is UnitStruktur => u !== null),
      unassigned: d.chart.unassigned.filter((o) => cocok(o, q)),
    };
  }, [d, q]);

  if (m.galat && (m.galat.status === 404 || m.galat.status === 403)) {
    return (
      <Screen header={<SubAppBar title="Struktur organisasi" />} contentStyle={{ paddingTop: 24 }}>
        <LockedState
          title="Halaman tidak ditemukan"
          reason="Peran Anda tidak memiliki akses ke halaman ini. Struktur organisasi tidak tersedia untuk staf."
          actionLabel="Kembali ke Beranda"
          onAction={() => router.replace('/' as never)}
        />
      </Screen>
    );
  }

  const bukaProfil = peran.perusahaan ? (o: OrangStruktur) => router.push(`/karyawan/${o.id}` as never) : undefined;
  const ubah = (id: string): void => {
    setTerbuka((lama) => {
      const baru = new Set(lama);
      if (baru.has(id)) baru.delete(id);
      else baru.add(id);
      return baru;
    });
  };
  const kosong = d !== null && d.chart.board === null && d.chart.divisions.length === 0 && d.chart.unassigned.length === 0;
  const tanpaHasil = hasil !== null && q !== '' && hasil.board === null && hasil.divisions.length === 0 && hasil.unassigned.length === 0;

  return (
    <Screen
      header={<SubAppBar title="Struktur organisasi" actions={d ? [{ icon: 'ellipsis-vertical', label: 'Menu lainnya', onPress: () => setMenu(true) }] : []} />}
      refreshing={m.menyegarkan}
      onRefresh={() => void m.muatUlang('tarik')}
    >
      {m.offlineSejak !== null ? <Banner tone="neutral" icon="cloud-off" message={`Anda sedang offline. Menampilkan data tersimpan pukul ${jam(new Date(m.offlineSejak))}.`} /> : null}
      {d ? (
        <Text variant="body" tone="muted">
          {`${d.chart.companyName} · ${d.chart.stats.divisions} divisi · ${d.chart.stats.teams} tim · ${d.chart.stats.people} orang`}
        </Text>
      ) : null}
      {d && !kosong ? <SearchInput value={cari} onChangeText={setCari} placeholder="Cari orang atau unit" /> : null}
      {m.memuat && !d ? (
        <Loading rows={6} label="Memuat struktur organisasi…" />
      ) : m.galat && !d ? (
        <ErrorState message={m.galat.pesan} kind={errorKindFromStatus(m.galat.status)} onRetry={() => void m.muatUlang()} />
      ) : kosong ? (
        <EmptyState icon="network" title="Struktur organisasi belum diisi" description="Bagan dibuat otomatis setelah HR mengisi divisi, tim, dan atasan langsung." />
      ) : tanpaHasil ? (
        <EmptyState icon="search-x" title="Tidak ada yang cocok" description={`Tidak ada orang atau unit yang cocok dengan “${cari.trim()}”.`} actionLabel="Hapus pencarian" onAction={() => setCari('')} />
      ) : hasil ? (
        <>
          {hasil.board ? (
            <Card style={{ gap: 6 }}>
              <Text variant="overline">{`Direksi · ${hasil.board.size} orang`}</Text>
              {[hasil.board.head, ...hasil.board.members].filter((o): o is OrangStruktur => o !== null).map((o) => (
                <BarisOrang key={o.id} o={o} onPress={bukaProfil} />
              ))}
            </Card>
          ) : null}
          {hasil.divisions.map((u, i) => (
            <KartuUnit key={u.id} u={u} indeks={i} terbuka={q !== '' || terbuka.has(u.id)} terbukaSet={q !== '' ? null : terbuka} onUbah={ubah} onOrang={bukaProfil} />
          ))}
          {hasil.unassigned.length > 0 ? (
            <Card style={{ gap: 6 }}>
              <Text variant="overline">{`Belum ditempatkan · ${hasil.unassigned.length} orang`}</Text>
              {hasil.unassigned.map((o) => (
                <BarisOrang key={o.id} o={o} onPress={bukaProfil} />
              ))}
            </Card>
          ) : null}
          {q !== '' ? (
            <Text variant="meta" style={{ fontSize: 14 }} accessibilityLiveRegion="polite">
              {`Hasil pencarian “${cari.trim()}”.`}
            </Text>
          ) : null}
          <Text variant="meta" style={{ fontSize: 14, color: colors.muted }}>
            Dibuat otomatis dari data divisi, tim, dan atasan langsung.
          </Text>
        </>
      ) : null}
      <BottomSheet visible={menu} onClose={() => setMenu(false)} title="Struktur organisasi">
        <DesktopOnlyBanner
          message="Unduh PNG bagan lengkap tersedia di desktop."
          onSendLink={
            d && !tautan.mengirim
              ? () => {
                  setMenu(false);
                  tautan.kirim(d.web_path, 'Struktur organisasi');
                }
              : undefined
          }
        />
        <SheetAction
          icon="chevrons-up-down"
          label="Buka semua divisi"
          onPress={() => {
            setTerbuka(new Set(d ? semuaId(d.chart.divisions) : []));
            setMenu(false);
          }}
        />
        <SheetAction
          icon="chevrons-down-up"
          label="Ciutkan semua"
          onPress={() => {
            setTerbuka(new Set());
            setMenu(false);
          }}
        />
      </BottomSheet>
    </Screen>
  );
}

function BarisOrang({ o, label, onPress }: { o: OrangStruktur; label?: string; onPress?: (o: OrangStruktur) => void }): React.JSX.Element {
  const isi = (
    <>
      <Avatar name={o.name} size="sm" />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="label">{o.name}</Text>
          {label ? <Tag tone="primary">{label}</Tag> : null}
        </View>
        {o.position ? (
          <Text variant="meta" style={{ fontSize: 14 }}>
            {o.position}
          </Text>
        ) : null}
      </View>
    </>
  );
  const a11y = `${o.name}${label ? `, ${label}` : ''}${o.position ? `, ${o.position}` : ''}`;
  return onPress ? (
    <Pressable onPress={() => onPress(o)} scaleTo={1} accessibilityRole="button" accessibilityLabel={`${a11y}, buka profil`} style={s.orang}>
      {isi}
    </Pressable>
  ) : (
    <View style={s.orang} accessible accessibilityLabel={a11y}>
      {isi}
    </View>
  );
}

function KartuUnit({
  u,
  indeks,
  terbuka,
  terbukaSet,
  onUbah,
  onOrang,
  anak = false,
}: {
  u: UnitStruktur;
  indeks: number;
  terbuka: boolean;
  /** null = semua terbuka (mode cari). */
  terbukaSet: Set<string> | null;
  onUbah: (id: string) => void;
  onOrang?: (o: OrangStruktur) => void;
  anak?: boolean;
}): React.JSX.Element {
  const { colors } = useTheme();
  const penanda = [colors.fill.teal, colors.accentBlue, colors.fill.violet, colors.fill.warning][indeks % 4];
  const kepala = (
    <Pressable
      onPress={() => onUbah(u.id)}
      scaleTo={1}
      accessibilityRole="button"
      accessibilityState={{ expanded: terbuka }}
      accessibilityLabel={`${u.name}${u.code ? ` ${u.code}` : ''}, ${u.head ? `kepala ${u.head.name}, ` : ''}${u.size} orang`}
      style={s.kepalaUnit}
    >
      <View style={[s.penanda, { backgroundColor: penanda }]} />
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text variant="title">{u.name}</Text>
          {u.code ? <Tag tone="neutral">{u.code}</Tag> : null}
        </View>
        <Text variant="meta" style={{ fontSize: 14 }}>
          {`${u.head ? `${u.head.name} · ` : ''}${u.size} orang`}
        </Text>
      </View>
      <Icon name={terbuka ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
    </Pressable>
  );
  const isi = terbuka ? (
    <View style={{ gap: 8, paddingLeft: 8 }}>
      {u.head ? <BarisOrang o={u.head} label="Kepala" onPress={onOrang} /> : null}
      {u.teams.map((t) => (
        <View key={t.id} style={[s.tim, { borderLeftColor: colors.border }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="label">{t.name}</Text>
            {t.code ? <Tag tone="neutral">{t.code}</Tag> : null}
            <Text variant="meta" style={{ fontSize: 14 }}>
              {`· ${t.size} orang`}
            </Text>
          </View>
          {t.lead ? <BarisOrang o={t.lead} label="Ketua" onPress={onOrang} /> : null}
          {t.members.map((o) => (
            <BarisOrang key={o.id} o={o} onPress={onOrang} />
          ))}
        </View>
      ))}
      {u.members.map((o) => (
        <BarisOrang key={o.id} o={o} onPress={onOrang} />
      ))}
      {u.children.map((c, i) => (
        <KartuUnit key={c.id} u={c} indeks={indeks + i + 1} terbuka={terbukaSet === null || terbukaSet.has(c.id)} terbukaSet={terbukaSet} onUbah={onUbah} onOrang={onOrang} anak />
      ))}
    </View>
  ) : null;
  return anak ? (
    <View style={[s.anak, { borderColor: colors.border }]}>
      {kepala}
      {isi}
    </View>
  ) : (
    <Card style={{ gap: 8 }}>
      {kepala}
      {isi}
    </Card>
  );
}

const s = StyleSheet.create({
  orang: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48, paddingVertical: 4 },
  kepalaUnit: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  penanda: { width: 6, alignSelf: 'stretch', borderRadius: 3 },
  tim: { borderLeftWidth: 2, paddingLeft: 12, gap: 4 },
  anak: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 8 },
});
