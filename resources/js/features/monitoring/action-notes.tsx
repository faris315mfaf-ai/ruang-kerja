import {
    ArrowDown,
    ArrowUp,
    CalendarDays,
    ListTodo,
    Plus,
    Trash2,
} from 'lucide-react';
import { useId, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DateInput } from '@/components/ui/date-input';
import { Input } from '@/components/ui/input';
import { Panel } from '@/components/ui/panel';
import { formatDate } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import type { ActionNote } from './types';
import { useActionNotes } from './use-action-notes';

const MAX = 500;

function NoteRow({
    note,
    first,
    last,
    onToggle,
    onSave,
    onRemove,
    onMove,
}: {
    note: ActionNote;
    first: boolean;
    last: boolean;
    onToggle: (done: boolean) => void;
    onSave: (body: string) => void;
    onRemove: () => void;
    onMove: (direction: -1 | 1) => void;
}) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(note.body);
    const id = useId();

    const save = () => {
        const body = draft.trim();
        setEditing(false);

        if (body !== '' && body !== note.body) {
            onSave(body);
        } else {
            setDraft(note.body);
        }
    };

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            save();
        }

        if (event.key === 'Escape') {
            setDraft(note.body);
            setEditing(false);
        }
    };

    return (
        <li className="group flex min-h-14 items-start gap-3 border-t border-divider py-3 first:border-t-0">
            <Checkbox
                id={id}
                checked={note.done}
                onCheckedChange={(value) => onToggle(value === true)}
                aria-label={
                    note.done
                        ? `Tandai belum selesai: ${note.body}`
                        : `Tandai selesai: ${note.body}`
                }
                className="mt-0.5"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
                {editing ? (
                    <Input
                        autoFocus
                        value={draft}
                        maxLength={MAX}
                        onChange={(event) => setDraft(event.target.value)}
                        onBlur={save}
                        onKeyDown={onKeyDown}
                        aria-label="Ubah catatan"
                        className="h-control-sm"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            setDraft(note.body);
                            setEditing(true);
                        }}
                        className={cn(
                            'rounded-sm text-left text-[16px] leading-6 break-words',
                            note.done
                                ? 'text-text-muted line-through'
                                : 'text-text',
                            focusRing,
                        )}
                        aria-label={`Ubah catatan: ${note.body}`}
                    >
                        {note.body}
                    </button>
                )}
                {note.due_on && (
                    <span
                        className={cn(
                            'inline-flex items-center gap-1.5 text-meta',
                            note.overdue
                                ? 'font-semibold text-danger'
                                : 'text-text-muted',
                        )}
                    >
                        <CalendarDays className="size-3.5" aria-hidden />
                        {note.overdue ? 'Lewat tenggat · ' : 'Tenggat · '}
                        {formatDate(note.due_on)}
                    </span>
                )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
                {!note.done && (
                    <>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={first}
                            onClick={() => onMove(-1)}
                            aria-label={`Naikkan: ${note.body}`}
                        >
                            <ArrowUp aria-hidden />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={last}
                            onClick={() => onMove(1)}
                            aria-label={`Turunkan: ${note.body}`}
                        >
                            <ArrowDown aria-hidden />
                        </Button>
                    </>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label={`Hapus: ${note.body}`}
                    className="text-text-muted hover:text-danger"
                >
                    <Trash2 aria-hidden />
                </Button>
            </div>
        </li>
    );
}

/**
 * "Catatan tindakan" (keputusan pemilik 6 Okt 2026): what the Direktur /
 * management still has to do — a private list (only the owner sees it) on
 * the Direksi dashboard and /manajemen. Add with Enter, tick to finish,
 * click the text to edit, arrows to reorder, optional due date.
 */
export function ActionNotes({
    notes: initial,
    today,
    className,
    compact = false,
}: {
    notes: ActionNote[];
    today: string;
    className?: string;
    compact?: boolean;
}) {
    const { notes, add, update, toggle, remove, move } = useActionNotes(
        initial,
        today,
    );
    const [body, setBody] = useState('');
    const [due, setDue] = useState('');
    const [busy, setBusy] = useState(false);
    const open = notes.filter((note) => !note.done);
    const done = notes.filter((note) => note.done);
    const inputId = useId();
    const dueId = useId();

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        const text = body.trim();

        if (text === '' || busy) {
            return;
        }

        setBusy(true);

        if (await add(text, due === '' ? null : due)) {
            setBody('');
            setDue('');
        }

        setBusy(false);
    };

    return (
        <Panel
            title={
                <>
                    Catatan tindakan
                    {open.length > 0 && (
                        <Badge variant="status" tone="neutral" className="h-7">
                            {open.length}
                        </Badge>
                    )}
                </>
            }
            action={
                <span className="text-meta text-text-muted">
                    hanya terlihat oleh Anda
                </span>
            }
            className={cn(compact && 'py-5', className)}
            bodyClassName="gap-3"
        >
            <form onSubmit={submit} className="flex flex-col gap-2">
                <label htmlFor={inputId} className="sr-only">
                    Catatan tindakan baru
                </label>
                <div className="flex gap-2">
                    <Input
                        id={inputId}
                        value={body}
                        maxLength={MAX}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="Tambah hal yang perlu dilakukan…"
                        className="min-w-0 flex-1"
                    />
                    <Button
                        type="submit"
                        size="icon"
                        disabled={busy || body.trim() === ''}
                        aria-label="Tambah catatan"
                    >
                        <Plus aria-hidden strokeWidth={2.4} />
                    </Button>
                </div>
                <div className="flex items-center gap-2 text-meta text-text-muted">
                    <CalendarDays className="size-4" aria-hidden />
                    <label htmlFor={dueId}>Tenggat (opsional)</label>
                    <DateInput
                        id={dueId}
                        size="sm"
                        value={due}
                        min={today}
                        onChange={setDue}
                        className="w-60"
                    />
                </div>
            </form>
            {notes.length === 0 ? (
                <EmptyState size="sm" icon={ListTodo} title="Belum ada catatan">
                    Tulis keputusan, tindak lanjut, atau hal yang perlu Anda
                    periksa.
                </EmptyState>
            ) : (
                <>
                    <ul aria-label="Catatan terbuka" className="flex flex-col">
                        {open.map((note, index) => (
                            <NoteRow
                                key={note.id}
                                note={note}
                                first={index === 0}
                                last={index === open.length - 1}
                                onToggle={(value) =>
                                    void toggle(note.id, value)
                                }
                                onSave={(text) =>
                                    void update(note.id, { body: text })
                                }
                                onRemove={() => void remove(note.id)}
                                onMove={(direction) =>
                                    void move(note.id, direction)
                                }
                            />
                        ))}
                    </ul>
                    {done.length > 0 && (
                        <details className="group/done">
                            <summary
                                className={cn(
                                    'flex min-h-11 cursor-pointer list-none items-center rounded-control text-label text-text-muted',
                                    focusRing,
                                )}
                            >
                                Selesai ({done.length})
                            </summary>
                            <ul
                                aria-label="Catatan selesai"
                                className="flex flex-col"
                            >
                                {done.map((note) => (
                                    <NoteRow
                                        key={note.id}
                                        note={note}
                                        first
                                        last
                                        onToggle={(value) =>
                                            void toggle(note.id, value)
                                        }
                                        onSave={(text) =>
                                            void update(note.id, { body: text })
                                        }
                                        onRemove={() => void remove(note.id)}
                                        onMove={() => undefined}
                                    />
                                ))}
                            </ul>
                        </details>
                    )}
                </>
            )}
        </Panel>
    );
}
