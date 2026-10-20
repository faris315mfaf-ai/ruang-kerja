import { AlertTriangle, Lock, RefreshCw, Trash2, Wallet } from 'lucide-react';
import type { ReactNode } from 'react';
import InputError from '@/components/input-error';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime, formatDayDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { STATUS_OPTIONS, cellStyle, isAttended, wageHint } from './cells';
import type { DayDetail, DayTarget } from './types';
import { useDayEditor } from './use-day-editor';
import type { DayEditor } from './use-day-editor';

type Props = {
    target: DayTarget | null;
    variant: 'desktop' | 'mobile';
    /** Props reloaded after saving. */
    reload: string[];
    onClose: () => void;
    /** "Tambah absen": employee & date pickers above the editor. */
    picker?: ReactNode;
};

/**
 * "Atur absensi" of one employee's date (mockups SetHari & MAturHari): a
 * side sheet on desktop/tablet, a bottom sheet on phones, same editor.
 */
export function DaySheet({ target, variant, reload, onClose, picker }: Props) {
    const editor = useDayEditor(target, reload, onClose);
    const open = target !== null || picker !== undefined;
    const subtitle = target
        ? formatDayDate(target.date)
        : 'Pilih pegawai dan tanggal';
    const title = target?.name ?? 'Tambah absen';

    if (variant === 'mobile') {
        return (
            <BottomSheet
                open={open}
                onOpenChange={(next) => !next && onClose()}
                title={title}
                description={subtitle}
                footer={
                    <EditorFooter editor={editor} mobile onCancel={onClose} />
                }
            >
                <div className="flex flex-col gap-4">
                    {picker}
                    {target && <EditorBody editor={editor} mobile />}
                </div>
            </BottomSheet>
        );
    }

    return (
        <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
            <SheetContent className="w-full gap-0 sm:max-w-[560px]">
                <SheetHeader className="flex-row items-center gap-3 border-b border-divider">
                    {target && (
                        <UserAvatar
                            name={target.name}
                            className="size-11 shrink-0 text-[14px]"
                        />
                    )}
                    <div className="min-w-0">
                        <SheetTitle className="truncate">{title}</SheetTitle>
                        <SheetDescription>
                            {subtitle}
                            {editor.load.state === 'ready' &&
                                scheduleText(editor.load.detail)}
                        </SheetDescription>
                    </div>
                </SheetHeader>
                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-6">
                    {picker}
                    {target && <EditorBody editor={editor} />}
                </div>
                <div className="border-t border-divider px-6 py-4">
                    <EditorFooter editor={editor} onCancel={onClose} />
                </div>
            </SheetContent>
        </Sheet>
    );
}

function scheduleText(detail: DayDetail): string {
    if (detail.holiday) {
        return ` · Libur: ${detail.holiday}`;
    }

    if (detail.shift) {
        return ` · Shift ${detail.shift}`;
    }

    return detail.scheduled ? '' : ' · Tidak terjadwal';
}

