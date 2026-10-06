import { Link } from '@inertiajs/react';
import { Check, Clock, Plus, Sparkles, Trash2 } from 'lucide-react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useId, useRef } from 'react';
import { Button } from '@/components/ui/button';
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
import { PEOPLE, ROOMS } from './fixtures';
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
import { DURATIONS, REMINDER_OPTIONS, WORKSPACES } from './use-meeting-form';

type FormPlatform = MeetingFormValues['platform'];

const PLATFORMS: { value: FormPlatform; hint: string }[] = [
    { value: 'meet', hint: 'tautan dibuat otomatis' },
    { value: 'zoom', hint: 'tempel tautan rapat' },
    { value: 'room', hint: 'pilih ruangan' },
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
            className="grid grid-cols-1 gap-2.5 sm:grid-cols-3"
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
                    maxLength={140}
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
                    <Input
                        id={fid('date')}
                        type="date"
                        value={values.date}
                        min={form.today}
                        onChange={(event) => set('date', event.target.value)}
                        aria-invalid={Boolean(errors.date) || undefined}
                        aria-describedby={describe('date')}
                        className="h-[50px]"
                    />
                </Field>
                <Field
                    label="Mulai"
                    htmlFor={fid('start')}
                    error={errors.start}
                    errorId={err('start')}
                >
                    <Input
                        id={fid('start')}
                        type="time"
                        step={900}
                        value={values.start}
                        onChange={(event) => set('start', event.target.value)}
                        aria-invalid={Boolean(errors.start) || undefined}
                        aria-describedby={describe('start')}
                        className="h-[50px]"
                    />
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
                            {DURATIONS.map((minutes) => (
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
                {values.platform === 'meet' && (
                    <p className="rounded-[14px] bg-link-soft px-4 py-3.5 text-[16px] font-semibold text-link">
                        Tautan Google Meet dibuat otomatis lewat Google Calendar
                        saat disimpan.
                    </p>
                )}
                {values.platform === 'zoom' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
                        <Field
                            label="Tautan Zoom"
                            htmlFor={fid('zoom')}
                            error={errors.zoomUrl}
                            errorId={err('zoomUrl')}
                        >
                            <Input
                                id={fid('zoom')}
                                type="url"
                                inputMode="url"
                                value={values.zoomUrl}
                                onChange={(event) =>
                                    set('zoomUrl', event.target.value)
                                }
                                placeholder="https://zoom.us/j/81234567890"
                                aria-invalid={
                                    Boolean(errors.zoomUrl) || undefined
                                }
                                aria-describedby={describe('zoomUrl')}
                                className="h-[50px] font-mono text-[15px]"
                            />
                        </Field>
                        <Field
                            label="Kode sandi"
                            htmlFor={fid('pass')}
                            errorId={err('pass')}
                        >
                            <Input
                                id={fid('pass')}
                                value={values.zoomPasscode}
                                onChange={(event) =>
                                    set('zoomPasscode', event.target.value)
                                }
                                autoComplete="off"
                                className="h-[50px]"
                            />
                        </Field>
                        <p className="text-[14px] text-text-muted sm:col-span-2">
                            Tautan dicek formatnya. Kode sandi hanya terlihat
                            oleh peserta.
                        </p>
                    </div>
                )}
                {values.platform === 'room' && (
                    <Field
                        label="Ruangan"
                        htmlFor={fid('room')}
                        error={errors.room}
                        errorId={err('room')}
                    >
                        <Select
                            value={values.room}
                            onValueChange={(value) =>
                                value && set('room', value)
                            }
                        >
                            <SelectTrigger
                                id={fid('room')}
                                className="h-[50px] w-full"
                                aria-invalid={Boolean(errors.room) || undefined}
                                aria-describedby={describe('room')}
                            >
                                <SelectValue placeholder="Pilih ruangan" />
                            </SelectTrigger>
                            <SelectContent>
                                {ROOMS.map((room) => (
                                    <SelectItem key={room} value={room}>
                                        {room}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                    people={PEOPLE}
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
                                    {person.id === 'dimas'
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
                            {WORKSPACES.map((workspace) => (
                                <SelectItem
                                    key={workspace.key}
                                    value={workspace.key}
                                >
                                    {workspace.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </div>
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
                        <Link
                            href="/pengaturan/whatsapp"
                            // 44px touch target without changing the layout.
                            className="relative self-start text-[14px] font-semibold text-link after:absolute after:-inset-x-1 after:-inset-y-3 after:content-[''] hover:underline"
                        >
                            Atur WhatsApp
                        </Link>
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
                        const person = personById(PEOPLE, conflict.user_id);

                        return (
                            <span
                                key={`${conflict.user_id}-${conflict.starts_at}`}
                            >
                                {person?.id === 'dimas'
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
        values.platform === 'room'
            ? values.room
            : values.platform === 'zoom'
              ? `Zoom · ${values.zoomUrl.replace(/^https:\/\//, '')}`
              : 'Google Meet (tautan dibuat otomatis)';
    const rows: [string, string][] = [
        ['Judul', values.title.trim()],
        [
            'Waktu',
            `${shortDate(values.date)} · ${values.start.replace(':', '.')} · ${durationLabel(values.duration)}`,
        ],
        ['Tempat', place],
        [
            'Peserta',
            `${internal.map((id) => firstName(personById(PEOPLE, id)?.name ?? id)).join(', ')}${guests.length ? ` + ${guests.length} tamu` : ''}`,
        ],
        [
            'Agenda',
            values.agenda
                .filter((item) => item.trim())
                .map((item, i) => `${i + 1}. ${item.trim()}`)
                .join('\n'),
        ],
        ['Notulis', personById(PEOPLE, values.minuteTakerId)?.name ?? '–'],
        ['Ulangi', RECURRENCE_LABEL[values.recurrence]],
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
                Undangan masuk ke Google Calendar peserta dan Inbox RuangKerja.
            </p>
        </div>
    );
}

/** Success card after sending (DRapatBaru "Undangan terkirim"). */
export function SavedCard({ form }: { form: MeetingForm }) {
    const values = form.saved!;
    const count = values.participants.length - 1;
    const note =
        values.platform === 'zoom'
            ? 'Tautan Zoom ikut di undangan dan pengingat.'
            : values.platform === 'meet'
              ? 'Tautan Google Meet dibuat dan dibagikan.'
              : `${values.room.split(' · ')[0]} dipesan.`;

    return (
        <section
            role="status"
            className="flex flex-wrap items-center gap-4 rounded-[22px] bg-grad-aksi px-6 py-[22px] text-on-brand shadow-glow"
        >
            <span
                aria-hidden
                className="flex size-12 items-center justify-center rounded-full bg-on-brand text-primary"
            >
                <Check className="size-[26px]" strokeWidth={3} />
            </span>
            <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
                <span className="text-[20px] font-extrabold">
                    Undangan terkirim ke {count} peserta
                </span>
                <span className="text-[16px]">
                    {values.title.trim()} · {shortDate(values.date)}{' '}
                    {values.start.replace(':', '.')}. {note}
                </span>
            </span>
            <span className="flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    className="border-on-brand/45 bg-on-brand/12 font-bold text-on-brand hover:bg-on-brand/20"
                    onClick={form.reset}
                >
                    Jadwalkan lagi
                </Button>
                <Button
                    asChild
                    className="bg-on-brand bg-none font-extrabold text-brand-800 shadow-none hover:bg-on-brand/90"
                >
                    <Link href="/rapat">Ke daftar rapat</Link>
                </Button>
            </span>
        </section>
    );
}
