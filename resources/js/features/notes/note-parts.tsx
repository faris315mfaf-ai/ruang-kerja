import { Link } from '@inertiajs/react';
import {
    AlertTriangle,
    Check,
    ChevronRight,
    Cloud,
    CloudCog,
    CloudOff,
    Eye,
    X,
} from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { cn, focusRing } from '@/lib/utils';
import { notes as workspaceNotes } from '@/routes/workspaces';
import { cursorTone } from './cursor-tones';
import { ancestors, savePhase, type SavePhase } from './lib';
import type { NotePerson } from './types';
import type { NoteSession } from './use-note-session';

/** Everything the combined save/Presence icon and its detail popover need. */
export type SaveStatusState = {
    phase: SavePhase;
    /** "Tersimpan · 2 dtk lalu · Tersambung · 3 orang". */
    label: string;
    status: string;
    presence: string | null;
    conflict: boolean;
    editors: (NotePerson & { tone: number })[];
};

/** Derive the icon state from the session (labels come from the session). */
export function saveStatusState(session: NoteSession): SaveStatusState {
    return {
        phase: savePhase({
            conflict: session.conflict,
            mode: session.mode,
            saving: session.saving,
            connected: session.connected,
        }),
        label: [session.status, session.presence].filter(Boolean).join(' · '),
        status: session.status,
        presence: session.presence,
        conflict: session.conflict,
        editors: session.collaborators,
    };
}

/**
 * One compact save/Presence icon (keputusan pemilik 9 Okt 2026): spinning
 * cloud while saving/connecting, green check-cloud once saved on a live
 * connection, warning triangle for offline mode and conflicts.
 */
export function SaveStatusIcon({
    phase,
    className,
}: {
    phase: SavePhase;
    className?: string;
}) {
    if (phase === 'conflict' || phase === 'offline') {
        return (
            <AlertTriangle
                aria-hidden
                className={cn(
                    'size-5 shrink-0',
                    phase === 'conflict' ? 'text-warning' : 'text-text-muted',
                    className,
                )}
            />
        );
    }

    if (phase === 'syncing') {
        return (
            <CloudCog
                aria-hidden
                className={cn(
                    'size-5 shrink-0 animate-spin text-text-muted motion-reduce:animate-none',
                    className,
                )}
            />
        );
    }

    return (
        <span
            aria-hidden
            className={cn(
                'relative flex shrink-0 items-center justify-center',
                className,
            )}
        >
            <Cloud className="size-5 text-success" />
            <Check className="absolute right-[-3px] bottom-[-2px] size-3 stroke-[3.5] text-success" />
        </span>
    );
}

/**
 * Body of the status detail (phone bottom sheet / desktop popover): the full
 * save line, the connection line and the co-editors with their caret colour.
 * `reloadAction` is the caller's "Muat ulang" control, shown on a conflict.
 */
