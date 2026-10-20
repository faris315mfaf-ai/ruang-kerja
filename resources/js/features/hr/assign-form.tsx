import { router } from '@inertiajs/react';
import { Plus, Trash2, X } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import { Input, fieldClasses } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Radio } from '@/components/ui/radio';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn, focusRing } from '@/lib/utils';
import { store } from '@/routes/hr/assignments';
import {
    PRIORITY_OPTIONS,
    recipientCount,
    recipientOptions,
    recipientPayload,
    searchRecipients,
} from './lib';
import type { Recipient, RecipientOption } from './lib';
import type { AssignmentPickers } from './types';

type Mode = 'per_person' | 'shared';

/** The submit button needs recipients and a title (server validates the rest). */
export function canSubmitAssignment(
    recipients: Recipient[],
    title: string,
): boolean {
    return recipients.length > 0 && title.trim() !== '';
}

/** "Tugaskan 9 orang" / "Tugaskan ± 9 orang" / "Tugaskan". */
export function submitLabel(count: number, approximate: boolean): string {
    if (count <= 0) {
        return 'Tugaskan';
    }

    return `Tugaskan ${approximate ? '± ' : ''}${count} orang`;
}

const CHIP_TONES: Record<Recipient['type'], string> = {
    division: 'bg-link-soft text-link',
    team: 'bg-info-soft text-info',
    user: 'bg-surface-2 text-text',
};

