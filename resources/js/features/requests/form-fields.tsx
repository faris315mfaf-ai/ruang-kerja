import { Camera, CircleAlert, Lock, Paperclip, Upload, X } from 'lucide-react';
import { useRef } from 'react';
import InputError from '@/components/input-error';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Input, fieldClasses } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { formatNumber } from '@/lib/format';
import { dayUnit, formatDays } from '@/lib/requests';
import { cn } from '@/lib/utils';
import type { FormLeaveType } from '@/types/requests';
import { ProcurementFields } from './procurement-fields';
import type { RequestFormState } from './use-request-form';

type Props = {
    state: RequestFormState;
    substitutes: { id: string; name: string; avatar: string | null }[];
    limits: { reason: number; max_files: number; max_kilobytes: number };
    mobile?: boolean;
};

/** Native select styled like the inputs (keyboard + mobile friendly). */
export const selectClass = cn(fieldClasses, 'h-11 pr-9');

/**
 * Rules of the chosen type under the selector: description, per-request maximum,
 * unpaid, and the "Bawaan sementara" marker of seeded defaults HR has not reviewed.
 */
export function LeaveTypeHint({ type }: { type: FormLeaveType | undefined }) {
    if (!type) {
        return null;
    }

    const rules = [
        type.max_days_per_request != null
            ? `Maks. ${formatDays(type.max_days_per_request)} ${dayUnit(type)} per pengajuan`
            : null,
        type.is_paid ? null : 'Tidak dibayar, tidak memotong saldo cuti',
    ].filter(Boolean);

    if (
        !type.description &&
        rules.length === 0 &&
        !type.is_provisional_default
    ) {
        return null;
    }

    return (
        <div className="space-y-1 text-meta text-text-muted">
            {type.is_provisional_default && <ProvisionalBadge />}
            {type.description && <p>{type.description}</p>}
            {rules.length > 0 && <p>{rules.join(' · ')}</p>}
        </div>
    );
}

/**
 * The chosen type is locked (an older draft of cuti/lembur, keputusan
 * pemilik 6 Okt 2026): it can no longer be saved or sent, only canceled.
 */
export function LockedTypeNotice({
    type,
}: {
    type: FormLeaveType | undefined;
}) {
    if (!type?.locked) {
        return null;
    }

    return (
        <div
            role="alert"
            className="flex gap-3 rounded-lg bg-warning-soft px-4 py-3 text-[15px] leading-[22px] text-text"
        >
            <Lock className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
            <p>
                <strong className="font-bold">
                    {type.name} belum bisa diajukan.
                </strong>{' '}
                {type.locked_reason} Draf ini tidak bisa dikirim; batalkan dari
                Pengajuan saya bila tidak diperlukan.
            </p>
        </div>
    );
}

/** Marker of a seeded default rule HR has not reviewed yet. */
export function ProvisionalBadge({ className }: { className?: string }) {
    return (
        <span
            className={cn(
                'inline-flex h-[26px] w-fit shrink-0 items-center rounded-full bg-warning-soft px-2.5 text-[14px] font-bold whitespace-nowrap text-warning',
                className,
            )}
            title="Aturan bawaan sistem yang belum ditinjau HR; dapat berubah."
        >
            Bawaan sementara
        </span>
    );
}

