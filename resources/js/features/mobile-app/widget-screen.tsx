import { router } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarDays,
    Camera,
    Globe,
    Image as ImageIcon,
    LogIn,
    Mail,
    Map as MapIcon,
    MessageCircle,
    NotebookPen,
    Phone,
    RefreshCw,
    ScanFace,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn, focusRing } from '@/lib/utils';
import { SHIFT_TODAY, WIDGET_TASKS } from './fixtures';
import { summarizeTasks } from './logic';
import { HomeIndicator, StatusBar, Wallpaper } from './phone-frame';
import type { AttendanceWidgetState, PreviewState } from './types';

export type WidgetSize = 'kecil' | 'sedang';

export const WIDGET_FLOW = [
    'Widget kecil: status absensi dan tugas hari ini dalam dua kotak',
    'Widget sedang: tombol Check-in dan tiga tugas berikutnya',
    'Ketuk Check-in: konfirmasi Face ID, tercatat tanpa membuka aplikasi',
    'Ketuk tugas: membuka Tugas saya di aplikasi',
    'Widget diperbarui tiap 15 menit dan setelah setiap aksi',
];

const APPS: { name: string; icon: LucideIcon | null; bg: string }[] = [
    { name: 'RuangKerja', icon: null, bg: 'bg-grad-merek' },
    { name: 'Kalender', icon: CalendarDays, bg: 'bg-grad-hangat' },
    { name: 'Pesan', icon: MessageCircle, bg: 'bg-brand-700' },
    { name: 'Surel', icon: Mail, bg: 'bg-accent-blue-strong' },
    { name: 'Foto', icon: ImageIcon, bg: 'bg-grad-indigo' },
    { name: 'Kamera', icon: Camera, bg: 'bg-grad-slate' },
    { name: 'Catatan', icon: NotebookPen, bg: 'bg-fill-warning' },
    { name: 'Peta', icon: MapIcon, bg: 'bg-fill-violet' },
];

const DOCK: { name: string; icon: LucideIcon | null; bg: string }[] = [
    { name: 'Telepon', icon: Phone, bg: 'bg-brand-500' },
    { name: 'Browser', icon: Globe, bg: 'bg-accent-blue-strong' },
    { name: 'Pesan', icon: MessageCircle, bg: 'bg-brand-600' },
    { name: 'RuangKerja', icon: null, bg: 'bg-grad-merek' },
];

function AppIcon({
    icon: Icon,
    bg,
    className,
}: {
    icon: LucideIcon | null;
    bg: string;
    className?: string;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-[60px] items-center justify-center rounded-[16px] text-[18px] font-extrabold text-on-brand shadow-card',
                bg,
                className,
            )}
        >
            {Icon ? <Icon className="size-7" strokeWidth={2} /> : 'RK'}
        </span>
    );
}

function Ring({ percent, label }: { percent: number; label: string }) {
    return (
        <span
            className="flex size-[62px] shrink-0 items-center justify-center rounded-full"
            style={{
                background: `conic-gradient(var(--accent-blue-strong) 0 ${percent}%, var(--border) ${percent}% 100%)`,
            }}
        >
            <span className="flex size-[46px] items-center justify-center rounded-full bg-surface text-[15px] font-extrabold text-text tnum">
                {label}
            </span>
        </span>
    );
}

const ATTENDANCE_COPY: Record<
    AttendanceWidgetState,
    { value: string; note: string; action: string | null }
> = {
    not_checked_in: {
        value: 'Belum',
        note: `shift ${SHIFT_TODAY.start} · ${SHIFT_TODAY.location}`,
        action: 'Check-in',
    },
    checked_in: {
        value: '07.52',
        note: 'masuk · tepat waktu',
        action: `Check-out ${SHIFT_TODAY.end}`,
    },
    done: { value: '17.04', note: 'pulang · 8 j 12 m', action: null },
};

