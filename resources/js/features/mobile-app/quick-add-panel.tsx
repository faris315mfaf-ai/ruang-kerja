import { Link } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    CalendarDays,
    CalendarPlus,
    Check,
    LogIn,
    Mic,
    NotebookPen,
    Plus,
    Square,
    TriangleAlert,
} from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { cn, focusRing } from '@/lib/utils';
import { LEAVE_BALANCE_DAYS, NOW, SHIFT_TODAY } from './fixtures';
import { leaveDays, validateQuickAdd } from './logic';
import type { PreviewState, QuickActionKey, QuickCreated } from './types';

export const QUICK_FLOW = [
    'Ketuk tombol + di pojok kanan bawah (zona jempol)',
    'Pilih aksi: Check-in, Tugas baru, Ajukan cuti, Catatan, Rapat, Kendala',
    'Isi formulir singkat langsung di lembar bawah',
    'Simpan: muncul di "Baru dibuat", lembar tertutup',
    'Tekan lama tombol + untuk langsung membuat tugas baru',
];

export const QUICK_ACTIONS: {
    key: QuickActionKey;
    label: string;
    icon: LucideIcon;
    tile: string;
    hint: string;
}[] = [
    {
        key: 'check_in',
        label: 'Check-in',
        icon: LogIn,
        tile: 'bg-grad-aksi',
        hint: `Shift ${SHIFT_TODAY.start} · ${SHIFT_TODAY.location}`,
    },
    {
        key: 'task',
        label: 'Tugas baru',
        icon: Plus,
        tile: 'bg-grad-aksi',
        hint: 'Masuk ke workspace terakhir: Operasional',
    },
    {
        key: 'leave',
        label: 'Ajukan cuti',
        icon: CalendarPlus,
        tile: 'bg-grad-indigo',
        hint: `Saldo cuti tahunan Anda ${LEAVE_BALANCE_DAYS} hari`,
    },
    {
        key: 'note',
        label: 'Catatan',
        icon: NotebookPen,
        tile: 'bg-grad-indigo',
        hint: 'Tersimpan di catatan pribadi Anda',
    },
    {
        key: 'meeting',
        label: 'Jadwalkan rapat',
        icon: CalendarDays,
        tile: 'bg-grad-aksi',
        hint: 'Tautan Google Meet dibuat otomatis',
    },
    {
        key: 'issue',
        label: 'Lapor kendala',
        icon: TriangleAlert,
        tile: 'bg-grad-hangat',
        hint: 'Dikirim ke atasan dan PIC proyek',
    },
];

const SUBMIT_LABEL: Partial<Record<QuickActionKey, string>> = {
    task: 'Buat tugas',
    leave: 'Ajukan cuti',
    note: 'Simpan catatan',
    issue: 'Kirim laporan',
};

let sequence = 47;

function created(
    kind: QuickActionKey,
    title: string,
    meta: string,
): QuickCreated {
    sequence += 1;

    return {
        id: `qc-${sequence}`,
        kind,
        title,
        meta,
        created_at: NOW,
    };
}

/**
 * MQuickAdd: grid of quick actions + a short form for the chosen one and a
 * voice note. Used in the phone bottom sheet and the desktop side panel.
 */