/** Category-specific inputs shared by the desktop and mobile forms. */
export function CategoryFields({
    state,
    substitutes,
    limits,
    mobile = false,
}: Props) {
    const {
        form,
        category,
        types,
        type,
        usesHours,
        permitMode,
        changePermitMode,
    } = state;
    const { data, setData, errors } = form;
    const control = cn(mobile && 'h-12 text-[17px]');
    const error = (field: string) =>
        (errors as Record<string, string | undefined>)[field] ??
        state.preview?.errors?.[field];
    const substitute = substitutes.find(
        (person) => person.id === data.substitute_id,
    );

    return (
        <div className="space-y-5">
            {types.length > 1 && (
                <div className="grid gap-2">
                    <Label htmlFor="leave_type_id">
                        Jenis {category === 'leave' ? 'cuti' : 'pengajuan'}
                    </Label>
                    <select
                        id="leave_type_id"
                        className={cn(selectClass, 'md:max-w-80', control)}
                        value={data.leave_type_id}
                        onChange={(event) =>
                            setData('leave_type_id', event.target.value)
                        }
                    >
                        {types.map((option) => (
                            <option
                                key={option.id}
                                value={option.id}
                                disabled={!option.eligible || option.locked}
                            >
                                {option.name}
                                {option.locked
                                    ? ' (dikunci)'
                                    : option.eligible
                                      ? ''
                                      : ' (belum berhak)'}
                            </option>
                        ))}
                    </select>
                    {mobile && type?.balance && (
                        <p className="text-meta text-text-muted">
                            Saldo {type.name.toLowerCase()}{' '}
                            {formatNumber(type.balance.available)} hari
                        </p>
                    )}
                    <InputError message={errors.leave_type_id} />
                </div>
            )}

            <LeaveTypeHint type={type} />
            <LockedTypeNotice type={type} />

            {category === 'permit' && (
                <div className="grid gap-2">
                    <span className="text-label text-text">Durasi izin</span>
                    <div
                        role="radiogroup"
                        aria-label="Durasi izin"
                        className="inline-flex w-fit gap-1 rounded-[14px] bg-surface-2 p-1"
                    >
                        {(['hours', 'days'] as const).map((mode) => (
                            <button
                                key={mode}
                                type="button"
                                role="radio"
                                aria-checked={permitMode === mode}
                                onClick={() => changePermitMode(mode)}
                                className={cn(
                                    'h-[38px] rounded-[10px] px-[18px] text-[15px] font-semibold transition-[color,background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                    mobile && 'h-11',
                                    permitMode === mode
                                        ? 'bg-surface text-text shadow-segment'
                                        : 'text-text-muted hover:text-text',
                                )}
                            >
                                {mode === 'hours' ? 'Per jam' : 'Per hari'}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {category === 'procurement' ? (
                <ProcurementFields state={state} mobile={mobile} />
            ) : category === 'correction' ? (
                <div className="grid gap-4 md:grid-cols-3">
                    <Field id="date" label="Tanggal" error={error('date')}>
                        <DateInput
                            id="date"
                            clearable={false}
                            inputClassName={control}
                            value={data.date}
                            onChange={(value) => setData('date', value)}
                            aria-invalid={Boolean(error('date')) || undefined}
                        />
                    </Field>
                    <Field
                        id="check_in"
                        label="Jam check-in yang benar"
                        error={error('check_in')}
                    >
                        <Input
                            id="check_in"
                            type="time"
                            className={control}
                            value={data.check_in}
                            onChange={(e) =>
                                setData('check_in', e.target.value)
                            }
                        />
                    </Field>
                    <Field
                        id="check_out"
                        label="Jam check-out yang benar"
                        error={error('check_out')}
                    >
                        <Input
                            id="check_out"
                            type="time"
                            className={control}
                            value={data.check_out}
                            onChange={(e) =>
                                setData('check_out', e.target.value)
                            }
                        />
                    </Field>
                    <p className="text-meta text-text-muted md:col-span-3">
                        Isi salah satu atau keduanya.
                        {type?.max_backdate_days !== null &&
                        type?.max_backdate_days !== undefined
                            ? ` Maksimal ${type.max_backdate_days} hari ke belakang.`
                            : ''}
                    </p>
                </div>
            ) : usesHours ? (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                    <Field
                        id="date"
                        label="Tanggal"
                        error={error('date')}
                        className="col-span-2 md:col-span-1"
                    >
                        <DateInput
                            id="date"
                            clearable={false}
                            inputClassName={control}
                            value={data.date}
                            onChange={(value) => setData('date', value)}
                            aria-invalid={Boolean(error('date')) || undefined}
                        />
                    </Field>
                    <Field
                        id="start_time"
                        label="Jam mulai"
                        error={error('start_time')}
                    >
                        <Input
                            id="start_time"
                            type="time"
                            className={control}
                            value={data.start_time}
                            onChange={(e) =>
                                setData('start_time', e.target.value)
                            }
                        />
                    </Field>
                    <Field
                        id="end_time"
                        label="Jam selesai"
                        error={error('end_time')}
                    >
                        <Input
                            id="end_time"
                            type="time"
                            className={control}
                            value={data.end_time}
                            onChange={(e) =>
                                setData('end_time', e.target.value)
                            }
                        />
                    </Field>
                    {category === 'overtime' && (
                        <p className="col-span-2 text-meta text-text-muted md:col-span-3">
                            Lewat tengah malam? Isi jam selesai lebih kecil,
                            mis. 22.00–01.00.
                        </p>
                    )}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-2 gap-4">
                        <Field
                            id="start_date"
                            label="Tanggal mulai"
                            error={error('start_date')}
                        >
                            <DateInput
                                id="start_date"
                                clearable={false}
                                inputClassName={control}
                                value={data.start_date}
                                aria-invalid={
                                    Boolean(error('start_date')) || undefined
                                }
                                onChange={(value) => {
                                    setData((d) => ({
                                        ...d,
                                        start_date: value,
                                        end_date:
                                            d.end_date < value
                                                ? value
                                                : d.end_date,
                                    }));
                                }}
                            />
                        </Field>
                        <Field
                            id="end_date"
                            label="Tanggal selesai"
                            error={error('end_date')}
                        >
                            <DateInput
                                id="end_date"
                                clearable={false}
                                inputClassName={control}
                                value={data.end_date}
                                min={data.start_date || undefined}
                                aria-invalid={
                                    Boolean(error('end_date')) || undefined
                                }
                                onChange={(value) => setData('end_date', value)}
                            />
                        </Field>
                    </div>

                    {type?.allow_half_day &&
                        (mobile ? (
                            <div className="flex min-h-16 items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3">
                                <div>
                                    <p className="text-[17px] font-semibold text-text">
                                        Setengah hari
                                    </p>
                                    <p className="text-meta text-text-muted">
                                        Hanya untuk pengajuan satu hari
                                    </p>
                                </div>
                                <Switch
                                    aria-label="Setengah hari"
                                    checked={data.half_day}
                                    onCheckedChange={(value) =>
                                        setData('half_day', value)
                                    }
                                />
                            </div>
                        ) : (
                            <label className="flex min-h-11 items-center gap-3 text-[16px] text-text">
                                <Checkbox
                                    checked={data.half_day}
                                    onCheckedChange={(value) =>
                                        setData('half_day', value === true)
                                    }
                                />
                                Setengah hari{' '}
                                <span className="text-meta text-text-muted">
                                    · hanya untuk pengajuan satu hari
                                </span>
                            </label>
                        ))}
                    <InputError message={error('half_day')} />

                    {category === 'business_trip' && (
                        <Field
                            id="destination"
                            label="Tujuan dinas"
                            error={error('destination')}
                        >
                            <Input
                                id="destination"
                                className={control}
                                value={data.destination}
                                maxLength={160}
                                placeholder="Mis. Kantor cabang Surabaya"
                                onChange={(e) =>
                                    setData('destination', e.target.value)
                                }
                            />
                        </Field>
                    )}
                </>
            )}

            <div className="grid gap-2">
                <Label htmlFor="reason">
                    {category === 'procurement'
                        ? 'Alasan / kebutuhan'
                        : 'Alasan'}
                </Label>
                <Textarea
                    id="reason"
                    rows={3}
                    maxLength={limits.reason}
                    className={cn('min-h-24', mobile && 'min-h-28 text-[17px]')}
                    value={data.reason}
                    placeholder={
                        category === 'overtime'
                            ? 'Pekerjaan yang diselesaikan saat lembur'
                            : category === 'procurement'
                              ? 'Untuk apa barang ini dibutuhkan'
                              : 'Mis. acara keluarga di luar kota'
                    }
                    onChange={(e) => setData('reason', e.target.value)}
                />
                <div className="flex justify-between text-meta text-text-muted">
                    <span>Terlihat oleh penyetuju dan HR.</span>
                    <span className="tnum">
                        {data.reason.length}/{limits.reason}
                    </span>
                </div>
                <InputError message={errors.reason} />
            </div>

            {category === 'leave' && (
                <div className="grid gap-2">
                    <Label htmlFor="substitute_id">Pengganti selama cuti</Label>
                    <select
                        id="substitute_id"
                        className={cn(selectClass, 'md:max-w-80', control)}
                        value={data.substitute_id}
                        onChange={(e) =>
                            setData('substitute_id', e.target.value)
                        }
                    >
                        <option value="">Tidak ada</option>
                        {substitutes.map((person) => (
                            <option key={person.id} value={person.id}>
                                {person.name}
                            </option>
                        ))}
                    </select>
                    {substitute && (
                        <p className="text-meta text-text-muted">
                            {substitute.name.split(' ')[0]} akan diberi tahu
                            saat cuti disetujui dan bisa menerima tugas yang
                            dialihkan.
                        </p>
                    )}
                    <InputError message={errors.substitute_id} />
                </div>
            )}

            <AttachmentInput state={state} limits={limits} mobile={mobile} />
        </div>
    );
}

function Field({
    id,
    label,
    error,
    className,
    children,
}: {
    id: string;
    label: string;
    error?: string;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <div className={cn('grid content-start gap-2', className)}>
            <Label htmlFor={id}>{label}</Label>
            {children}
            <InputError message={error} />
        </div>
    );
}

function AttachmentInput({
    state,
    limits,
    mobile,
}: Pick<Props, 'state' | 'limits' | 'mobile'>) {
    const {
        form,
        existingAttachments,
        removeExisting,
        addFiles,
        removeFile,
        preview,
        type,
    } = state;
    const fileInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);
    const required = preview?.attachment_required ?? false;
    const errors = form.errors as Record<string, string | undefined>;
    const fileError =
        errors.attachments ??
        Object.entries(errors).find(([key]) =>
            key.startsWith('attachments.'),
        )?.[1];
    const count = existingAttachments.length + form.data.attachments.length;
    const hint = `PDF, JPG, atau PNG · maks. ${formatNumber(limits.max_kilobytes / 1024)} MB`;

    const onFiles = (files: FileList | null) => {
        if (files && files.length > 0) {
            addFiles(files);
        }
    };

    return (
        <div className="grid gap-2">
            <span className="text-label text-text">
                Lampiran{' '}
                {required ? (
                    <span className="text-danger">(wajib)</span>
                ) : (
                    <span className="font-normal text-text-muted">
                        (opsional)
                    </span>
                )}
            </span>
            {required && type?.requires_attachment_after_days !== null && (
                <p className="flex items-center gap-1.5 text-meta text-warning">
                    <CircleAlert className="size-4" aria-hidden />
                    {type?.requires_attachment_after_days === 0
                        ? 'Jenis ini wajib melampirkan berkas.'
                        : `Wajib surat bila lebih dari ${type?.requires_attachment_after_days} hari.`}
                </p>
            )}

            <input
                ref={fileInput}
                type="file"
                className="sr-only"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                multiple
                tabIndex={-1}
                onChange={(e) => {
                    onFiles(e.target.files);
                    e.target.value = '';
                }}
            />
            <input
                ref={cameraInput}
                type="file"
                className="sr-only"
                accept="image/*"
                capture="environment"
                tabIndex={-1}
                onChange={(e) => {
                    onFiles(e.target.files);
                    e.target.value = '';
                }}
            />

            {count < limits.max_files &&
                (mobile ? (
                    <div className="grid grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={() => cameraInput.current?.click()}
                            className="flex h-14 items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-border-strong bg-background text-[16px] font-semibold text-text-muted"
                        >
                            <Camera className="size-5" aria-hidden /> Ambil foto
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                            className="flex h-14 items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-border-strong bg-background text-[16px] font-semibold text-text-muted"
                        >
                            <Paperclip className="size-5" aria-hidden /> Pilih
                            file
                        </button>
                    </div>
                ) : (
                    <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            onFiles(e.dataTransfer.files);
                        }}
                        className="flex items-center gap-3 rounded-[14px] border-2 border-dashed border-border-strong bg-background px-4 py-3"
                    >
                        <span className="flex size-10 items-center justify-center rounded-control border border-border bg-surface">
                            <Upload
                                className="size-5 text-text-muted"
                                aria-hidden
                            />
                        </span>
                        <div className="text-[16px] text-text-muted">
                            <button
                                type="button"
                                onClick={() => fileInput.current?.click()}
                                className="font-semibold text-link hover:underline"
                            >
                                Pilih file
                            </button>{' '}
                            atau seret ke sini
                            <p className="text-meta text-text-muted">{hint}</p>
                        </div>
                    </div>
                ))}
            {mobile && <p className="text-meta text-text-muted">{hint}</p>}

            {count > 0 && (
                <ul className="space-y-1.5">
                    {existingAttachments.map((file) => (
                        <FileRow
                            key={`e-${file.id}`}
                            name={file.filename}
                            size={file.size_bytes}
                            onRemove={() => removeExisting(file.id)}
                        />
                    ))}
                    {form.data.attachments.map((file, index) => (
                        <FileRow
                            key={`n-${index}-${file.name}`}
                            name={file.name}
                            size={file.size}
                            onRemove={() => removeFile(index)}
                        />
                    ))}
                </ul>
            )}
            <InputError message={fileError} />
        </div>
    );
}

function FileRow({
    name,
    size,
    onRemove,
}: {
    name: string;
    size: number;
    onRemove: () => void;
}) {
    return (
        <li className="flex min-h-12 items-center gap-2.5 rounded-control border border-border bg-surface py-1 pr-1 pl-3.5 text-[15px]">
            <Paperclip
                className="size-4 shrink-0 text-text-muted"
                aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{name}</span>
            <span className="shrink-0 text-meta text-text-muted tnum">
                {formatNumber(Math.round(size / 1024))} KB
            </span>
            <button
                type="button"
                onClick={onRemove}
                aria-label={`Hapus ${name}`}
                className="flex size-10 items-center justify-center rounded-[10px] text-text-muted hover:bg-surface-2 focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none"
            >
                <X className="size-4" aria-hidden />
            </button>
        </li>
    );
}