function EditorBody({
    editor,
    mobile = false,
}: {
    editor: DayEditor;
    mobile?: boolean;
}) {
    const { load, form } = editor;

    if (load.state === 'idle' || load.state === 'loading') {
        return (
            <div className="flex flex-col gap-4" aria-busy>
                <Skeleton className="h-12 rounded-lg" />
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }, (_, index) => (
                        <Skeleton key={index} className="h-[52px] rounded-lg" />
                    ))}
                </div>
                <Skeleton className="h-24 rounded-lg" />
            </div>
        );
    }

    if (load.state === 'error') {
        return (
            <Alert variant="destructive">
                <AlertTriangle aria-hidden />
                <AlertDescription className="flex flex-col items-start gap-3">
                    {load.message}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={editor.retry}
                    >
                        <RefreshCw aria-hidden />
                        Coba lagi
                    </Button>
                </AlertDescription>
            </Alert>
        );
    }

    const detail = load.detail;
    const editable = detail.can.set_status;
    const chosen = form.data.status || null;
    const current = detail.status ? cellStyle(detail.status) : null;
    const fieldId = (name: string) => `day-${name}`;

    return (
        <form
            id="day-editor-form"
            className="flex flex-col gap-5"
            onSubmit={(event) => {
                event.preventDefault();
                editor.save();
            }}
        >
            {detail.locked && (
                <Alert variant="warning">
                    <Lock aria-hidden />
                    <AlertDescription>
                        Periode gaji bulan ini sudah dikunci. Buka kunci di
                        Absensi › Gaji dulu untuk mengubah absen.
                    </AlertDescription>
                </Alert>
            )}
            {detail.from_request && detail.request && (
                <Alert variant="info">
                    <AlertTriangle aria-hidden />
                    <AlertDescription>
                        Dari pengajuan {detail.request.type}
                        {detail.request.number
                            ? ` ${detail.request.number}`
                            : ''}
                        . Hari dengan pengajuan yang disetujui diubah lewat
                        Pengajuan, bukan di sini.
                    </AlertDescription>
                </Alert>
            )}

            {!editable && !detail.locked && !detail.from_request && (
                <Alert variant="info">
                    <AlertTriangle aria-hidden />
                    <AlertDescription>
                        Status hari ini tidak bisa diatur di sini (mis. absensi
                        Anda sendiri).
                    </AlertDescription>
                </Alert>
            )}

            <div className="flex items-center gap-3 rounded-lg bg-surface-2 px-3.5 py-3 text-[15px] leading-[22px] text-text-muted">
                <span
                    aria-hidden
                    className={cn(
                        'flex size-[26px] shrink-0 items-center justify-center rounded-[7px] font-mono text-[12px] font-semibold',
                        current?.className ?? 'bg-surface text-text-subtle',
                    )}
                >
                    {current?.letter ?? '–'}
                </span>
                <span>
                    Sekarang:{' '}
                    <b className="font-semibold text-text">
                        {detail.status_label ??
                            (detail.scheduled
                                ? 'belum ada catatan'
                                : 'tidak terjadwal')}
                    </b>
                    {detail.late_minutes > 0 && ` ${detail.late_minutes} menit`}
                    {detail.check_in &&
                        ` · ${detail.check_in}–${detail.check_out ?? ''}`}
                    {detail.manual && detail.set_by
                        ? ` — diatur ${detail.set_by}${detail.set_at ? `, ${formatDateTime(detail.set_at)}` : ''}`
                        : detail.exists && !detail.from_request
                          ? ' — otomatis oleh sistem'
                          : ''}
                </span>
            </div>

            <fieldset disabled={!editable} className="flex flex-col gap-2">
                <legend className="mb-2 text-[15px] font-semibold text-text">
                    Tetapkan status
                </legend>
                <div className="grid grid-cols-3 gap-2">
                    {STATUS_OPTIONS.map((option) => {
                        const style = cellStyle(option.code);
                        const on = chosen === option.value;

                        return (
                            <button
                                key={option.value}
                                type="button"
                                aria-pressed={on}
                                onClick={() =>
                                    form.setData('status', option.value)
                                }
                                className={cn(
                                    'flex min-h-[52px] items-center gap-2.5 rounded-lg border px-3 text-left text-[15px] font-semibold text-text transition-colors duration-120 ease-brand disabled:cursor-not-allowed disabled:opacity-50',
                                    mobile &&
                                        'flex-col justify-center gap-1 px-1 text-center text-[14px]',
                                    on
                                        ? 'border-2 border-primary bg-link-soft px-[11px]'
                                        : 'border-border-strong bg-surface hover:bg-surface-2',
                                    focusRing,
                                )}
                            >
                                <span
                                    aria-hidden
                                    className={cn(
                                        'flex size-[26px] shrink-0 items-center justify-center rounded-[7px] font-mono text-[12px] font-semibold',
                                        style.className,
                                    )}
                                >
                                    {style.letter || 'L'}
                                </span>
                                {style.label}
                            </button>
                        );
                    })}
                </div>
                <InputError message={form.errors.status} />
            </fieldset>

            {isAttended(chosen) && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                        <Label htmlFor={fieldId('in')}>Jam masuk</Label>
                        <Input
                            id={fieldId('in')}
                            type="time"
                            value={form.data.check_in}
                            disabled={!editable}
                            onChange={(event) =>
                                form.setData('check_in', event.target.value)
                            }
                            aria-invalid={Boolean(form.errors.check_in)}
                            className="font-mono"
                        />
                        <InputError message={form.errors.check_in} />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor={fieldId('out')}>Jam pulang</Label>
                        <Input
                            id={fieldId('out')}
                            type="time"
                            value={form.data.check_out}
                            disabled={!editable}
                            onChange={(event) =>
                                form.setData('check_out', event.target.value)
                            }
                            aria-invalid={Boolean(form.errors.check_out)}
                            className="font-mono"
                        />
                        <InputError message={form.errors.check_out} />
                    </div>
                    <p className="col-span-2 text-meta text-text-muted">
                        Kosongkan bila jam tidak diketahui. Jam pulang lebih
                        awal dari jam masuk dihitung esok hari.
                    </p>
                </div>
            )}

            <div className="flex items-start gap-2.5 rounded-lg bg-surface-2 px-3.5 py-3 text-[15px] leading-[22px] text-text-muted">
                <Wallet className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span className="flex flex-col gap-0.5">
                    <span>
                        Gaji sekarang:{' '}
                        <b className="font-semibold text-text">
                            {detail.wage_effect.label}
                        </b>
                    </span>
                    {chosen && chosen !== detail.status && (
                        <span>
                            Setelah disimpan:{' '}
                            <b className="font-semibold text-text">
                                {wageHint(
                                    chosen,
                                    detail.wage_effect.daily_wage,
                                )}
                            </b>
                        </span>
                    )}
                </span>
            </div>

            <div className="grid gap-1.5">
                <Label htmlFor={fieldId('reason')}>Alasan (wajib)</Label>
                <Textarea
                    id={fieldId('reason')}
                    value={form.data.reason}
                    disabled={!editable && !detail.can.clear}
                    onChange={(event) =>
                        form.setData('reason', event.target.value)
                    }
                    rows={mobile ? 2 : 3}
                    maxLength={500}
                    placeholder="mis. Surat izin dari atasan diterima 09/10"
                    aria-invalid={Boolean(form.errors.reason)}
                />
                <InputError message={form.errors.reason} />
                <InputError
                    message={
                        (form.errors as Record<string, string | undefined>)
                            .work_date
                    }
                />
            </div>

            {(detail.logs.length > 0 || detail.history.length > 0) && (
                <section
                    aria-labelledby="day-history"
                    className="flex flex-col gap-2"
                >
                    <h3
                        id="day-history"
                        className="text-[15px] font-semibold text-text"
                    >
                        Riwayat hari ini
                    </h3>
                    <ol className="flex flex-col divide-y divide-divider rounded-lg border border-border">
                        {detail.logs.map((log) => (
                            <li
                                key={log.id}
                                className="flex gap-3 px-3.5 py-2.5 text-[15px] leading-[22px]"
                            >
                                <span className="w-14 shrink-0 font-mono text-[14px] text-text-muted">
                                    {log.at}
                                </span>
                                <span className="text-text">
                                    {log.type === 'check_in'
                                        ? 'Check-in'
                                        : 'Check-out'}{' '}
                                    · {log.method_label}
                                    {log.corrected_by &&
                                        ` · oleh ${log.corrected_by}`}
                                    {log.note && (
                                        <span className="block text-meta text-text-muted">
                                            {log.note}
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                        {detail.history.map((entry) => (
                            <li
                                key={`${entry.action}-${entry.at}`}
                                className="flex gap-3 px-3.5 py-2.5 text-[15px] leading-[22px]"
                            >
                                <span className="w-14 shrink-0 text-meta text-text-muted">
                                    {formatDateTime(entry.at).replace(
                                        /^\w+, /,
                                        '',
                                    )}
                                </span>
                                <span className="text-text">
                                    {entry.label}
                                    {entry.to_status &&
                                        ` → ${cellStyle(entry.to_status).label}`}
                                    {entry.actor && ` · ${entry.actor}`}
                                    {entry.reason && (
                                        <span className="block text-meta text-text-muted">
                                            “{entry.reason}”
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {detail.exists && (
                <div className="flex flex-col items-start gap-1.5">
                    <Button
                        type="button"
                        variant="outline"
                        className="border-danger/40 text-danger hover:bg-danger-soft hover:text-danger"
                        disabled={
                            !detail.can.clear ||
                            form.processing ||
                            form.data.reason.trim().length < 5
                        }
                        onClick={editor.clear}
                    >
                        <Trash2 aria-hidden />
                        Hapus catatan absen hari ini
                    </Button>
                    <p className="text-meta text-text-muted">
                        {detail.has_logs
                            ? 'Hari ini punya catatan check-in, jadi tidak bisa dihapus. Ubah statusnya saja.'
                            : detail.from_request
                              ? 'Hari dengan pengajuan yang disetujui diubah lewat Pengajuan, bukan di sini.'
                              : detail.can.clear
                                ? 'Isi alasan dulu. Hari akan kembali dihitung sistem.'
                                : 'Catatan ini tidak bisa dihapus.'}
                    </p>
                </div>
            )}
        </form>
    );
}

function EditorFooter({
    editor,
    onCancel,
    mobile = false,
}: {
    editor: DayEditor;
    onCancel: () => void;
    mobile?: boolean;
}) {
    const editable =
        editor.load.state === 'ready' && editor.load.detail.can.set_status;

    return (
        <div className={cn('flex gap-3', !mobile && 'justify-end')}>
            <Button
                type="button"
                variant="outline"
                size={mobile ? 'lg' : 'default'}
                className={cn(mobile && 'flex-1')}
                onClick={onCancel}
            >
                Batal
            </Button>
            <Button
                type="submit"
                form="day-editor-form"
                size={mobile ? 'lg' : 'default'}
                className={cn(mobile && 'flex-[2]')}
                disabled={
                    !editable ||
                    editor.form.processing ||
                    editor.form.data.status === ''
                }
            >
                {mobile ? 'Simpan' : 'Simpan perubahan'}
            </Button>
        </div>
    );
}
