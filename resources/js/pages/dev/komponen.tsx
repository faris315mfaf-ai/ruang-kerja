import { Head } from '@inertiajs/react';
import {
    Bell,
    CheckSquare,
    ChevronDown,
    CircleAlert,
    Download,
    Info,
    MoreHorizontal,
    Plus,
    Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';
import { EmptyState } from '@/components/empty-state';
import { ThemeSegmented } from '@/components/shell/theme-segmented';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import type { BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/ui/kpi-card';
import { Label } from '@/components/ui/label';
import { ListRow } from '@/components/ui/list-row';
import { Panel, PanelLink } from '@/components/ui/panel';
import { Progress } from '@/components/ui/progress';
import { Radio } from '@/components/ui/radio';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { SegmentedTabs, TabNav } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** Section card of this page (Komponen.dc.html: radius 24, padding 28). */
function Section({
    title,
    note,
    children,
    className,
}: {
    title: string;
    note?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'flex min-w-0 flex-col gap-5 rounded-panel border border-border bg-surface p-7 shadow-card',
                className,
            )}
        >
            <h2 className="text-[21px] leading-7 font-bold">{title}</h2>
            {children}
            {note && (
                <p className="text-[15px] leading-[22px] text-text-muted">
                    {note}
                </p>
            )}
        </section>
    );
}

function Swatch({ name, className }: { name: string; className: string }) {
    return (
        <div className="flex items-center gap-2.5">
            <span
                aria-hidden
                className={cn(
                    'h-8 w-10 shrink-0 rounded-[9px] ring-1 ring-border-strong ring-inset',
                    className,
                )}
            />
            <span className="font-mono text-[13px] font-semibold">{name}</span>
        </div>
    );
}

const SURFACES = [
    ['bg', 'bg-background'],
    ['surface', 'bg-surface'],
    ['surface-2', 'bg-surface-2'],
    ['border', 'bg-border'],
    ['border-strong', 'bg-border-strong'],
    ['text', 'bg-text'],
    ['text-muted', 'bg-text-muted'],
    ['text-subtle', 'bg-text-subtle'],
] as const;

const GRADIENTS = [
    ['grad-aksi', 'bg-grad-aksi', 'Tombol utama, ubin aktif, KPI sorotan'],
    ['grad-merek', 'bg-grad-merek', 'Logo, avatar workspace, isian grafik'],
    ['grad-hangat', 'bg-grad-hangat', 'Perhatian, maks. satu per layar'],
    ['grad-indigo', 'bg-grad-indigo', 'Identitas kedua, workspace'],
] as const;

const BADGES: { label: string; tone: BadgeTone }[] = [
    { label: 'Hadir', tone: 'success' },
    { label: 'Terlambat 12 mnt', tone: 'warning' },
    { label: 'Alpha', tone: 'danger' },
    { label: 'Cuti', tone: 'info' },
    { label: 'WFH', tone: 'link' },
    { label: 'Sesuai jalur', tone: 'success' },
    { label: 'Berisiko', tone: 'warning' },
    { label: 'Bermasalah', tone: 'danger' },
];

const TYPE_SCALE = [
    ['text-display', 'Selamat pagi, Dimas'],
    ['text-h1', 'Portofolio proyek'],
    ['text-h2', 'Menunggu persetujuan'],
    ['text-h3', 'Tren penyelesaian 8 minggu'],
    ['text-title', 'Finalisasi anggaran peluncuran'],
    ['text-body-lg', 'Teks pengantar dan isi deskripsi tugas.'],
    ['text-body', 'Teks dasar antarmuka: daftar, tabel, formulir.'],
    ['text-label', 'Setujui · Ajukan cuti · Tugas baru'],
    ['text-meta text-text-muted', 'Sari Wulandari · 2 jam lalu · PLQ-18'],
    ['text-overline text-text-muted', 'Label seksi'],
    ['text-kpi', '78% · 12 / 14'],
] as const;

/**
 * /dev/komponen — living style guide of the Arus design system (local env,
 * Super Admin). Mirrors docs/ruangkerja-design/screens/Komponen.dc.html plus
 * the foundations (Main, Tipografi, Ruang) so module screens can be checked
 * against real components in light and night.
 */