/** Recipient combobox: search people, divisions, teams; chips with ×. */
function RecipientPicker({
    pickers,
    value,
    onChange,
    invalid,
    autoFocus,
    errorId,
}: {
    pickers?: AssignmentPickers;
    value: Recipient[];
    onChange: (value: Recipient[]) => void;
    invalid: boolean;
    autoFocus?: boolean;
    errorId: string;
}) {
    const id = useId();
    const listId = `${id}-list`;
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const input = useRef<HTMLInputElement>(null);
    const options = useMemo(
        () => (pickers ? recipientOptions(pickers) : []),
        [pickers],
    );
    const results = searchRecipients(options, query, value);
    const byKey = new Map(
        options.map((option) => [`${option.type}:${option.id}`, option]),
    );

    const pick = (option: RecipientOption) => {
        onChange([...value, { type: option.type, id: option.id }]);
        setQuery('');
        setActive(0);
        input.current?.focus();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setOpen(true);
            setActive((index) => Math.min(index + 1, results.length - 1));
        } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            setActive((index) => Math.max(index - 1, 0));
        } else if (event.key === 'Enter') {
            if (open && results[active]) {
                event.preventDefault();
                pick(results[active]);
            }
        } else if (event.key === 'Escape') {
            setOpen(false);
        } else if (
            event.key === 'Backspace' &&
            query === '' &&
            value.length > 0
        ) {
            onChange(value.slice(0, -1));
        }
    };

    return (
        <div className="relative">
            <div
                className={cn(
                    fieldClasses,
                    'flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/55',
                    invalid && 'border-danger',
                )}
                onClick={() => input.current?.focus()}
            >
                {value.map((item) => {
                    const option = byKey.get(`${item.type}:${item.id}`);
                    const label = option
                        ? `${option.label}${option.type === 'user' ? '' : ` (${option.people})`}`
                        : 'Penerima';

                    return (
                        <span
                            key={`${item.type}:${item.id}`}
                            className={cn(
                                'inline-flex h-8 max-w-full items-center gap-1 rounded-full pr-1 pl-3 text-[14px] font-semibold',
                                CHIP_TONES[item.type],
                            )}
                        >
                            <span className="truncate">{label}</span>
                            <button
                                type="button"
                                aria-label={`Hapus ${label}`}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onChange(
                                        value.filter(
                                            (other) =>
                                                other.type !== item.type ||
                                                other.id !== item.id,
                                        ),
                                    );
                                }}
                                className={cn(
                                    'hit-area flex size-6 items-center justify-center rounded-full hover:bg-surface/60',
                                    focusRing,
                                )}
                            >
                                <X aria-hidden className="size-3.5" />
                            </button>
                        </span>
                    );
                })}
                <input
                    ref={input}
                    id={id}
                    role="combobox"
                    aria-expanded={open && results.length > 0}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-activedescendant={
                        open && results[active]
                            ? `${listId}-${active}`
                            : undefined
                    }
                    aria-label="Tambah penerima"
                    aria-invalid={invalid || undefined}
                    aria-describedby={invalid ? errorId : undefined}
                    autoFocus={autoFocus}
                    disabled={!pickers}
                    value={query}
                    placeholder={
                        pickers
                            ? value.length === 0
                                ? 'Orang, divisi, atau tim'
                                : 'Tambah lagi'
                            : 'Memuat daftar penerima…'
                    }
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => window.setTimeout(() => setOpen(false), 120)}
                    onKeyDown={onKeyDown}
                    className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-[16px] outline-none placeholder:text-text-subtle"
                />
            </div>
            {open && results.length > 0 && (
                <ul
                    id={listId}
                    role="listbox"
                    aria-label="Penerima"
                    className="glass-strong absolute inset-x-0 top-full z-40 mt-1.5 max-h-72 overflow-y-auto rounded-lg p-1.5 shadow-float"
                >
                    {results.map((option, index) => (
                        <li
                            key={`${option.type}:${option.id}`}
                            id={`${listId}-${index}`}
                            role="option"
                            aria-selected={index === active}
                            onMouseDown={(event) => {
                                event.preventDefault();
                                pick(option);
                            }}
                            onMouseEnter={() => setActive(index)}
                            className={cn(
                                'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-1.5',
                                index === active && 'bg-surface-2',
                            )}
                        >
                            <span className="truncate text-[15px] font-semibold">
                                {option.label}
                            </span>
                            <span className="shrink-0 text-meta text-text-muted">
                                {option.meta}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/**
 * "Tugaskan pegawai" (Penugasan.dc.html side card, bottom sheet on phones):
 * POST /hr/penugasan. Tasks land in the "Penugasan HR" workspace; every
 * recipient sees them in Tugas saya.
 */
export function AssignForm({
    pickers,
    limits,
    today,
    onDone,
    onCancel,
    autoFocus = false,
    formId = 'hr-assign-form',
    hideActions = false,
}: {
    pickers?: AssignmentPickers;
    limits: { recipients: number; checklist: number };
    /** Office date (Y-m-d): earliest due date. */
    today: string;
    onDone?: () => void;
    onCancel?: () => void;
    autoFocus?: boolean;
    formId?: string;
    /** Actions are rendered by the caller (bottom sheet footer). */
    hideActions?: boolean;
}) {
    const ids = useId();
    const [recipients, setRecipients] = useState<Recipient[]>([]);
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState<Mode>('per_person');
    const [due, setDue] = useState('');
    const [priority, setPriority] = useState('3');
    const [description, setDescription] = useState('');
    const [checklist, setChecklist] = useState<string[]>([]);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [processing, setProcessing] = useState(false);
    const options = useMemo(
        () => (pickers ? recipientOptions(pickers) : []),
        [pickers],
    );
    const reach = recipientCount(recipients, options);

    const reset = () => {
        setRecipients([]);
        setTitle('');
        setMode('per_person');
        setDue('');
        setPriority('3');
        setDescription('');
        setChecklist([]);
        setErrors({});
    };

    const submit = () => {
        if (!canSubmitAssignment(recipients, title)) {
            setErrors({
                ...(recipients.length === 0
                    ? { recipients: 'Pilih minimal satu penerima.' }
                    : {}),
                ...(title.trim() === ''
                    ? { title: 'Judul tugas wajib diisi.' }
                    : {}),
            });

            return;
        }

        router.post(
            store.url(),
            {
                ...recipientPayload(recipients),
                mode,
                title,
                description_text:
                    description.trim() === '' ? null : description,
                due_date: due === '' ? null : due,
                priority: Number(priority),
                checklist: checklist.map((item) => item.trim()).filter(Boolean),
            },
            {
                preserveScroll: true,
                preserveState: true,
                only: ['assignments'],
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onError: (response) => setErrors(response),
                onSuccess: () => {
                    reset();
                    onDone?.();
                },
            },
        );
    };

    const recipientError =
        errors.recipients ??
        errors.user_ids ??
        errors.division_ids ??
        errors.team_ids;
    const checklistError =
        errors.checklist ??
        Object.entries(errors).find(([key]) =>
            key.startsWith('checklist.'),
        )?.[1];

    return (
        <form
            id={formId}
            noValidate
            className="flex flex-col gap-4"
            onSubmit={(event) => {
                event.preventDefault();
                submit();
            }}
        >
            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-title`}>Judul tugas</Label>
                <Input
                    id={`${ids}-title`}
                    value={title}
                    maxLength={255}
                    aria-invalid={errors.title ? true : undefined}
                    aria-describedby={
                        errors.title ? `${ids}-title-error` : undefined
                    }
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Mis. Isi survei kepuasan kerja 2026"
                />
                <InputError id={`${ids}-title-error`} message={errors.title} />
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[15px] leading-[22px] font-semibold">
                    Ditugaskan ke
                </span>
                <RecipientPicker
                    pickers={pickers}
                    value={recipients}
                    onChange={(value) => {
                        setRecipients(value);
                        setErrors((current) => {
                            const next = { ...current };
                            delete next.recipients;

                            return next;
                        });
                    }}
                    invalid={Boolean(recipientError)}
                    autoFocus={autoFocus}
                    errorId={`${ids}-recipients-error`}
                />
                <p className="text-meta text-text-muted">
                    {recipients.length === 0
                        ? `Pilih orang, divisi, atau tim (maks. ${limits.recipients} orang).`
                        : `${reach.approximate ? '± ' : ''}${reach.count} orang menerima tugas ini.`}
                </p>
                <InputError
                    id={`${ids}-recipients-error`}
                    message={recipientError}
                />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-due`}>Tenggat</Label>
                    <DateInput
                        id={`${ids}-due`}
                        value={due}
                        onChange={setDue}
                        min={today}
                    />
                    <InputError message={errors.due_date} />
                </div>
                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${ids}-priority`}>Prioritas</Label>
                    <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger
                            id={`${ids}-priority`}
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {PRIORITY_OPTIONS.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <InputError message={errors.priority} />
                </div>
            </div>

            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[15px] leading-[22px] font-semibold">
                    Cara ditugaskan
                </legend>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                    <Radio
                        name={`${ids}-mode`}
                        value="per_person"
                        checked={mode === 'per_person'}
                        onChange={() => setMode('per_person')}
                        className="mt-0.5"
                    />
                    <span className="flex flex-col">
                        <span className="text-[16px] font-semibold">
                            Satu tugas per orang
                        </span>
                        <span className="text-meta text-text-muted">
                            Progres tiap orang terlihat terpisah.
                        </span>
                    </span>
                </label>
                <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1">
                    <Radio
                        name={`${ids}-mode`}
                        value="shared"
                        checked={mode === 'shared'}
                        onChange={() => setMode('shared')}
                        className="mt-0.5"
                    />
                    <span className="flex flex-col">
                        <span className="text-[16px] font-semibold">
                            Satu tugas bersama
                        </span>
                        <span className="text-meta text-text-muted">
                            Semua penerima menjadi penanggung jawab satu tugas.
                        </span>
                    </span>
                </label>
                <InputError message={errors.mode} />
            </fieldset>

            <div className="flex flex-col gap-1.5">
                <Label htmlFor={`${ids}-description`}>Instruksi</Label>
                <Textarea
                    id={`${ids}-description`}
                    rows={3}
                    value={description}
                    maxLength={20000}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Apa yang harus dikerjakan dan bagaimana hasilnya diserahkan."
                />
                <InputError message={errors.description_text} />
            </div>

            <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-[15px] leading-[22px] font-semibold">
                    Checklist{' '}
                    <span className="font-normal text-text-muted">
                        (opsional)
                    </span>
                </legend>
                {checklist.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                        <Input
                            aria-label={`Butir checklist ${index + 1}`}
                            value={item}
                            maxLength={255}
                            onChange={(event) =>
                                setChecklist((items) =>
                                    items.map((value, other) =>
                                        other === index
                                            ? event.target.value
                                            : value,
                                    ),
                                )
                            }
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Hapus butir ${index + 1}`}
                            onClick={() =>
                                setChecklist((items) =>
                                    items.filter((_, other) => other !== index),
                                )
                            }
                        >
                            <Trash2 aria-hidden />
                        </Button>
                    </div>
                ))}
                {checklist.length < limits.checklist ? (
                    <Button
                        type="button"
                        variant="quiet"
                        className="self-start"
                        onClick={() => setChecklist((items) => [...items, ''])}
                    >
                        <Plus aria-hidden />
                        Tambah butir
                    </Button>
                ) : (
                    <p className="text-meta text-text-muted">
                        Maksimal {limits.checklist} butir.
                    </p>
                )}
                <InputError message={checklistError} />
            </fieldset>

            {!hideActions && (
                <div className="flex flex-wrap justify-end gap-3 pt-1">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            reset();
                            onCancel?.();
                        }}
                    >
                        Batal
                    </Button>
                    <AssignSubmit
                        processing={processing}
                        disabled={!canSubmitAssignment(recipients, title)}
                        label={submitLabel(reach.count, reach.approximate)}
                    />
                </div>
            )}
            {hideActions && (
                <AssignSubmit
                    processing={processing}
                    disabled={!canSubmitAssignment(recipients, title)}
                    label={submitLabel(reach.count, reach.approximate)}
                    size="lg"
                    className="w-full"
                />
            )}
        </form>
    );
}

function AssignSubmit({
    processing,
    disabled,
    label,
    size,
    className,
}: {
    processing: boolean;
    disabled: boolean;
    label: string;
    size?: 'lg';
    className?: string;
}) {
    return (
        <Button
            type="submit"
            size={size}
            className={className}
            disabled={disabled || processing}
        >
            {processing && <Spinner />}
            {label}
        </Button>
    );
}
