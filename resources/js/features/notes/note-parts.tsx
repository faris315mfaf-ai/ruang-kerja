import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    ChevronRight,
    CloudOff,
    Eye,
    Loader2,
    Radio,
} from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { cn, focusRing } from '@/lib/utils';
import { notes as workspaceNotes } from '@/routes/workspaces';
import { cursorTone } from './cursor-tones';
import { ancestors, editorsLabel } from './lib';
import type { NoteSession } from './use-note-session';

/** Co-editors with a ring in their caret colour + "Tersambung · 3 orang". */
export function EditorsPresence({
    session,
    compact = false,
}: {
    session: NoteSession;
    compact?: boolean;
}) {
    const people = session.collaborators;

    if (session.presence === null) {
        return null;
    }

    const names = editorsLabel(people.map((person) => person.name));

    return (
        <div className="flex min-w-0 items-center gap-2">
            {people.length > 0 && (
                <span className="flex shrink-0 items-center -space-x-1.5">
                    {people.slice(0, 4).map((person) => (
                        <UserAvatar
                            key={person.id}
                            name={person.name}
                            src={person.avatar}
                            className={cn(
                                'size-8 text-[12px] ring-2 ring-offset-2 ring-offset-surface',
                                cursorTone(person.tone).ring,
                            )}
                        />
                    ))}
                </span>
            )}
            <span
                className={cn(
                    'flex items-center gap-1.5 truncate text-[14px] text-text-muted',
                    compact && people.length > 0 && 'sr-only',
                )}
                aria-live="polite"
            >
                <Radio aria-hidden className="size-4 shrink-0 text-success" />
                {session.presence}
                {names && <span className="sr-only">, {names}</span>}
            </span>
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
            {session.saving || session.mode === 'connecting' ? (
                <Loader2
                    aria-hidden
                    className="size-4 animate-spin motion-reduce:animate-none"
                />
            ) : session.conflict ? (
                <AlertTriangle aria-hidden className="size-4 text-warning" />
            ) : (
                <Check aria-hidden className="size-4 text-success" />
            )}
            {session.status}
        </p>
    );
}

/** Banners under the header: read-only, save without collaboration, conflict. */
export function NoteBanners({
    session,
    className,
}: {
    session: NoteSession;
    className?: string;
}) {
    const items = [];

    if (!session.note.can_edit) {
        items.push(
            <p
                key="read"
                className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3 text-[15px] text-text-muted"
            >
                <Eye className="size-5 shrink-0" aria-hidden />
                Anda hanya dapat membaca catatan ini.
            </p>,
        );
    }

    if (session.mode === 'offline' && session.note.can_edit) {
        items.push(
            <p
                key="offline"
                role="status"
                className="flex items-start gap-2 rounded-lg bg-info-soft px-4 py-3 text-[15px] text-info"
            >
                <CloudOff className="mt-0.5 size-5 shrink-0" aria-hidden />
                <span>
                    <strong className="font-semibold">
                        Mode tanpa kolaborasi.
                    </strong>{' '}
                    {session.props.collab
                        ? 'Server penyuntingan bersama tidak terjangkau; perubahan Anda tetap disimpan otomatis, tetapi orang lain baru melihatnya setelah memuat ulang.'
                        : 'Penyuntingan bersama belum diaktifkan di server ini; perubahan Anda tetap disimpan otomatis.'}
                </span>
            </p>,
        );
    }

    if (session.conflict) {
        items.push(
            <div
                key="conflict"
                role="alert"
                className="flex flex-wrap items-center gap-3 rounded-lg bg-warning-soft px-4 py-3 text-[15px] text-warning"
            >
                <AlertTriangle className="size-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                    Catatan ini baru diubah orang lain. Muat ulang untuk melihat
                    versi terbaru; salin dulu tulisan Anda bila perlu.
                </span>
                <Button size="sm" variant="outline" onClick={session.reload}>
                    Muat ulang
                </Button>
            </div>,
        );
    }

    return items.length > 0 ? (
        <div className={cn('flex flex-col gap-2', className)}>{items}</div>
    ) : null;
}

/** Workspace › parent folders/notes. */
export function NotePath({ session }: { session: NoteSession }) {
    const path = ancestors(session.props.notes, session.note.id);
    const workspace = session.props.workspaces.find(
        (item) => item.id === session.note.workspace_id,
    );

    return (
        <nav aria-label="Lokasi catatan" className="min-w-0">
            <ol className="flex min-w-0 items-center gap-1 text-[14px] text-text-muted">
                <li className="shrink-0 font-semibold">
                    <Link
                        href={
                            session.note.workspace_key
                                ? workspaceNotes.url(session.note.workspace_key)
                                : '/catatan'
                        }
                        className={cn('rounded-xs hover:text-text', focusRing)}
                    >
                        {workspace?.name ?? 'Catatan'}
                    </Link>
                </li>
                {path.map((item) => (
                    <li
                        key={item.id}
                        className="flex min-w-0 items-center gap-1"
                    >
                        <ChevronRight aria-hidden className="size-4 shrink-0" />
                        {item.kind === 'folder' ? (
                            <span className="truncate">{item.title}</span>
                        ) : (
                            <Link
                                href={`/catatan/${item.id}`}
                                className={cn(
                                    'truncate rounded-xs hover:text-text',
                                    focusRing,
                                )}
                            >
                                {item.title}
                            </Link>
                        )}
                    </li>
                ))}
            </ol>
        </nav>
    );
}

/** Id of the title field ("Ganti nama" of the open tab focuses it). */
export const TITLE_FIELD_ID = 'note-title-field';

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
    }, [size]);

    return (
        <textarea
            ref={field}
            id={TITLE_FIELD_ID}
            rows={1}
            value={session.title}
            readOnly={!session.note.can_edit}
            maxLength={200}
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