export default function StyleGuide() {
    const [period, setPeriod] = useState<'minggu' | 'bulan' | 'kuartal'>(
        'minggu',
    );
    const [email, setEmail] = useState(true);
    const [whatsapp, setWhatsapp] = useState(false);
    const [dark, setDark] = useState(true);

    return (
        <>
            <Head title="Komponen Arus" />
            <div className="flex flex-col gap-8">
                <header className="flex flex-wrap items-end justify-between gap-5">
                    <div className="flex flex-col gap-3">
                        <span className="text-overline text-link">
                            Fondasi desain · 04
                        </span>
                        <h1 className="text-display">Komponen</h1>
                        <p className="max-w-[760px] text-body-lg text-text-muted">
                            Primitif sistem desain Arus. Bandingkan dengan
                            docs/ruangkerja-design/screens/Komponen.dc.html;
                            ganti tema untuk mode malam.
                        </p>
                    </div>
                    <ThemeSegmented />
                </header>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Section
                        title="Tombol"
                        note="Satu tombol gradien per area. Fokus: cincin 3px teal 40% di luar tombol."
                    >
                        <div className="flex flex-wrap items-center gap-3">
                            <Button>
                                <Plus strokeWidth={2.2} />
                                Tugas baru
                            </Button>
                            <Button variant="outline">Ekspor</Button>
                            <Button variant="tonal">Minta update</Button>
                            <Button variant="quiet">Batal</Button>
                            <Button variant="destructive">Tolak</Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                            <Button size="lg">Check-in sekarang</Button>
                            <Button variant="outline" size="sm">
                                Kecil
                            </Button>
                            <Button disabled>Nonaktif</Button>
                            <Button
                                variant="outline"
                                size="icon"
                                aria-label="Lainnya"
                            >
                                <MoreHorizontal />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Notifikasi"
                            >
                                <Bell />
                            </Button>
                            <Button variant="secondary">Sekunder</Button>
                            <Button variant="link">Tautan</Button>
                        </div>
                    </Section>

                    <Section title="Input & formulir">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="k-judul">Judul tugas</Label>
                                <Input
                                    id="k-judul"
                                    defaultValue="Finalisasi anggaran peluncuran"
                                />
                                <span className="text-[14px] text-text-muted">
                                    Maksimal 255 karakter
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="k-pj">Penanggung jawab</Label>
                                <Input id="k-pj" placeholder="Cari orang" />
                                <span className="text-[14px] text-link">
                                    Klik untuk keadaan fokus
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="k-tgl">
                                    Tanggal mulai cuti
                                </Label>
                                <Input
                                    id="k-tgl"
                                    defaultValue="12/10/2025"
                                    aria-invalid
                                    aria-describedby="k-tgl-err"
                                />
                                <span
                                    id="k-tgl-err"
                                    className="flex items-center gap-1.5 text-[14px] font-semibold text-danger"
                                >
                                    <CircleAlert
                                        className="size-4"
                                        aria-hidden
                                    />
                                    Tanggal sudah lewat
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="k-jenis">Jenis pengajuan</Label>
                                <Select defaultValue="cuti">
                                    <SelectTrigger
                                        id="k-jenis"
                                        className="w-full"
                                    >
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="cuti">
                                            Cuti tahunan
                                        </SelectItem>
                                        <SelectItem value="izin">
                                            Izin
                                        </SelectItem>
                                        <SelectItem value="lembur">
                                            Lembur
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                                <span className="text-[14px] text-text-muted">
                                    Sisa saldo 9 hari
                                </span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-2">
                            <Label htmlFor="k-alasan">Alasan</Label>
                            <Textarea
                                id="k-alasan"
                                defaultValue="Acara keluarga di Yogyakarta"
                            />
                        </div>
                    </Section>

                    <Section title="Pilihan & tab">
                        <SegmentedTabs
                            label="Periode"
                            value={period}
                            onValueChange={setPeriod}
                            options={[
                                { value: 'minggu', label: 'Minggu ini' },
                                { value: 'bulan', label: 'Bulan ini' },
                                { value: 'kuartal', label: 'Kuartal' },
                            ]}
                            className="self-start"
                        />
                        <SegmentedTabs
                            label="Periode (gradien)"
                            value={period}
                            onValueChange={setPeriod}
                            variant="solid"
                            options={[
                                { value: 'minggu', label: 'Harian' },
                                { value: 'bulan', label: 'Mingguan' },
                                { value: 'kuartal', label: 'Bulanan' },
                            ]}
                            className="self-start"
                        />
                        <TabNav
                            label="Bagian workspace"
                            items={[
                                {
                                    href: '/dev/komponen',
                                    label: 'Tugas',
                                    active: true,
                                },
                                {
                                    href: '/dev/komponen#dokumen',
                                    label: 'Dokumen',
                                    count: 6,
                                    active: false,
                                },
                                {
                                    href: '/dev/komponen#file',
                                    label: 'File',
                                    count: 24,
                                    active: false,
                                },
                                {
                                    href: '/dev/komponen#aktivitas',
                                    label: 'Aktivitas',
                                    active: false,
                                },
                            ]}
                        />
                        <div className="flex flex-wrap items-center gap-7">
                            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[16px]">
                                <Checkbox
                                    checked={email}
                                    onCheckedChange={(value) =>
                                        setEmail(value === true)
                                    }
                                />
                                Kirim email
                            </label>
                            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[16px]">
                                <Checkbox
                                    checked={whatsapp}
                                    onCheckedChange={(value) =>
                                        setWhatsapp(value === true)
                                    }
                                />
                                WhatsApp
                            </label>
                            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[16px]">
                                <Radio name="durasi" defaultChecked />
                                Hari penuh
                            </label>
                            <label className="inline-flex cursor-pointer items-center gap-2.5 text-[16px]">
                                <Radio name="durasi" />
                                Setengah hari
                            </label>
                            <span className="inline-flex items-center gap-3 text-[16px]">
                                <Switch
                                    size="md"
                                    checked={dark}
                                    onCheckedChange={setDark}
                                    aria-label="Mode gelap"
                                />
                                Mode gelap
                            </span>
                        </div>
                    </Section>

                    <Section title="Badge, status & label">
                        <div className="flex flex-wrap gap-2.5">
                            {BADGES.map((badge) => (
                                <Badge
                                    key={badge.label}
                                    variant="status"
                                    tone={badge.tone}
                                    dot
                                >
                                    {badge.label}
                                </Badge>
                            ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5">
                            <Badge variant="label">Keuangan</Badge>
                            <Badge variant="label" tone="info">
                                Web
                            </Badge>
                            <Badge variant="label" tone="link">
                                Konten
                            </Badge>
                            <Badge variant="label" tone="warning">
                                Legal
                            </Badge>
                            <Badge variant="count">5</Badge>
                            <Badge>Baru</Badge>
                            <span className="rounded-sm bg-surface-2 px-2.5 py-1 font-mono text-[15px] font-semibold">
                                PLQ-18
                            </span>
                        </div>
                        <h3 className="pt-1.5 text-[21px] font-bold">Avatar</h3>
                        <div className="flex flex-wrap items-center gap-5">
                            <UserAvatar
                                name="Dimas Pratama"
                                ring
                                className="size-12 text-[16px]"
                            />
                            <UserAvatar
                                name="Sari Wulandari"
                                className="size-10 text-[15px]"
                            />
                            <UserAvatar
                                name="Rizky Aditya"
                                className="size-8 text-[13px]"
                            />
                            <span className="flex">
                                {[
                                    'Sari Wulandari',
                                    'Rizky Aditya',
                                    'Maya Lestari',
                                ].map((name) => (
                                    <UserAvatar
                                        key={name}
                                        name={name}
                                        className="-ml-2.5 size-9 text-[14px] ring-3 ring-surface first:ml-0"
                                    />
                                ))}
                                <span className="-ml-2.5 flex size-9 items-center justify-center rounded-full bg-avatar-neutral text-[14px] font-bold text-avatar-neutral-fg ring-3 ring-surface">
                                    +5
                                </span>
                            </span>
                            <span className="flex size-12 items-center justify-center rounded-[14px] bg-grad-merek text-[20px] font-extrabold text-on-brand">
                                P
                            </span>
                        </div>
                    </Section>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <KpiCard
                            label="Tingkat penyelesaian"
                            value="78%"
                            delta={{
                                text: '6 poin',
                                tone: 'success',
                                direction: 'up',
                            }}
                            note="vs minggu lalu"
                        />
                        <KpiCard
                            tone="highlight"
                            label="Menunggu persetujuan Anda"
                            value="5"
                            note="2 cuti · 2 lembur · 1 koreksi"
                        >
                            <a
                                href="#persetujuan"
                                className="mt-1.5 inline-flex h-9 items-center self-start rounded-[10px] bg-on-brand/18 px-3.5 text-[15px] font-semibold text-on-brand"
                            >
                                Tinjau sekarang
                            </a>
                        </KpiCard>
                        <KpiCard
                            tone="warm"
                            label="Proyek perlu perhatian"
                            value="3"
                            note="1 bermasalah · 2 berisiko"
                        />
                        <KpiCard
                            label="Kehadiran hari ini"
                            value="12"
                            suffix="/ 14"
                            note="2 cuti atau sakit"
                        />
                        <div className="flex flex-col gap-2.5 rounded-card border border-border bg-surface px-6 py-[18px] shadow-card sm:col-span-2">
                            <div className="flex justify-between text-[15px]">
                                <span className="font-semibold">
                                    Progres proyek
                                </span>
                                <span className="text-text-muted">
                                    <b className="text-text">48%</b> · rencana
                                    61%
                                </span>
                            </div>
                            <Progress
                                value={48}
                                marker={61}
                                label="Progres proyek"
                            />
                        </div>
                    </div>

                    <Panel
                        title="Baris daftar"
                        flush
                        action={
                            <PanelLink href="/dev/komponen">
                                Lihat semua
                            </PanelLink>
                        }
                    >
                        <div className="divide-y divide-divider">
                            <ListRow
                                href="/dev/komponen"
                                leading={
                                    <UserAvatar
                                        name="Maya Lestari"
                                        className="size-11 text-[15px]"
                                    />
                                }
                                title="Maya Lestari · Cuti tahunan"
                                meta="12–14 Okt · 3 hari kerja · sisa saldo 9"
                                trailing={
                                    <Badge variant="status" tone="warning" dot>
                                        Menunggu
                                    </Badge>
                                }
                            />
                            <ListRow
                                href="/dev/komponen"
                                leading={
                                    <UserAvatar
                                        name="Yoga Permana"
                                        className="size-11 text-[15px]"
                                    />
                                }
                                title="Yoga Permana · Lembur"
                                meta="Sab, 3 Okt · 17.00–20.30 · 3,5 jam"
                            />
                        </div>
                    </Panel>

                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-3.5 rounded-[18px] bg-inverse px-[18px] py-4 text-on-inverse shadow-inverse">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success-soft text-success">
                                <CheckSquare
                                    className="size-[18px]"
                                    strokeWidth={2.5}
                                    aria-hidden
                                />
                            </span>
                            <span className="flex-1 text-[16px] font-medium">
                                PLQ-21 dipindah ke Review
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-on-inverse hover:bg-on-inverse/12"
                                onClick={() =>
                                    toast.success('PLQ-21 dipindah ke Review', {
                                        action: {
                                            label: 'Urungkan',
                                            onClick: () => undefined,
                                        },
                                    })
                                }
                            >
                                Tampilkan toast
                            </Button>
                        </div>
                        <EmptyState
                            icon={CheckSquare}
                            title="Semua tugas beres"
                            description="Tidak ada tugas bertenggat minggu ini. Buat tugas baru atau lihat board tim."
                            action={<Button>Tugas baru</Button>}
                        />
                    </div>

                    <Section title="Lapisan mengambang (kaca)">
                        <div className="flex flex-wrap items-center gap-3">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="outline">
                                        Buka dialog
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>
                                            Tolak pengajuan?
                                        </DialogTitle>
                                        <DialogDescription>
                                            Maya Lestari akan menerima alasan
                                            penolakan lewat inbox.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <Textarea
                                        aria-label="Alasan"
                                        placeholder="Alasan penolakan"
                                    />
                                    <DialogFooter>
                                        <DialogClose asChild>
                                            <Button variant="quiet">
                                                Batal
                                            </Button>
                                        </DialogClose>
                                        <Button variant="destructive">
                                            Tolak
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="outline">
                                        Buka panel
                                    </Button>
                                </SheetTrigger>
                                <SheetContent>
                                    <SheetHeader>
                                        <SheetTitle>
                                            Detail pengajuan
                                        </SheetTitle>
                                        <SheetDescription>
                                            CUT-2026-10-0012
                                        </SheetDescription>
                                    </SheetHeader>
                                </SheetContent>
                            </Sheet>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline">
                                        Menu
                                        <ChevronDown />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Tugas</DropdownMenuLabel>
                                    <DropdownMenuItem>
                                        <Download />
                                        Ekspor
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                        <Info />
                                        Detail
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem variant="destructive">
                                        <Trash2 />
                                        Hapus
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        aria-label="Info"
                                    >
                                        <Info />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Persentase tugas bertenggat yang selesai
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        <Alert variant="warning">
                            <CircleAlert />
                            <AlertTitle>Di luar radius kantor</AlertTitle>
                            <AlertDescription>
                                Anda berada 340 m dari Kantor Pusat (batas 100
                                m). Ajukan dinas luar bila sedang bertugas di
                                luar.
                            </AlertDescription>
                        </Alert>
                    </Section>

                    <Section title="Tabel & memuat">
                        <div className="overflow-hidden rounded-lg border border-border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>ID</TableHead>
                                        <TableHead>Tugas</TableHead>
                                        <TableHead className="text-right">
                                            Terlambat
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {[
                                        [
                                            'PLQ-15',
                                            'Siaran pers peluncuran',
                                            '2 hari',
                                        ],
                                        [
                                            'MSG-23',
                                            'Uji impor data stok batch 2',
                                            'Hari ini',
                                        ],
                                        [
                                            'GDG-52',
                                            'Tata letak rak baru gudang C',
                                            '—',
                                        ],
                                    ].map(([id, title, late]) => (
                                        <TableRow key={id}>
                                            <TableCell className="font-mono text-[14px] font-semibold">
                                                {id}
                                            </TableCell>
                                            <TableCell>{title}</TableCell>
                                            <TableCell className="text-right text-danger">
                                                {late}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div
                            className="flex flex-col gap-2.5"
                            aria-label="Contoh memuat"
                        >
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-14 w-full" />
                            <Skeleton className="h-10 w-full rounded-[10px]" />
                        </div>
                    </Section>

                    <Section title="Warna & gradien" className="lg:col-span-2">
                        <div className="grid gap-4 md:grid-cols-4">
                            {GRADIENTS.map(([token, className, use]) => (
                                <div
                                    key={token}
                                    className="flex flex-col overflow-hidden rounded-2xl border border-border"
                                >
                                    <div
                                        className={cn(
                                            'flex h-28 items-end p-4 text-[20px] font-extrabold text-on-brand',
                                            className,
                                        )}
                                    >
                                        {token}
                                    </div>
                                    <p className="p-4 text-[15px] leading-[22px] text-text-muted">
                                        {use}
                                    </p>
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                            {SURFACES.map(([name, className]) => (
                                <Swatch
                                    key={name}
                                    name={`--${name}`}
                                    className={className}
                                />
                            ))}
                        </div>
                    </Section>

                    <Section title="Tipografi" className="lg:col-span-2">
                        <div className="flex flex-col divide-y divide-divider">
                            {TYPE_SCALE.map(([className, sample]) => (
                                <div
                                    key={className}
                                    className="grid gap-2 py-3.5 md:grid-cols-[220px_1fr] md:items-baseline"
                                >
                                    <span className="font-mono text-[14px] font-semibold text-link">
                                        {className.split(' ')[0]}
                                    </span>
                                    <span className={className}>{sample}</span>
                                </div>
                            ))}
                        </div>
                    </Section>

                    <Section title="Radius & elevasi" className="lg:col-span-2">
                        <div className="flex flex-wrap gap-6">
                            {[
                                ['rounded-sm', '8 · chip'],
                                ['rounded-control', '12 · tombol, input'],
                                ['rounded-lg', '16 · ubin'],
                                ['rounded-card', '20 · kartu'],
                                ['rounded-panel', '24 · panel'],
                                ['rounded-sheet', '28 · sheet'],
                            ].map(([className, use]) => (
                                <div
                                    key={className}
                                    className="flex flex-col items-center gap-2"
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'size-20 border-2 border-primary bg-link-soft',
                                            className,
                                        )}
                                    />
                                    <span className="font-mono text-[13px] font-semibold">
                                        {className}
                                    </span>
                                    <span className="text-[14px] text-text-muted">
                                        {use}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className="grid gap-5 rounded-[18px] bg-background p-3 md:grid-cols-4">
                            {[
                                [
                                    'shadow-none border border-border',
                                    'e-0 · datar',
                                ],
                                [
                                    'shadow-card border border-border',
                                    'e-1 · shadow-card',
                                ],
                                [
                                    'shadow-float border border-border',
                                    'e-2 · shadow-float',
                                ],
                                [
                                    'shadow-glow bg-grad-aksi',
                                    'glow · shadow-glow',
                                ],
                            ].map(([className, label]) => (
                                <div
                                    key={label}
                                    className="flex flex-col gap-2.5"
                                >
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'h-24 rounded-[18px] bg-surface',
                                            className,
                                        )}
                                    />
                                    <span className="font-mono text-[13px] font-semibold">
                                        {label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </Section>
                </div>
            </div>
        </>
    );
}

StyleGuide.layout = {
    breadcrumbs: [{ title: 'Komponen Arus', href: '/dev/komponen' }],
    title: 'Komponen',
};
