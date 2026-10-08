import { Link } from '@inertiajs/react';
import {
    Check,
    FileText,
    Flag,
    Pencil,
    Plus,
    SquareCheck,
    Square,
    Trash2,
    X,
} from 'lucide-react';
import type { FormEvent, ReactNode, RefObject } from 'react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { cursorTone } from '@/features/notes/cursor-tones';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { DateInput } from '@/components/ui/date-input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { dueLabel, firstName, officeDate, shortDate } from '../lib';
import type { ActionItem } from '../types';
import type { MinutesData } from '../use-minutes';
import type { RoomParticipant } from './types';

/** Who is typing where (LiveKit attribute `rk_minutes_at`). */
export type DocPresence = Record<string, RoomParticipant[]>;

export type DocVariant = 'page' | 'column' | 'sheet';

/** DOM id of a navigator target (contract §1.3 keys). */
export const docAnchor = (key: string) => `notulen-${key}`;

/** Textarea that grows with its text (no inner scrollbar on the paper). */
function GrowingText({
    value,
    onChange,
    onFocus,
    onBlur,
    label,
    placeholder,
    textRef,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    onFocus: () => void;
    onBlur: () => void;
    label: string;
    placeholder: string;
    textRef?: (element: HTMLTextAreaElement | null) => void;
    className?: string;
}) {
    const ref = useRef<HTMLTextAreaElement | null>(null);

    useLayoutEffect(() => {
        const element = ref.current;

        if (element) {
            element.style.height = 'auto';
            element.style.height = `${element.scrollHeight}px`;
        }
    }, [value]);

    return (
        <textarea
            ref={(element) => {
                ref.current = element;
                textRef?.(element);
            }}
            value={value}
            rows={1}
            aria-label={label}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className={cn(
                '-mx-2 w-[calc(100%+16px)] resize-none overflow-hidden rounded-sm bg-transparent px-2 py-1 text-text outline-none placeholder:text-text-subtle hover:bg-surface-2/60 focus-visible:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-ring',
                className,
            )}
        />
    );
}

/** Name flag of a collaborator typing in this part (mockup caret label). */
function PresenceFlags({ people }: { people: RoomParticipant[] | undefined }) {
    if (!people || people.length === 0) {
        return null;
    }

    return (
        <span className="pointer-events-none absolute -top-2.5 right-0 flex gap-1">
            {people.map((person) => (
                <span
                    key={person.id}
                    className={cn(
                        'rounded-[4px] px-1.5 py-px text-[11px] font-bold',
                        cursorTone(person.seat).label,
                    )}
                >
                    {person.first_name}
                    <span className="sr-only"> sedang mengetik di sini</span>
                </span>
            ))}
        </span>
    );
}

function AddLine({
    label,
    placeholder,
    onAdd,
    inputRef,
}: {
    label: string;
    placeholder: string;
    onAdd: (text: string) => void;
    inputRef?: RefObject<HTMLInputElement | null>;
}) {
    const [text, setText] = useState('');
    const id = useId();

    const submit = (event: FormEvent) => {
        event.preventDefault();

        if (text.trim()) {
            onAdd(text);
            setText('');
        }
    };

    return (
        <form onSubmit={submit} className="flex items-center gap-2">
            <label htmlFor={id} className="sr-only">
                {label}
            </label>
            <input
                ref={inputRef}
                id={id}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={placeholder}
                className="h-10 min-w-0 flex-1 rounded-sm border border-dashed border-border-strong bg-transparent px-3 text-[15px] text-text outline-none placeholder:text-text-subtle focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button
                type="submit"
                variant="tonal"
                size="sm"
                disabled={!text.trim()}
            >
                <Plus aria-hidden />
                {label}
            </Button>
        </form>
    );
}

