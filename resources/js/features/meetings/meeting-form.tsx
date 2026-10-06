import { Check, Clock, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Panel } from '@/components/ui/panel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { nextTabIndex } from '@/components/ui/tabs';
import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { MeetingFormValues } from './lib';
import {
    durationLabel,
    firstName,
    isEmail,
    personById,
    PLATFORM_LABEL,
    RECURRENCE_LABEL,
    shortDate,
} from './lib';
import { PeoplePicker } from './people-picker';
import type { Recurrence } from './types';
import type { MeetingForm } from './use-meeting-form';
import { REMINDER_OPTIONS } from './use-meeting-form';

/** Start times every 15 minutes, 06.00–21.45, shown 24-hour ("13.30"). */
const START_TIMES = Array.from({ length: 64 }, (_, index) => {
    const minutes = 6 * 60 + index * 15;

    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
});

type FormPlatform = MeetingFormValues['platform'];

const PLATFORMS: { value: FormPlatform; hint: string }[] = [
    { value: 'meet', hint: 'tempel tautan Meet' },
    { value: 'zoom', hint: 'tempel tautan Zoom' },
    { value: 'room', hint: 'isi ruangan' },
    { value: 'client', hint: 'alamat klien' },
];

function FieldError({ id, message }: { id: string; message?: string }) {
    return message ? (
        <p id={id} className="text-[14px] font-semibold text-danger">
            {message}
        </p>
    ) : null;
}

function Field({
    label,
    htmlFor,
    error,
    errorId,
    children,
    className,
}: {
    label: string;
    htmlFor: string;
    error?: string;
    errorId: string;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('flex min-w-0 flex-col gap-2', className)}>
            <Label htmlFor={htmlFor} className="text-[16px] font-bold">
                {label}
            </Label>
            {children}
            <FieldError id={errorId} message={error} />
        </div>
    );
}