export function SaveStatusDetail({
    state,
    reloadAction,
}: {
    state: SaveStatusState;
    reloadAction?: ReactNode;
}) {
    return (
        <div role="status" className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-text">
                <SaveStatusIcon phase={state.phase} />
                {state.status}
            </p>
            {state.presence && (
                <p className="text-[14px] text-text-muted">{state.presence}</p>
            )}
            {state.phase === 'offline' && (
                <p className="text-[14px] text-text-muted">
                    Penyuntingan bersama tidak aktif; perubahan tetap disimpan
                    otomatis.
                </p>
            )}
            {state.editors.length > 0 && (
                <div>
                    <p className="pb-1.5 text-[13px] font-bold tracking-[.06em] text-text-muted uppercase">
                        Penyunting lain
                    </p>
                    <ul className="flex flex-col gap-2">
                        {state.editors.map((person) => (
                            <li
                                key={person.id}
                                className="flex items-center gap-2.5 text-[15px] text-text"
                            >
                                <UserAvatar
                                    name={person.name}
                                    src={person.avatar}
                                    className={cn(
                                        'size-8 text-[12px] ring-2 ring-offset-2 ring-offset-surface',
                                        cursorTone(person.tone).ring,
                                    )}
                                />
                                <span className="truncate">{person.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {state.conflict && reloadAction}
        </div>
    );
}

/** One dismissible slim banner row: icon + short text (+ action). */
function SlimBanner({
    tone,
    icon,
    children,
    onClose,
    role,
}: {
    tone: 'muted' | 'info' | 'warning';
    icon: ReactNode;
    children: ReactNode;
    onClose: () => void;
    role?: 'status' | 'alert';
}) {
    return (
        <div
            role={role}
            className={cn(
                'flex items-center gap-2 rounded-lg px-3 py-2 text-[13px]',
                tone === 'muted' && 'bg-surface-2 text-text-muted',
                tone === 'info' && 'bg-info-soft text-info',
                tone === 'warning' && 'bg-warning-soft text-warning',
            )}
        >
            <span
                aria-hidden
                className="flex size-5 shrink-0 items-center justify-center"
            >
                {icon}
            </span>
            <span className="min-w-0 flex-1">{children}</span>
            <button
                type="button"
                aria-label="Tutup pemberitahuan"
                onClick={onClose}
                className={cn(
                    '-my-2 flex size-11 shrink-0 items-center justify-center rounded-full transition-opacity duration-120 ease-brand hover:opacity-60',
                    focusRing,
                )}
            >
                <X className="size-4" aria-hidden />
            </button>
        </div>
    );
}

/**
 * Slim one-line banners above the editor (read-only, save without
 * collaboration, conflict). Each can be dismissed for this visit.
 */
export function NoteBanners({
    session,
    className,
}: {
    session: NoteSession;
    className?: string;
}) {
    const [closed, setClosed] = useState({
        read: false,
        offline: false,
        conflict: false,
    });

    // A conflict banner dismissed earlier returns with the next conflict.
    useEffect(() => {
        if (!session.conflict) {
            setClosed((state) =>
                state.conflict ? { ...state, conflict: false } : state,
            );
        }
    }, [session.conflict]);

    const items = [];

    if (!session.note.can_edit && !closed.read) {
        items.push(
            <SlimBanner
                key="read"
                tone="muted"
                role="status"
                icon={<Eye className="size-4" />}
                onClose={() => setClosed((state) => ({ ...state, read: true }))}
            >
                Baca-saja — Anda tidak dapat mengubah catatan ini.
            </SlimBanner>,
        );
    }

    if (
        session.mode === 'offline' &&
        session.note.can_edit &&
        !closed.offline
    ) {
        items.push(
            <SlimBanner
                key="offline"
                tone="info"
                role="status"
                icon={<CloudOff className="size-4" />}
                onClose={() =>
                    setClosed((state) => ({ ...state, offline: true }))
                }
            >
                Mode tanpa kolaborasi — perubahan tetap tersimpan otomatis.
            </SlimBanner>,
        );
    }

    if (session.conflict && !closed.conflict) {
        items.push(
            <SlimBanner
                key="conflict"
                tone="warning"
                role="alert"
                icon={<AlertTriangle className="size-4" />}
                onClose={() =>
                    setClosed((state) => ({ ...state, conflict: true }))
                }
            >
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1">
                        Catatan diubah orang lain — muat ulang untuk versi
                        terbaru.
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3"
                        onClick={session.reload}
                    >
                        Muat ulang
                    </Button>
                </span>
            </SlimBanner>,
        );
    }

    return items.length > 0 ? (
        <div className={cn('flex flex-col gap-2', className)}>{items}</div>
    ) : null;
}

/** Workspace › parent folders/notes. `compact`: one short line for headers. */
export function NotePath({
    session,
    compact = false,
    className,
}: {
    session: NoteSession;
    compact?: boolean;
    className?: string;
}) {
    const full = ancestors(session.props.notes, session.note.id);
    const path = compact ? full.slice(-1) : full;
    const workspace = session.props.workspaces.find(
        (item) => item.id === session.note.workspace_id,
    );

    return (
        <nav
            aria-label="Lokasi catatan"
            className={cn('min-w-0', className)}
            title={
                compact
                    ? [
                          workspace?.name ?? 'Catatan',
                          ...full.map((item) => item.title),
                      ].join(' › ')
                    : undefined
            }
        >
            <ol
                className={cn(
                    'flex min-w-0 items-center gap-1 text-[14px] text-text-muted',
                    compact && 'text-[13px]',
                )}
            >
                <li className="min-w-0 shrink-0">
                    <Link
                        href={
                            session.note.workspace_key
                                ? workspaceNotes.url(session.note.workspace_key)
                                : '/catatan'
                        }
                        className={cn(
                            'block truncate rounded-xs hover:text-text',
                            focusRing,
                            compact && 'max-w-[160px]',
                        )}
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