export function QuickAddPanel({
    state,
    initial = null,
    onCreated,
}: {
    state: PreviewState;
    initial?: QuickActionKey | null;
    onCreated: (item: QuickCreated) => void;
}) {
    const [selected, setSelected] = useState<QuickActionKey | null>(initial);
    const [title, setTitle] = useState('');
    const [start, setStart] = useState('2026-10-07');
    const [end, setEnd] = useState('2026-10-09');
    const [error, setError] = useState<string | null>(null);
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const save = useFakeMutation();
    const id = useId();

    useEffect(() => {
        if (!recording) {
            return;
        }

        const timer = window.setInterval(
            () => setSeconds((value) => value + 1),
            1000,
        );

        return () => window.clearInterval(timer);
    }, [recording]);

    const action = QUICK_ACTIONS.find((item) => item.key === selected) ?? null;

    const pick = (key: QuickActionKey) => {
        setSelected(key);
        setTitle('');
        setError(null);
    };

    const submit = () => {
        if (!selected) {
            return;
        }

        const invalid = validateQuickAdd(selected, { title, start, end });

        if (invalid) {
            setError(invalid);

            return;
        }

        setError(null);

        const item =
            selected === 'task'
                ? created(
                      'task',
                      `OPS-48 ${title.trim()}`,
                      'Workspace Operasional · tanpa tenggat',
                  )
                : selected === 'leave'
                  ? created(
                        'leave',
                        `Cuti tahunan ${leaveDays(start, end)} hari`,
                        'Menunggu Hendra (atasan) → Hana (HR)',
                    )
                  : selected === 'note'
                    ? created(
                          'note',
                          `Catatan: ${title.trim()}`,
                          'Catatan pribadi',
                      )
                    : created(
                          'issue',
                          `Kendala: ${title.trim()}`,
                          'Dikirim ke Hendra & PIC',
                      );

        void save
            .run(
                () => {
                    onCreated(item);
                    setTitle('');
                },
                {
                    success: `${action?.label ?? 'Item'} tersimpan`,
                    fail: state === 'galat',
                    error: 'Belum tersimpan. Periksa koneksi lalu coba lagi.',
                },
            )
            .then((ok) => {
                if (!ok) {
                    setError(
                        'Belum tersimpan. Periksa koneksi lalu coba lagi.',
                    );
                }
            });
    };

    const toggleRecording = () => {
        if (!recording) {
            setSeconds(0);
            setRecording(true);

            return;
        }

        setRecording(false);
        onCreated(
            created(
                'note',
                `Catatan suara 0:${String(Math.max(seconds, 1)).padStart(2, '0')}`,
                'Ditranskripsi · pilih jadikan tugas atau notulen',
            ),
        );
    };

    const fieldId = `${id}-field`;
    const hintId = `${id}-hint`;

    return (
        <div className="flex flex-col gap-4">
            <div
                role="radiogroup"
                aria-label="Pilih aksi cepat"
                className="grid grid-cols-3 gap-2.5"
            >
                {QUICK_ACTIONS.map((item) => {
                    const on = item.key === selected;

                    return (
                        <button
                            key={item.key}
                            type="button"
                            role="radio"
                            aria-checked={on}
                            onClick={() => pick(item.key)}
                            className={cn(
                                'flex h-[104px] flex-col items-center justify-center gap-2 rounded-[18px] border-2 px-1.5 transition-colors duration-120 ease-brand',
                                focusRing,
                                on
                                    ? 'border-accent-blue-strong bg-info-soft'
                                    : 'border-transparent bg-surface-2 hover:bg-border',
                            )}
                        >
                            <span
                                aria-hidden
                                className={cn(
                                    'flex size-11 items-center justify-center rounded-[14px] text-on-brand',
                                    item.tile,
                                )}
                            >
                                <item.icon
                                    className="size-[22px]"
                                    strokeWidth={2.2}
                                />
                            </span>
                            <span className="text-center text-[14px] leading-[18px] font-extrabold text-text">
                                {item.label}
                            </span>
                        </button>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={toggleRecording}
                aria-pressed={recording}
                className={cn(
                    'flex min-h-16 items-center gap-3 rounded-[18px] border border-border px-4 text-left transition-colors duration-120 ease-brand',
                    focusRing,
                    recording
                        ? 'bg-danger-soft'
                        : 'bg-surface hover:bg-surface-2',
                )}
            >
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-danger text-on-danger"
                >
                    {recording ? (
                        <Square className="size-4" fill="currentColor" />
                    ) : (
                        <Mic className="size-5" />
                    )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-[16px] font-extrabold text-text">
                        {recording
                            ? `Merekam… 0:${String(seconds).padStart(2, '0')} · ketuk untuk berhenti`
                            : 'Rekam catatan suara'}
                    </span>
                    <span className="text-[13px] text-text-muted">
                        Diubah jadi teks, lalu pilih: tugas, notulen, atau
                        catatan
                    </span>
                </span>
            </button>

            {action ? (
                <section
                    aria-label={action.label}
                    className="flex flex-col gap-3 rounded-[18px] border border-border bg-surface p-4"
                >
                    <p id={hintId} className="text-[15px] text-text-muted">
                        {action.hint}
                    </p>
                    {action.key === 'check_in' && (
                        <Button size="lg" className="w-full" asChild>
                            <Link href="/absensi/wajah">
                                Buka check-in wajah
                            </Link>
                        </Button>
                    )}
                    {action.key === 'meeting' && (
                        <Button size="lg" className="w-full" asChild>
                            <Link href="/rapat/baru">
                                Lanjut jadwalkan rapat
                            </Link>
                        </Button>
                    )}
                    {action.key === 'leave' && (
                        <div className="grid gap-3">
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`${id}-start`}>Mulai</Label>
                                <DateInput
                                    id={`${id}-start`}
                                    clearable={false}
                                    value={start}
                                    onChange={setStart}
                                    inputClassName="text-[17px] md:text-[16px]"
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor={`${id}-end`}>Selesai</Label>
                                <DateInput
                                    id={`${id}-end`}
                                    clearable={false}
                                    value={end}
                                    onChange={setEnd}
                                    aria-invalid={error ? true : undefined}
                                    inputClassName="text-[17px] md:text-[16px]"
                                />
                            </div>
                            <p className="text-[15px] font-semibold text-text">
                                {leaveDays(start, end)} hari · sisa saldo{' '}
                                {Math.max(
                                    LEAVE_BALANCE_DAYS - leaveDays(start, end),
                                    0,
                                )}{' '}
                                hari
                            </p>
                        </div>
                    )}
                    {action.key === 'task' && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={fieldId}>Judul tugas</Label>
                            <Input
                                id={fieldId}
                                value={title}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                placeholder="Mis. Cek stok kardus gudang"
                                aria-invalid={error ? true : undefined}
                                aria-describedby={hintId}
                                className="text-[17px] md:text-[16px]"
                            />
                        </div>
                    )}
                    {(action.key === 'note' || action.key === 'issue') && (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={fieldId}>
                                {action.key === 'note'
                                    ? 'Isi catatan'
                                    : 'Kendala'}
                            </Label>
                            <Textarea
                                id={fieldId}
                                value={title}
                                rows={3}
                                onChange={(event) =>
                                    setTitle(event.target.value)
                                }
                                placeholder={
                                    action.key === 'note'
                                        ? 'Tulis apa saja…'
                                        : 'Mis. Printer label gudang mati sejak pagi'
                                }
                                aria-invalid={error ? true : undefined}
                                aria-describedby={hintId}
                                className="text-[17px] md:text-[16px]"
                            />
                        </div>
                    )}
                    {error && (
                        <p
                            role="alert"
                            className="text-[14px] font-semibold text-danger"
                        >
                            {error}
                        </p>
                    )}
                    {SUBMIT_LABEL[action.key] && (
                        <Button
                            size="lg"
                            className="w-full"
                            disabled={save.processing}
                            onClick={submit}
                        >
                            <Check aria-hidden />
                            {save.processing
                                ? 'Menyimpan…'
                                : SUBMIT_LABEL[action.key]}
                        </Button>
                    )}
                </section>
            ) : (
                <p className="text-center text-[14px] text-text-muted">
                    Tekan lama tombol + di beranda untuk langsung membuka tugas
                    baru
                </p>
            )}
        </div>
    );
}