/** Three large radio cards: Google Meet · Zoom · Tatap muka. */
function PlatformPicker({
    value,
    onChange,
    labelId,
}: {
    value: FormPlatform;
    onChange: (value: FormPlatform) => void;
    labelId: string;
}) {
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = PLATFORMS.findIndex((p) => p.value === value);
        const next = nextTabIndex(
            index,
            event.key === 'ArrowDown'
                ? 'ArrowRight'
                : event.key === 'ArrowUp'
                  ? 'ArrowLeft'
                  : event.key,
            PLATFORMS.length,
        );

        if (next === null) {
            return;
        }

        event.preventDefault();
        onChange(PLATFORMS[next].value);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-labelledby={labelId}
            className="grid grid-cols-2 gap-2.5 xl:grid-cols-4"
        >
            {PLATFORMS.map((platform, index) => {
                const selected = platform.value === value;

                return (
                    <button
                        key={platform.value}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(platform.value)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'flex min-h-[60px] flex-col justify-center gap-0.5 rounded-[16px] px-4 py-3 text-left transition-[background-color,box-shadow] duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring sm:min-h-[76px]',
                            selected
                                ? 'bg-grad-aksi text-on-brand shadow-glow'
                                : 'border border-border bg-surface text-text hover:bg-surface-2',
                        )}
                    >
                        <span className="text-[17px] font-extrabold">
                            {PLATFORM_LABEL[platform.value]}
                        </span>
                        <span className="text-[14px] font-medium">
                            {platform.hint}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

/** All fields of the scheduling form (DRapatBaru left card). */
export function MeetingFormFields({ form }: { form: MeetingForm }) {
    const id = useId();
    const { values, set, errors } = form;
    const fid = (name: string) => `${id}-${name}`;
    const err = (name: string) => `${id}-${name}-error`;
    const describe = (name: keyof typeof errors) =>
        errors[name] ? err(name) : undefined;

    return (
        <div className="flex flex-col gap-[22px]">
            <Field
                label="Judul rapat"
                htmlFor={fid('title')}
                error={errors.title}
                errorId={err('title')}
            >
                <Input
                    id={fid('title')}
                    value={values.title}
                    onChange={(event) => set('title', event.target.value)}
                    placeholder="Misalnya: Review vendor logistik"
                    maxLength={160}
                    aria-invalid={Boolean(errors.title) || undefined}
                    aria-describedby={describe('title')}
                    className="h-[52px] text-[18px] font-semibold"
                />
            </Field>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Field
                    label="Tanggal"
                    htmlFor={fid('date')}
                    error={errors.date}
                    errorId={err('date')}
                >
                    <DateInput
                        id={fid('date')}
                        value={values.date}
                        min={form.editing ? undefined : form.today}
                        clearable={false}
                        onChange={(value) => set('date', value)}
                        aria-invalid={Boolean(errors.date) || undefined}
                        aria-describedby={describe('date')}
                        inputClassName="h-[50px] max-md:h-[50px]"
                    />
                </Field>
                <Field
                    label="Mulai"
                    htmlFor={fid('start')}
                    error={errors.start}
                    errorId={err('start')}
                >
                    <Select
                        value={values.start}
                        onValueChange={(value) => value && set('start', value)}
                    >
                        <SelectTrigger
                            id={fid('start')}
                            className="h-[50px] w-full"
                            aria-invalid={Boolean(errors.start) || undefined}
                            aria-describedby={describe('start')}
                        >
                            <SelectValue placeholder="Pilih jam" />
                        </SelectTrigger>
                        <SelectContent>
                            {(START_TIMES.includes(values.start)
                                ? START_TIMES
                                : [values.start, ...START_TIMES].sort()
                            ).map((time) => (
                                <SelectItem key={time} value={time}>
                                    {time.replace(':', '.')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field
                    label="Durasi"
                    htmlFor={fid('duration')}
                    errorId={err('duration')}
                >
                    <Select
                        value={String(values.duration)}
                        onValueChange={(value) =>
                            value && set('duration', Number(value))
                        }
                    >
                        <SelectTrigger
                            id={fid('duration')}
                            className="h-[50px] w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {form.durations.map((minutes) => (
                                <SelectItem
                                    key={minutes}
                                    value={String(minutes)}
                                >
                                    {durationLabel(minutes)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            <div className="flex flex-col gap-2.5">
                <span id={fid('platform')} className="text-[16px] font-bold">
                    Tempat rapat
                </span>
                <PlatformPicker
                    value={values.platform}
                    onChange={(value) => set('platform', value)}
                    labelId={fid('platform')}
                />
                {(values.platform === 'meet' || values.platform === 'zoom') && (
                    <Field
                        label={
                            values.platform === 'zoom'
                                ? 'Tautan Zoom'
                                : 'Tautan Google Meet (opsional)'
                        }
                        htmlFor={fid('link')}
                        error={errors.joinUrl}
                        errorId={err('joinUrl')}
                    >
                        <Input
                            id={fid('link')}
                            type="url"
                            inputMode="url"
                            value={values.joinUrl}
                            onChange={(event) =>
                                set('joinUrl', event.target.value)
                            }
                            placeholder={
                                values.platform === 'zoom'
                                    ? 'https://zoom.us/j/81234567890'
                                    : 'https://meet.google.com/abc-defg-hij'
                            }
                            aria-invalid={Boolean(errors.joinUrl) || undefined}
                            aria-describedby={describe('joinUrl')}
                            className="h-[50px] font-mono text-[15px]"
                        />
                        <p className="text-[14px] text-text-muted">
                            {values.platform === 'meet'
                                ? 'Tautan Meet otomatis lewat Google Calendar ditahan. Tempel tautan dari Google Meet, atau isi nanti saat mengubah rapat.'
                                : 'Tautan dicek formatnya dan ikut di pengingat peserta.'}
                        </p>
                    </Field>
                )}
                {(values.platform === 'room' ||
                    values.platform === 'client') && (
                    <Field
                        label={
                            values.platform === 'room'
                                ? 'Ruangan'
                                : 'Alamat klien'
                        }
                        htmlFor={fid('location')}
                        error={errors.location}
                        errorId={err('location')}
                    >
                        <Input
                            id={fid('location')}
                            value={values.location}
                            onChange={(event) =>
                                set('location', event.target.value)
                            }
                            maxLength={200}
                            placeholder={
                                values.platform === 'room'
                                    ? 'Misalnya: Ruang Rapat Lt. 3'
                                    : 'Nama klien dan alamatnya'
                            }
                            aria-invalid={Boolean(errors.location) || undefined}
                            aria-describedby={describe('location')}
                            className="h-[50px]"
                        />
                    </Field>
                )}
            </div>

            <div className="flex flex-col gap-2.5">
                <span id={fid('people')} className="text-[16px] font-bold">
                    Peserta{' '}
                    <span className="font-medium text-text-muted">
                        · {values.participants.length} orang
                    </span>
                </span>
                <PeoplePicker
                    people={form.people}
                    me={form.me}
                    value={values.participants}
                    onAdd={form.addParticipant}
                    onRemove={form.removeParticipant}
                    invalid={Boolean(errors.participants)}
                    describedBy={describe('participants')}
                    labelId={fid('people')}
                />
                <FieldError
                    id={err('participants')}
                    message={errors.participants}
                />
            </div>

            <fieldset
                className="flex flex-col gap-2.5"
                aria-describedby={describe('agenda')}
            >
                <legend className="pb-2.5 text-[16px] font-bold">Agenda</legend>
                <ol className="flex flex-col gap-2">
                    {values.agenda.map((item, index) => (
                        <li key={index} className="flex items-center gap-2">
                            <span
                                aria-hidden
                                className="flex size-9 shrink-0 items-center justify-center rounded-control bg-grad-merek text-[15px] font-extrabold text-on-brand"
                            >
                                {index + 1}
                            </span>
                            <Input
                                aria-label={`Butir agenda ${index + 1}`}
                                value={item}
                                onChange={(event) =>
                                    set(
                                        'agenda',
                                        values.agenda.map((value, i) =>
                                            i === index
                                                ? event.target.value
                                                : value,
                                        ),
                                    )
                                }
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault();
                                        set('agenda', [
                                            ...values.agenda.slice(
                                                0,
                                                index + 1,
                                            ),
                                            '',
                                            ...values.agenda.slice(index + 1),
                                        ]);
                                    }
                                }}
                                placeholder={
                                    index === 0
                                        ? 'Misalnya: Evaluasi pengiriman September'
                                        : 'Butir berikutnya'
                                }
                                aria-invalid={
                                    (Boolean(errors.agenda) &&
                                        item.trim() === '') ||
                                    undefined
                                }
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Hapus butir agenda ${index + 1}`}
                                disabled={values.agenda.length === 1}
                                onClick={() =>
                                    set(
                                        'agenda',
                                        values.agenda.filter(
                                            (_, i) => i !== index,
                                        ),
                                    )
                                }
                            >
                                <Trash2 aria-hidden />
                            </Button>
                        </li>
                    ))}
                </ol>
                <Button
                    type="button"
                    variant="quiet"
                    className="self-start"
                    onClick={() => set('agenda', [...values.agenda, ''])}
                >
                    <Plus aria-hidden />
                    Tambah butir agenda
                </Button>
                <FieldError id={err('agenda')} message={errors.agenda} />
            </fieldset>

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                <Field
                    label="Notulis"
                    htmlFor={fid('taker')}
                    errorId={err('taker')}
                >
                    <Select
                        value={values.minuteTakerId}
                        onValueChange={(value) =>
                            value && set('minuteTakerId', value)
                        }
                    >
                        <SelectTrigger
                            id={fid('taker')}
                            className="h-[50px] w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {form.internalPeople.map((person) => (
                                <SelectItem key={person.id} value={person.id}>
                                    {person.id === form.me
                                        ? 'Saya'
                                        : person.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field
                    label="Ulangi"
                    htmlFor={fid('repeat')}
                    errorId={err('repeat')}
                >
                    <Select
                        value={values.recurrence}
                        onValueChange={(value) =>
                            value && set('recurrence', value as Recurrence)
                        }
                    >
                        <SelectTrigger
                            id={fid('repeat')}
                            className="h-[50px] w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {(
                                Object.keys(RECURRENCE_LABEL) as Recurrence[]
                            ).map((key) => (
                                <SelectItem key={key} value={key}>
                                    {RECURRENCE_LABEL[key]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
                <Field
                    label="Workspace"
                    htmlFor={fid('ws')}
                    errorId={err('ws')}
                >
                    <Select
                        value={values.workspace}
                        onValueChange={(value) =>
                            value && set('workspace', value)
                        }
                    >
                        <SelectTrigger
                            id={fid('ws')}
                            className="h-[50px] w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">
                                Tanpa workspace
                            </SelectItem>
                            {form.workspaces.map((workspace) => (
                                <SelectItem
                                    key={workspace.id}
                                    value={workspace.id}
                                >
                                    {workspace.key} · {workspace.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>

            {values.recurrence !== 'none' && (
                <Field
                    label="Berulang sampai (opsional)"
                    htmlFor={fid('until')}
                    error={errors.recurrenceUntil}
                    errorId={err('recurrenceUntil')}
                    className="sm:max-w-[260px]"
                >
                    <DateInput
                        id={fid('until')}
                        value={values.recurrenceUntil}
                        min={values.date || undefined}
                        onChange={(value) => set('recurrenceUntil', value)}
                        aria-invalid={
                            Boolean(errors.recurrenceUntil) || undefined
                        }
                        aria-describedby={describe('recurrenceUntil')}
                        inputClassName="h-[50px] max-md:h-[50px]"
                    />
                </Field>
            )}

            <p className="-mt-2 text-[14px] text-text-muted">
                Workspace dipakai saat tindak lanjut notulen dijadikan tugas.
            </p>

            {form.canLead && (
                <div className="flex min-h-12 items-center justify-between gap-3 rounded-[16px] border border-border px-4 py-2">
                    <span className="flex flex-col">
                        <span
                            id={fid('lead')}
                            className="text-[16px] font-bold"
                        >
                            Rapat pimpinan
                        </span>
                        <span className="text-[14px] text-text-muted">
                            Tampil di Jadwal & notulensi manajemen untuk Direksi
                            dan HR.
                        </span>
                    </span>
                    <Switch
                        size="md"
                        checked={values.leadership}
                        onCheckedChange={(checked) =>
                            set('leadership', checked)
                        }
                        aria-labelledby={fid('lead')}
                    />
                </div>
            )}
        </div>
    );
}

/** "Pengingat" switches (DRapatBaru aside). */
export function RemindersCard({
    form,
    className,
}: {
    form: MeetingForm;
    className?: string;
}) {
    const toggle = (minutes: number) =>
        form.set(
            'reminders',
            form.values.reminders.includes(minutes)
                ? form.values.reminders.filter((value) => value !== minutes)
                : [...form.values.reminders, minutes].sort((a, b) => b - a),
        );

    return (
        <Panel title="Pengingat" className={className}>
            <ul className="flex flex-col">
                {REMINDER_OPTIONS.map((minutes) => (
                    <li
                        key={minutes}
                        className="flex min-h-12 items-center justify-between gap-3 border-t border-divider first:border-t-0"
                    >
                        <span
                            className="text-[16px]"
                            id={`reminder-${minutes}`}
                        >
                            {minutes} menit sebelum
                        </span>
                        <Switch
                            size="md"
                            checked={form.values.reminders.includes(minutes)}
                            onCheckedChange={() => toggle(minutes)}
                            aria-labelledby={`reminder-${minutes}`}
                        />
                    </li>
                ))}
                <li className="flex min-h-12 items-center justify-between gap-3 border-t border-divider">
                    <span className="flex flex-col">
                        <span
                            className="text-[16px] text-text-subtle"
                            id="reminder-wa"
                        >
                            WhatsApp
                        </span>
                        <span className="text-[14px] font-semibold text-text-muted">
                            Ditahan
                        </span>
                    </span>
                    <Switch
                        size="md"
                        checked={false}
                        disabled
                        aria-labelledby="reminder-wa"
                    />
                </li>
            </ul>
        </Panel>
    );
}

/** Warm card listing busy participants + the free-slot suggestion. */
export function ConflictCard({
    form,
    className,
}: {
    form: MeetingForm;
    className?: string;
}) {
    if (form.conflicts.length === 0) {
        return form.values.participants.length > 1 ? (
            <div
                role="status"
                className={cn(
                    'flex items-center gap-3 rounded-[20px] bg-success-soft px-[18px] py-4 text-success',
                    className,
                )}
            >
                <Check
                    aria-hidden
                    className="size-6 shrink-0"
                    strokeWidth={2.4}
                />
                <span className="text-[16px] leading-6 font-semibold">
                    Semua peserta internal kosong di jam ini.
                </span>
            </div>
        ) : null;
    }

    return (
        <div
            role="status"
            className={cn(
                'flex flex-col gap-3 rounded-[20px] bg-grad-hangat px-[18px] py-4 text-on-brand shadow-warm',
                className,
            )}
        >
            <div className="flex gap-3">
                <Clock
                    aria-hidden
                    className="size-6 shrink-0"
                    strokeWidth={2}
                />
                <div className="flex flex-col gap-1 text-[16px] leading-6 font-semibold">
                    {form.conflicts.map((conflict) => {
                        const person = personById(
                            form.people,
                            conflict.user_id,
                        );

                        return (
                            <span
                                key={`${conflict.user_id}-${conflict.starts_at}`}
                            >
                                {person?.id === form.me
                                    ? 'Anda'
                                    : (person?.name ?? 'Peserta')}{' '}
                                ada{' '}
                                {conflict.title
                                    .toLowerCase()
                                    .startsWith('rapat')
                                    ? conflict.title.toLowerCase()
                                    : `"${conflict.title}"`}{' '}
                                {formatTime(conflict.starts_at)}–
                                {formatTime(conflict.ends_at)}.
                            </span>
                        );
                    })}
                    <span className="font-medium">
                        {form.suggestion
                            ? `Usulan waktu kosong semua peserta: ${form.suggestion.replace(':', '.')}.`
                            : 'Tidak ada waktu kosong bersama sampai 17.00. Coba hari lain.'}
                    </span>
                </div>
            </div>
            {form.suggestion && (
                <Button
                    variant="outline"
                    className="self-start border-0 bg-on-brand font-bold text-danger hover:bg-on-brand/90"
                    onClick={form.applySuggestion}
                >
                    <Sparkles aria-hidden />
                    Pakai {form.suggestion.replace(':', '.')}
                </Button>
            )}
        </div>
    );
}

/** Review list shown in the confirmation dialog / sheet. */
export function MeetingSummary({ form }: { form: MeetingForm }) {
    const { values } = form;
    const internal = values.participants.filter((p) => !isEmail(p));
    const guests = values.participants.filter(isEmail);
    const place =
        values.platform === 'room' || values.platform === 'client'
            ? `${PLATFORM_LABEL[values.platform]} · ${values.location.trim()}`
            : values.joinUrl.trim()
              ? `${PLATFORM_LABEL[values.platform]} · ${values.joinUrl.trim().replace(/^https:\/\//, '')}`
              : `${PLATFORM_LABEL[values.platform]} (tautan belum diisi)`;
    const rows: [string, string][] = [
        ['Judul', values.title.trim()],
        [
            'Waktu',
            `${shortDate(values.date)} · ${values.start.replace(':', '.')} · ${durationLabel(values.duration)}`,
        ],
        ['Tempat', place],
        [
            'Peserta',
            `${internal.map((id) => firstName(personById(form.people, id)?.name ?? id)).join(', ')}${guests.length ? ` + ${guests.length} tamu` : ''}`,
        ],
        [
            'Agenda',
            values.agenda
                .filter((item) => item.trim())
                .map((item, i) => `${i + 1}. ${item.trim()}`)
                .join('\n'),
        ],
        ['Notulis', personById(form.people, values.minuteTakerId)?.name ?? '–'],
        [
            'Ulangi',
            values.recurrence !== 'none' && values.recurrenceUntil
                ? `${RECURRENCE_LABEL[values.recurrence]} sampai ${shortDate(values.recurrenceUntil)}`
                : RECURRENCE_LABEL[values.recurrence],
        ],
        [
            'Pengingat',
            values.reminders.length
                ? values.reminders.map((m) => `${m} menit`).join(', ') +
                  ' sebelum'
                : 'Tidak ada',
        ],
    ];

    return (
        <div className="flex flex-col gap-3">
            <dl className="flex flex-col divide-y divide-divider rounded-lg border border-border bg-surface px-4">
                {rows.map(([key, value]) => (
                    <div
                        key={key}
                        className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:gap-4"
                    >
                        <dt className="w-28 shrink-0 text-[14px] font-semibold text-text-muted">
                            {key}
                        </dt>
                        <dd className="text-[16px] leading-6 font-semibold break-words whitespace-pre-line">
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
            {form.conflicts.length > 0 && (
                <p className="rounded-control bg-warning-soft px-3.5 py-2.5 text-[15px] font-semibold text-warning">
                    {form.conflicts.length} bentrok jadwal belum diselesaikan.
                    Undangan tetap bisa dikirim.
                </p>
            )}
            <p className="text-[14px] text-text-muted">
                Undangan masuk ke Inbox RuangKerja dan email peserta internal.
                {guests.length > 0 &&
                    ' Tamu eksternal belum menerima email: undangan kalender Google ditahan.'}
            </p>
        </div>
    );
}