/** MWidget: home screen widgets (small / medium) for attendance and tasks. */
export function WidgetScreen({
    state,
    size,
    onStepChange,
}: {
    state: PreviewState;
    size: WidgetSize;
    onStepChange?: (step: number) => void;
}) {
    const [attendance, setAttendance] =
        useState<AttendanceWidgetState>('not_checked_in');
    const [authing, setAuthing] = useState(false);
    const [stale, setStale] = useState(state === 'galat');
    const timer = useRef<number | null>(null);
    const checkIn = useFakeMutation();
    const refresh = useFakeMutation();

    useEffect(
        () => () => {
            if (timer.current) {
                window.clearTimeout(timer.current);
            }
        },
        [],
    );

    const empty = state === 'kosong';
    const tasks = summarizeTasks(empty ? [] : WIDGET_TASKS);
    const copy = ATTENDANCE_COPY[attendance];
    const busy = authing || checkIn.processing;

    const runCheckIn = () => {
        if (attendance === 'done' || busy) {
            return;
        }

        onStepChange?.(2);
        setAuthing(true);
        timer.current = window.setTimeout(() => {
            setAuthing(false);
            void checkIn.run(
                () =>
                    setAttendance((current) =>
                        current === 'not_checked_in' ? 'checked_in' : 'done',
                    ),
                {
                    success:
                        attendance === 'not_checked_in'
                            ? 'Check-in tercatat 07.52 · Kantor Pusat'
                            : 'Check-out tercatat 17.04',
                    delay: 700,
                },
            );
        }, 900);
    };

    const openTasks = () => {
        onStepChange?.(3);
        router.visit('/tugas');
    };

    const actionLabel = authing
        ? 'Face ID…'
        : checkIn.processing
          ? 'Mencatat…'
          : copy.action;

    const staleNote = stale && (
        <button
            type="button"
            onClick={() =>
                void refresh.run(() => setStale(false), {
                    success: 'Widget diperbarui',
                })
            }
            className={cn(
                'flex min-h-11 items-center gap-2 rounded-[14px] bg-warning-soft px-3 text-left text-[13px] font-bold text-warning',
                focusRing,
            )}
        >
            <RefreshCw
                aria-hidden
                className={cn(
                    'size-4 shrink-0',
                    refresh.processing && 'animate-spin',
                )}
            />
            {refresh.processing
                ? 'Memperbarui…'
                : 'Belum diperbarui · terakhir 07.10. Ketuk untuk coba lagi'}
        </button>
    );

    const smallAttendance = (
        <div className="flex aspect-square flex-col justify-between rounded-[26px] bg-primary bg-grad-aksi p-4 text-on-brand shadow-card">
            <span className="text-[13px] font-extrabold">ABSEN</span>
            {empty ? (
                <span className="flex flex-col">
                    <span className="text-[22px] leading-7 font-extrabold">
                        Libur
                    </span>
                    <span className="text-[14px]">
                        tidak ada jadwal hari ini
                    </span>
                </span>
            ) : (
                <span className="flex flex-col">
                    <span className="text-[30px] leading-[34px] font-extrabold tnum">
                        {copy.value}
                    </span>
                    <span className="text-[14px]">{copy.note}</span>
                </span>
            )}
            {!empty && actionLabel ? (
                <button
                    type="button"
                    onClick={runCheckIn}
                    disabled={busy}
                    className={cn(
                        'flex h-[34px] items-center justify-center gap-1.5 rounded-[10px] bg-on-brand/22 text-[13px] font-extrabold',
                        focusRing,
                    )}
                >
                    {authing && <ScanFace aria-hidden className="size-4" />}
                    {actionLabel}
                </button>
            ) : (
                <span className="flex h-[34px] items-center justify-center rounded-[10px] bg-on-brand/14 text-[13px] font-bold">
                    {empty ? 'Selamat beristirahat' : 'Selesai hari ini'}
                </span>
            )}
        </div>
    );

    const smallTasks = (
        <button
            type="button"
            onClick={openTasks}
            className={cn(
                'flex aspect-square flex-col justify-between rounded-[26px] bg-surface/90 p-4 text-left text-text shadow-card backdrop-blur-xl',
                focusRing,
            )}
        >
            <span className="text-[13px] font-extrabold text-link">
                TUGAS HARI INI
            </span>
            {tasks.total === 0 ? (
                <span className="text-[15px] leading-5 font-bold">
                    Tidak ada tugas hari ini
                </span>
            ) : (
                <span className="flex items-center gap-3">
                    <Ring
                        percent={tasks.percent}
                        label={`${tasks.done}/${tasks.total}`}
                    />
                    <span className="text-[13px] leading-[17px] text-text-muted">
                        {tasks.overdue} terlambat
                    </span>
                </span>
            )}
            <span
                className={cn(
                    'truncate text-[13px] font-bold',
                    tasks.next[0]?.overdue ? 'text-danger' : 'text-text-muted',
                )}
            >
                {tasks.next[0]
                    ? `${tasks.next[0].key} · ${tasks.next[0].overdue ? 'terlambat' : 'hari ini'}`
                    : 'Tambah dari aplikasi'}
            </span>
        </button>
    );

    const mediumAttendance = (
        <div className="flex items-center gap-3 rounded-[26px] bg-surface/90 p-4 text-text shadow-card backdrop-blur-xl">
            <span
                aria-hidden
                className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-grad-soft text-link"
            >
                <LogIn className="size-6" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-extrabold text-link">
                    ABSEN · {SHIFT_TODAY.name}
                </span>
                <span className="truncate text-[19px] leading-6 font-extrabold">
                    {empty
                        ? 'Tidak ada jadwal'
                        : attendance === 'not_checked_in'
                          ? 'Belum check-in'
                          : attendance === 'checked_in'
                            ? 'Masuk 07.52'
                            : 'Pulang 17.04'}
                </span>
                <span className="truncate text-[14px] text-text-muted">
                    {empty ? 'Hari libur kantor' : copy.note}
                </span>
            </span>
            {!empty && actionLabel && (
                <button
                    type="button"
                    onClick={runCheckIn}
                    disabled={busy}
                    className={cn(
                        'flex h-11 shrink-0 items-center gap-1.5 rounded-[12px] bg-primary bg-grad-aksi px-3.5 text-[15px] font-extrabold text-on-brand shadow-button',
                        focusRing,
                    )}
                >
                    {authing && <ScanFace aria-hidden className="size-4" />}
                    {actionLabel}
                </button>
            )}
        </div>
    );

    const mediumTasks = (
        <button
            type="button"
            onClick={openTasks}
            className={cn(
                'flex flex-col gap-2.5 rounded-[26px] bg-surface/90 p-4 text-left text-text shadow-card backdrop-blur-xl',
                focusRing,
            )}
        >
            <span className="flex items-baseline justify-between">
                <span className="text-[13px] font-extrabold text-link">
                    TUGAS HARI INI
                </span>
                <span className="text-[13px] font-bold text-text-muted tnum">
                    {tasks.done}/{tasks.total} selesai
                </span>
            </span>
            {tasks.total === 0 ? (
                <span className="py-3 text-[16px] font-bold">
                    Tidak ada tugas hari ini
                </span>
            ) : (
                <>
                    <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                        <span
                            className="block h-full rounded-full bg-grad-merek-x"
                            style={{ width: `${tasks.percent}%` }}
                        />
                    </span>
                    <span className="flex flex-col divide-y divide-divider">
                        {tasks.next.map((task) => (
                            <span
                                key={task.id}
                                className="flex items-center gap-2 py-1.5 text-[15px]"
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'size-2 shrink-0 rounded-full',
                                        task.overdue
                                            ? 'bg-fill-danger'
                                            : 'bg-fill-teal',
                                    )}
                                />
                                <span className="font-mono text-[13px] font-semibold text-text-muted">
                                    {task.key}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-semibold">
                                    {task.title}
                                </span>
                                {task.overdue && (
                                    <span className="shrink-0 text-[13px] font-bold text-danger">
                                        terlambat
                                    </span>
                                )}
                            </span>
                        ))}
                    </span>
                </>
            )}
        </button>
    );

    return (
        <Wallpaper kind="home">
            <StatusBar time="07.50" />
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pt-5 pb-32">
                {staleNote}
                {size === 'kecil' ? (
                    <div className="grid grid-cols-2 gap-4">
                        {smallAttendance}
                        {smallTasks}
                    </div>
                ) : (
                    <>
                        {mediumAttendance}
                        {mediumTasks}
                    </>
                )}
                <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 pt-2">
                    {APPS.map((app) => (
                        <span
                            key={app.name}
                            className="flex flex-col items-center gap-1.5"
                        >
                            <AppIcon icon={app.icon} bg={app.bg} />
                            <span className="text-[12px] font-bold">
                                {app.name}
                            </span>
                        </span>
                    ))}
                </div>
            </div>
            <div
                aria-hidden
                className="absolute inset-x-3.5 bottom-5 flex h-[88px] items-center justify-around rounded-[30px] bg-on-brand/22 backdrop-blur-xl"
            >
                {DOCK.map((app) => (
                    <AppIcon key={app.name} icon={app.icon} bg={app.bg} />
                ))}
            </div>
            {authing && (
                <div
                    role="status"
                    className="absolute inset-0 z-20 flex animate-in items-center justify-center bg-preview-dark/30 backdrop-blur-sm duration-180 ease-brand fade-in-0"
                >
                    <span className="flex size-40 flex-col items-center justify-center gap-3 rounded-[32px] bg-preview-dark/80 text-[15px] font-bold">
                        <ScanFace
                            aria-hidden
                            className="size-14 text-brand-300"
                            strokeWidth={1.6}
                        />
                        Konfirmasi Face ID
                    </span>
                </div>
            )}
            <HomeIndicator />
        </Wallpaper>
    );
}
