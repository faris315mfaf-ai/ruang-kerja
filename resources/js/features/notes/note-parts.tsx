import { Link } from '@inertiajs/react';
import { Check, ChevronRight, Loader2 } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { cn, focusRing } from '@/lib/utils';
import { CURSOR_TONES } from './collab-cursors';
import { ancestors, editorsLabel } from './lib';
import type { NoteSession } from './use-note-session';
import type { NotesState } from './types';

/** Co-editors with a ring in their cursor colour + "Hana dan Dewi sedang menyunting". */
export function EditorsPresence({
    session,
    compact = false,
}: {
    session: NoteSession;
    compact?: boolean;
}) {
    const people = session.collaborators;
    const label = editorsLabel(people.map((person) => person.name));

    if (!label) {
        return null;
    }

    return (
        <div className="flex min-w-0 items-center gap-2">
            <span className="flex shrink-0 items-center -space-x-1.5">
                {people.map((person, seat) => (
                    <UserAvatar
                        key={person.id}
                        name={person.name}
                        src={person.avatar}
                        className={cn(
                            'size-8 text-[12px] ring-2 ring-offset-2 ring-offset-surface',
                            CURSOR_TONES[seat % CURSOR_TONES.length].ring,
                        )}
                    />
                ))}
            </span>
            {!compact && (
                <span className="truncate text-[14px] text-text-muted">
                    {label}
                </span>
            )}
            {compact && <span className="sr-only">{label}</span>}
        </div>
    );
}

/** "Tersimpan · 2 dtk lalu" with a check (spinner while saving). */
export function SaveStatus({ session }: { session: NoteSession }) {
    return (
        <p
            aria-live="polite"
            className="flex items-center gap-1.5 text-[14px] whitespace-nowrap text-text-muted tnum"
        >
            {session.saving ? (
                <Loader2
                    aria-hidden
                    className="size-4 animate-spin motion-reduce:animate-none"
                />
            ) : (
                <Check aria-hidden className="size-4 text-success" />
            )}
            {session.status}
        </p>
    );
}

/** Workspace › parent pages. */
export function NotePath({
    session,
    state,
}: {
    session: NoteSession;
    state: NotesState;
}) {
    if (!session.note) {
        return null;
    }

    const path = ancestors(state.notes, session.note.id);

    return (
        <nav aria-label="Lokasi catatan" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1 text-[14px] text-text-muted">
                <li className="shrink-0 font-semibold">
                    <Link
                        href="/catatan"
                        className={cn('rounded-xs hover:text-text', focusRing)}
                    >
                        {session.workspace?.name ?? 'Catatan'}
                    </Link>
                </li>
                {path.map((item) => (
                    <li
                        key={item.id}
                        className="flex min-w-0 items-center gap-1"
                    >
                        <ChevronRight aria-hidden className="size-4 shrink-0" />
                        <Link
                            href={`/catatan/${item.id}`}
                            className={cn(
                                'truncate rounded-xs hover:text-text',
                                focusRing,
                            )}
                        >
                            {item.title}
                        </Link>
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/** Large title field; Enter jumps into the body. */
export function TitleField({
    session,
    size,
    className,
}: {
    session: NoteSession;
    /** Font size in px; set inline because phones force 17px on fields. */
    size: number;
    className?: string;
}) {
    const field = useRef<HTMLTextAreaElement>(null);

    useLayoutEffect(() => {
        field.current?.style.setProperty('font-size', `${size}px`, 'important');
        field.current?.style.setProperty('line-height', '1.25');
    }, [size, session.note]);

    if (!session.note) {
        return null;
    }

    return (
        <textarea
            ref={field}
            rows={1}
            value={session.note.title}
            readOnly={!session.editable}
            aria-label="Judul catatan"
            placeholder="Tanpa judul"
            onChange={(event) =>
                session.setTitle(event.target.value.replace(/\n/g, ' '))
            }
            onKeyDown={(event) => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    session.focusBody();
                }
            }}
            className={cn(
                'field-sizing-content w-full resize-none bg-transparent font-bold tracking-[-0.02em] text-text outline-none placeholder:text-text-subtle',
                className,
            )}
        />
    );
}
