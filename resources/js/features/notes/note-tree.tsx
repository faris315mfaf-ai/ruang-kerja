import { Link } from '@inertiajs/react';
import { ChevronRight, FileText } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { formatRelative } from '@/lib/format';
import { prototypeNow } from '@/features/chat/lib';
import { cn, focusRing } from '@/lib/utils';
import { buildTree, flattenTree } from './lib';
import type { Note, NotePerson } from './types';

type Props = {
    notes: Note[];
    query?: string;
    activeId?: string | null;
    people: NotePerson[];
    activeEditors: Record<string, string[]>;
    /** Sidebar of the editor: one line per note, no meta. */
    compact?: boolean;
    mobile?: boolean;
};

/**
 * Notes of one workspace as an expandable tree (parent → child pages).
 * While searching every branch with a match is open.
 */
export function NoteTree({
    notes,
    query = '',
    activeId = null,
    people,
    activeEditors,
    compact = false,
    mobile = false,
}: Props) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const tree = buildTree(notes, query);
    const rows = flattenTree(tree, query.trim() !== '' ? new Set() : collapsed);
    const now = prototypeNow();

    const toggle = (id: string) =>
        setCollapsed((current) => {
            const next = new Set(current);

            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }

            return next;
        });

    return (
        <ul aria-label="Catatan" className="flex flex-col">
            {rows.map(({ note, depth, children }) => {
                const open = !collapsed.has(note.id) || query.trim() !== '';
                const editors = (activeEditors[note.id] ?? [])
                    .map((id) => people.find((person) => person.id === id))
                    .filter(
                        (person): person is NotePerson => person !== undefined,
                    );
                const author = people.find(
                    (person) => person.id === note.updated_by,
                );
                const active = note.id === activeId;

                return (
                    <li
                        key={note.id}
                        className={cn(
                            'flex items-center gap-1',
                            !compact &&
                                !mobile &&
                                'border-b border-divider last:border-b-0',
                        )}
                        style={{ paddingLeft: depth * (compact ? 14 : 22) }}
                    >
                        {children.length > 0 ? (
                            <button
                                type="button"
                                onClick={() => toggle(note.id)}
                                aria-expanded={open}
                                aria-label={`Sub-catatan ${note.title}`}
                                className={cn(
                                    'flex shrink-0 items-center justify-center rounded-[9px] text-text-muted hover:bg-surface-2 hover:text-text',
                                    compact ? 'size-8' : 'size-11',
                                    focusRing,
                                )}
                            >
                                <ChevronRight
                                    aria-hidden
                                    className={cn(
                                        'size-4 transition-transform duration-120 ease-brand motion-reduce:transition-none',
                                        open && 'rotate-90',
                                    )}
                                />
                            </button>
                        ) : (
                            <span
                                aria-hidden
                                className={cn(
                                    'shrink-0',
                                    compact ? 'w-8' : 'w-11',
                                )}
                            />
                        )}
                        <Link
                            href={`/catatan/${note.id}`}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 transition-colors duration-120 ease-brand',
                                compact
                                    ? 'min-h-10'
                                    : mobile
                                      ? 'min-h-[60px] py-2'
                                      : 'min-h-14 py-2',
                                active
                                    ? 'bg-link-soft text-link'
                                    : 'hover:bg-surface-2',
                                focusRing,
                            )}
                        >
                            <FileText
                                aria-hidden
                                className={cn(
                                    'shrink-0',
                                    compact ? 'size-4' : 'size-5',
                                    active ? 'text-link' : 'text-text-muted',
                                )}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <span
                                    className={cn(
                                        'truncate font-semibold',
                                        compact
                                            ? 'text-[15px]'
                                            : mobile
                                              ? 'text-[17px]'
                                              : 'text-[16px]',
                                        active ? 'text-link' : 'text-text',
                                    )}
                                >
                                    {note.title}
                                </span>
                                {!compact && (
                                    <span className="truncate text-[14px] text-text-muted">
                                        Diubah{' '}
                                        {formatRelative(note.updated_at, now)}
                                        {author &&
                                            ` · ${author.name.split(' ')[0]}`}
                                    </span>
                                )}
                            </span>
                            {editors.length > 0 && compact && (
                                <span
                                    className="size-2.5 shrink-0 rounded-full bg-fill-teal"
                                    title={`${editors.map((person) => person.name).join(', ')} sedang menyunting`}
                                >
                                    <span className="sr-only">
                                        {editors
                                            .map((person) => person.name)
                                            .join(', ')}{' '}
                                        sedang menyunting
                                    </span>
                                </span>
                            )}
                            {editors.length > 0 && !compact && (
                                <span
                                    className="flex shrink-0 items-center -space-x-1.5"
                                    title={`${editors.map((person) => person.name).join(', ')} sedang menyunting`}
                                >
                                    {editors.slice(0, 3).map((person) => (
                                        <UserAvatar
                                            key={person.id}
                                            name={person.name}
                                            className="size-6 text-[10px] ring-2 ring-surface"
                                        />
                                    ))}
                                    <span className="sr-only">
                                        {editors
                                            .map((person) => person.name)
                                            .join(', ')}{' '}
                                        sedang menyunting
                                    </span>
                                </span>
                            )}
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