/** "☐ OPS-1284 Ajukan PO ban · Rizky · Jum" — editable by the minute taker. */
function ActionChip({
    item,
    data,
    people,
    nameOf,
    editing,
    onEdit,
}: {
    item: ActionItem;
    data: MinutesData;
    people: RoomParticipant[];
    nameOf: (id: string | null) => string;
    editing: boolean;
    onEdit: (open: boolean) => void;
}) {
    const index = data.minutes.action_items.indexOf(item) + 1;
    const pending = item.id.startsWith('tmp-');

    if (editing && !data.readOnly) {
        return (
            <li className="flex flex-col gap-2 rounded-control border border-info/30 bg-info-soft p-3">
                <input
                    autoFocus
                    aria-label={`Butir tindak lanjut ${index}`}
                    value={item.text}
                    onChange={(event) =>
                        data.updateItem(item.id, { text: event.target.value })
                    }
                    placeholder="Apa yang harus dikerjakan"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-[15px] font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="flex flex-wrap items-center gap-2">
                    <Select
                        value={item.assignee_id ?? undefined}
                        onValueChange={(value) =>
                            value &&
                            data.updateItem(item.id, { assignee_id: value })
                        }
                    >
                        <SelectTrigger
                            aria-label={`Penanggung jawab butir ${index}`}
                            className="h-control-sm w-[180px]"
                        >
                            <SelectValue placeholder="Penanggung jawab" />
                        </SelectTrigger>
                        <SelectContent>
                            {people.map((person) => (
                                <SelectItem key={person.id} value={person.id}>
                                    {person.id === data.me
                                        ? `${person.name} (Anda)`
                                        : person.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="w-[170px]">
                        <DateInput
                            aria-label={`Tenggat butir ${index}`}
                            value={item.due_date ?? ''}
                            onChange={(value) =>
                                data.updateItem(item.id, {
                                    due_date: value || null,
                                })
                            }
                        />
                    </div>
                    <span className="ml-auto flex gap-1">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Hapus butir ${index}`}
                            onClick={() => data.removeItem(item.id)}
                            disabled={pending}
                        >
                            <Trash2 aria-hidden />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Selesai mengubah"
                            onClick={() => onEdit(false)}
                        >
                            <Check aria-hidden />
                        </Button>
                    </span>
                </div>
            </li>
        );
    }

    return (
        <li className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-8 max-w-full items-center gap-1.5 rounded-[6px] bg-info-soft px-2 py-1 text-[14px] font-semibold text-info">
                {item.done ? (
                    <SquareCheck aria-hidden className="size-4 shrink-0" />
                ) : (
                    <Square aria-hidden className="size-4 shrink-0" />
                )}
                <span className="min-w-0">
                    {item.task_key && (
                        <span className="font-mono">{item.task_key} </span>
                    )}
                    {item.text || 'Butir baru'}
                    {' · '}
                    {nameOf(item.assignee_id)}
                    {' · '}
                    {dueLabel(item.due_date, data.today)}
                </span>
            </span>
            {item.task_key && item.task_url ? (
                <Link
                    href={item.task_url}
                    className={cn(
                        'text-[13px] font-semibold text-link hover:underline',
                        focusRing,
                    )}
                >
                    Buka tugas
                </Link>
            ) : (
                data.canEdit &&
                !item.task_key && (
                    <Button
                        variant="tonal"
                        size="sm"
                        className="h-8"
                        disabled={
                            !item.text.trim() ||
                            pending ||
                            data.processing ||
                            (!data.meeting.workspace && !data.workspaceId)
                        }
                        onClick={() => data.makeTask(item.id)}
                    >
                        Jadikan tugas
                    </Button>
                )
            )}
            {!data.readOnly && !item.task_key && (
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Ubah butir ${index}`}
                    onClick={() => onEdit(true)}
                >
                    <Pencil aria-hidden />
                </Button>
            )}
        </li>
    );
}

function SaveState({ data }: { data: MinutesData }) {
    const minutes = data.minutes;

    return (
        <span role="status" aria-live="polite" className="shrink-0">
            {data.saving
                ? 'Menyimpan…'
                : data.unsaved
                  ? 'Belum tersimpan'
                  : minutes.saved_at
                    ? `Disimpan ${formatTime(minutes.saved_at)}`
                    : minutes.status === 'final'
                      ? 'Final'
                      : 'Draf baru'}
        </span>
    );
}

/**
 * The live minutes in the centre of the room ("Notulen Hidup"): the real
 * minutes of this occurrence through the existing minutes editor hook
 * (useMinutes: autosave + versions, follow-ups → tasks), laid out as a
 * paper document — numbered sections, decision blocks, follow-up chips and
 * name flags of whoever is typing. Read-only for everyone but the minute
 * taker and the organizer (MeetingPolicy).
 */
export function MinutesDoc({
    data,
    title,
    date,
    participants,
    presence,
    editors,
    onFocusPart,
    variant = 'page',
    quickAdd = false,
    collabBody,
    viewerId,
    editingName = null,
}: {
    data: MinutesData;
    title: string;
    date: string;
    participants: RoomParticipant[];
    presence: DocPresence;
    /** Avatars top right: people currently in the document. */
    editors: RoomParticipant[];
    onFocusPart: (key: string | null) => void;
    variant?: DocVariant;
    /** Phone: "+ Keputusan · + Tugas · + Poin" under the document. */
    quickAdd?: boolean;
    /** Collaborative text (Yjs) replacing the section fields for everyone. */
    collabBody?: ReactNode;
    viewerId: string;
    /** autosave mode: the server's "X sedang menyunting" holder. */
    editingName?: string | null;
}) {
    const { minutes } = data;
    const [editingItem, setEditingItem] = useState<string | null>(null);
    const decisionInput = useRef<HTMLInputElement | null>(null);
    const sectionRefs = useRef<(HTMLTextAreaElement | null)[]>([]);
    const known = new Map(participants.map((p) => [p.id, p]));
    const nameOf = (id: string | null) =>
        id ? (known.get(id)?.first_name ?? 'Peserta') : '–';
    const present = minutes.attendance
        .filter((mark) => mark.present)
        .map((mark) => nameOf(mark.user_id));
    const taker = participants.find((p) => p.roles.includes('minute_taker'));
    const compact = variant !== 'page';
    const typing = [
        ...new Set([
            ...editors
                .filter((person) => person.id !== viewerId)
                .map((person) => person.first_name),
            ...(editingName ? [editingName] : []),
        ]),
    ];
    const lastItem = minutes.action_items.at(-1);

    // A follow-up added with "+ Tugas" opens for editing.
    const count = minutes.action_items.length;
    const previous = useRef(count);

    useEffect(() => {
        if (count > previous.current && lastItem && !data.readOnly) {
            setEditingItem(lastItem.id);
        }

        previous.current = count;
    }, [count, lastItem, data.readOnly]);

    // tmp-… ids become real ids after the POST; keep the editor open.
    useEffect(() => {
        if (
            editingItem?.startsWith('tmp-') &&
            !minutes.action_items.some((item) => item.id === editingItem) &&
            lastItem
        ) {
            setEditingItem(lastItem.id);
        }
    }, [editingItem, minutes.action_items, lastItem]);

    // "+ Poin": a new bullet at the end of the last section typed in.
    const [lastSection, setLastSection] = useState<number | null>(null);
    const [pointRequest, setPointRequest] = useState(0);

    useEffect(() => {
        if (pointRequest === 0) {
            return;
        }

        const index = lastSection ?? minutes.sections.length - 1;
        const element = sectionRefs.current[index];

        if (element) {
            element.focus();
            element.setSelectionRange(
                element.value.length,
                element.value.length,
            );
        }
        // Only after a new point was requested.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pointRequest]);

    const addPoint = () => {
        const index = lastSection ?? minutes.sections.length - 1;
        const section = minutes.sections[index];

        if (!section) {
            return;
        }

        const body = section.body.replace(/\s*$/, '');
        data.updateSection(index, body === '' ? '• ' : `${body}\n• `);
        setPointRequest((value) => value + 1);
    };

    return (
        <article
            aria-label="Notulen rapat"
            data-testid="minutes-doc"
            className={cn(
                'flex flex-col text-text',
                variant === 'page' && 'gap-3.5 px-6 pt-10 pb-28 md:px-14',
                variant === 'column' && 'gap-3 px-6 pt-6 pb-28',
                variant === 'sheet' && 'gap-3 px-5 pt-5 pb-6',
            )}
        >
            <div className="flex items-center gap-2 text-[13px] text-text-muted">
                <FileText aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 truncate">
                    Notulen · {title} · {shortDate(officeDate(date))}
                </span>
                <span className="ml-auto flex items-center gap-2">
                    {!data.readOnly && <SaveState data={data} />}
                    {editors.length > 0 && (
                        <span
                            className="flex -space-x-1.5"
                            aria-label={`Di dokumen: ${editors.map((p) => p.first_name).join(', ')}`}
                        >
                            {editors.slice(0, 4).map((person) => (
                                <UserAvatar
                                    key={person.id}
                                    name={person.name}
                                    src={person.avatar_url}
                                    className="size-6 text-[10px] ring-2 ring-surface"
                                />
                            ))}
                        </span>
                    )}
                </span>
            </div>

            {variant !== 'sheet' && (
                <>
                    <h2
                        className={cn(
                            'font-extrabold tracking-[-0.02em]',
                            compact
                                ? 'text-[22px] leading-7'
                                : 'text-[30px] leading-[38px]',
                        )}
                    >
                        {title}
                    </h2>
                    <p className="text-[15px] text-text-muted">
                        Hadir:{' '}
                        {present.length > 0 ? present.join(', ') : 'belum ada'}
                        {taker ? ` · Notulis: ${taker.first_name}` : ''}
                    </p>
                </>
            )}

            {data.readOnly && !collabBody && typing.length > 0 && (
                <p
                    role="status"
                    className="flex items-center gap-2 text-[14px] font-semibold text-link"
                    data-testid="editing-hint"
                >
                    <Pencil aria-hidden className="size-4" />
                    {typing.join(' dan ')} sedang menyunting
                </p>
            )}

            {collabBody && (
                <section
                    id={docAnchor('section-0')}
                    aria-label="Catatan rapat bersama"
                    className="flex scroll-mt-4 flex-col"
                >
                    {collabBody}
                </section>
            )}

            {!collabBody && minutes.sections.length === 0 && data.readOnly && (
                <p className="text-[16px] text-text-muted">
                    Notulis belum menulis apa pun.
                </p>
            )}

            {!collabBody &&
                minutes.sections.map((section, index) => {
                    const key = `section-${index}`;

                    return (
                        <section
                            key={`${section.title}-${index}`}
                            id={docAnchor(key)}
                            aria-labelledby={`${docAnchor(key)}-title`}
                            className="relative flex scroll-mt-4 flex-col gap-1.5"
                        >
                            <h3
                                id={`${docAnchor(key)}-title`}
                                className={cn(
                                    'mt-1.5 font-bold',
                                    compact
                                        ? 'text-[17px] leading-6'
                                        : 'text-[19px] leading-7',
                                )}
                            >
                                {index + 1}. {section.title}
                            </h3>
                            <PresenceFlags people={presence[key]} />
                            {data.readOnly ? (
                                <p className="text-[16px] leading-7 whitespace-pre-line">
                                    {section.body || (
                                        <span className="text-text-muted">
                                            Belum ada catatan.
                                        </span>
                                    )}
                                </p>
                            ) : (
                                <GrowingText
                                    value={section.body}
                                    label={`Catatan ${section.title}`}
                                    placeholder="Ketik poin pembahasan…"
                                    onChange={(body) =>
                                        data.updateSection(index, body)
                                    }
                                    onFocus={() => {
                                        setLastSection(index);
                                        onFocusPart(key);
                                    }}
                                    onBlur={() => onFocusPart(null)}
                                    textRef={(element) => {
                                        sectionRefs.current[index] = element;
                                    }}
                                    className="text-[16px] leading-7"
                                />
                            )}
                        </section>
                    );
                })}

            {!collabBody && (
                <section
                    id={docAnchor('decisions')}
                    aria-labelledby={`${docAnchor('decisions')}-title`}
                    className="relative flex scroll-mt-4 flex-col gap-2"
                >
                    <h3
                        id={`${docAnchor('decisions')}-title`}
                        className={cn(
                            'mt-1.5 font-bold',
                            compact ? 'text-[17px]' : 'text-[19px]',
                        )}
                    >
                        Keputusan
                    </h3>
                    <PresenceFlags people={presence.decisions} />
                    {minutes.decisions.length === 0 && (
                        <p className="text-[15px] text-text-muted">
                            Belum ada keputusan.
                        </p>
                    )}
                    <ul className="flex flex-col gap-2">
                        {minutes.decisions.map((decision, index) => (
                            <li
                                key={`${decision}-${index}`}
                                className="group flex items-start gap-2.5 rounded-[10px] bg-success-soft px-3.5 py-2.5 text-[16px] leading-6 text-success"
                            >
                                <Flag
                                    aria-hidden
                                    className="mt-0.5 size-[18px] shrink-0"
                                />
                                <span className="min-w-0 flex-1 text-text">
                                    <b className="font-bold text-success">
                                        Keputusan:
                                    </b>{' '}
                                    {decision}
                                </span>
                                {!data.readOnly && (
                                    <button
                                        type="button"
                                        aria-label={`Hapus keputusan ${index + 1}`}
                                        onClick={() =>
                                            data.removeDecision(index)
                                        }
                                        className={cn(
                                            'hit-area -my-1 rounded-sm p-1 text-text-muted opacity-60 hover:opacity-100',
                                            focusRing,
                                        )}
                                    >
                                        <X aria-hidden className="size-4" />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                    {!data.readOnly && (
                        <span
                            onFocus={() => onFocusPart('decisions')}
                            onBlur={() => onFocusPart(null)}
                        >
                            <AddLine
                                label="Keputusan"
                                placeholder="Tulis keputusan rapat"
                                onAdd={data.addDecision}
                                inputRef={decisionInput}
                            />
                        </span>
                    )}
                </section>
            )}

            <section
                id={docAnchor('action-items')}
                aria-labelledby={`${docAnchor('action-items')}-title`}
                className="relative flex scroll-mt-4 flex-col gap-2"
            >
                <h3
                    id={`${docAnchor('action-items')}-title`}
                    className={cn(
                        'mt-1.5 font-bold',
                        compact ? 'text-[17px]' : 'text-[19px]',
                    )}
                >
                    Tindak lanjut
                </h3>
                <PresenceFlags people={presence['action-items']} />
                {minutes.action_items.length === 0 && (
                    <p className="text-[15px] text-text-muted">
                        Belum ada tindak lanjut.
                    </p>
                )}
                <ul className="flex flex-col gap-2">
                    {minutes.action_items.map((item) => (
                        <ActionChip
                            key={item.id}
                            item={item}
                            data={data}
                            people={participants}
                            nameOf={(id) =>
                                id === data.me
                                    ? 'Anda'
                                    : id
                                      ? firstName(
                                            known.get(id)?.name ?? 'Peserta',
                                        )
                                      : 'Tanpa PIC'
                            }
                            editing={editingItem === item.id}
                            onEdit={(open) =>
                                setEditingItem(open ? item.id : null)
                            }
                        />
                    ))}
                </ul>
                {!data.readOnly && variant !== 'sheet' && (
                    <Button
                        variant="quiet"
                        size="sm"
                        className="self-start"
                        onClick={data.addItem}
                    >
                        <Plus aria-hidden />
                        Tindak lanjut
                    </Button>
                )}
            </section>
            {quickAdd && !data.readOnly && (
                <QuickAdd
                    onDecision={
                        collabBody ? null : () => decisionInput.current?.focus()
                    }
                    onTask={data.addItem}
                    onPoint={collabBody ? null : addPoint}
                />
            )}
        </article>
    );
}

/** Phone "+ Keputusan · + Tugas · + Poin" row under the document. */
function QuickAdd({
    onDecision,
    onTask,
    onPoint,
}: {
    /** null in collab mode: decisions and points are typed in the text. */
    onDecision: (() => void) | null;
    onTask: () => void;
    onPoint: (() => void) | null;
}) {
    const keys: [string, () => void][] = [];

    if (onDecision) {
        keys.push(['Keputusan', onDecision]);
    }

    keys.push(['Tugas', onTask]);

    if (onPoint) {
        keys.push(['Poin', onPoint]);
    }

    return (
        <div className="flex gap-2 pt-2">
            {keys.map(([label, onClick]) => (
                <Button
                    key={label}
                    variant="secondary"
                    className="h-12 flex-1 rounded-control text-[16px]"
                    onClick={onClick}
                >
                    + {label}
                </Button>
            ))}
        </div>
    );
}
