import { Link } from '@inertiajs/react';
import {
    ChevronRight,
    FilePlus2,
    FileText,
    Folder,
    FolderOpen,
    FolderPlus,
    Lock,
    MoreHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { buildTree, childCounts, flattenTree } from './lib';
import type { Note, NotePerson } from './types';

export type TreeAction =
    | 'new-note'
    | 'new-folder'
    | 'rename'
    | 'move'
    | 'delete';

type Props = {
    notes: Note[];
    /** Server search results (ids), null = everything. */
    matches?: ReadonlySet<string> | null;
    activeId?: string | null;
    people: NotePerson[];
    /** Sidebar of the editor: one line per row, no meta, no menu. */
    compact?: boolean;
    mobile?: boolean;
    /** Row menu (Catatan baru di sini, Ganti nama, Pindahkan, Hapus). */
    onAction?: (action: TreeAction, note: Note) => void;
};

/**
 * Folders and notes of one workspace as an expandable tree (folders above
 * notes). A folder toggles open, a note opens the editor. While searching
 * every branch with a match is open.
 */
export function NoteTree({
    notes,
    matches = null,
    activeId = null,
    people,
    compact = false,
    mobile = false,
    onAction,
}: Props) {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    const tree = buildTree(notes, matches);
    const searching = matches !== null;
    const rows = flattenTree(tree, searching ? new Set() : collapsed);
    const counts = childCounts(notes);
    const now = new Date();

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

    const rowHeight = compact
        ? 'min-h-10'
        : mobile
          ? 'min-h-[60px] py-2'
          : 'min-h-14 py-2';

    return (
        <ul aria-label="Catatan" className="flex flex-col">
            {rows.map(({ note, depth, children }) => {
                const open = searching || !collapsed.has(note.id);
                const folder = note.kind === 'folder';
                const author = people.find(
                    (person) => person.id === note.updated_by,
                );
                const active = note.id === activeId;
                const Icon = folder ? (open ? FolderOpen : Folder) : FileText;
                const count = counts.get(note.id) ?? 0;
                const label = (
                    <>
                        <Icon
                            aria-hidden
                            className={cn(
                                'shrink-0',
                                compact ? 'size-4' : 'size-5',
                                active
                                    ? 'text-link'
                                    : folder
                                      ? 'text-info'
                                      : 'text-text-muted',
                            )}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <span
                                className={cn(
                                    'flex min-w-0 items-center gap-1.5 font-semibold',
                                    compact
                                        ? 'text-[15px]'
                                        : mobile
                                          ? 'text-[17px]'
                                          : 'text-[16px]',
                                    active ? 'text-link' : 'text-text',
                                )}
                            >
                                <span className="truncate">{note.title}</span>
                                {note.access === 'restricted' && (
                                    <Lock
                                        aria-label="Hanya diundang"
                                        className="size-3.5 shrink-0 text-text-muted"
                                    />
                                )}
                            </span>
                            {!compact && (
                                <span className="truncate text-[14px] text-text-muted">
                                    {folder
                                        ? count === 0
                                            ? 'Folder kosong'
                                            : `${count} item`
                                        : `Diubah ${formatRelative(note.updated_at, now)}${author ? ` · ${author.name.split(' ')[0]}` : ''}`}
                                </span>
                            )}
                        </span>
                    </>
                );
                const rowClass = cn(
                    'flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 text-left transition-colors duration-120 ease-brand',
                    rowHeight,
                    active ? 'bg-link-soft text-link' : 'hover:bg-surface-2',
                    focusRing,
                );

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
                        {children.length > 0 && !folder ? (
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
                                    compact ? 'w-2' : 'w-3',
                                )}
                            />
                        )}
                        {folder ? (
                            <button
                                type="button"
                                onClick={() => toggle(note.id)}
                                aria-expanded={open}
                                className={rowClass}
                            >
                                {label}
                            </button>
                        ) : (
                            <Link
                                href={`/catatan/${note.id}`}
                                aria-current={active ? 'page' : undefined}
                                className={rowClass}
                            >
                                {label}
                            </Link>
                        )}
                        {onAction && !compact && (
                            <RowMenu note={note} onAction={onAction} />
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

function RowMenu({
    note,
    onAction,
}: {
    note: Note;
    onAction: (action: TreeAction, note: Note) => void;
}) {
    const folder = note.kind === 'folder';

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Aksi ${note.title}`}
                    className="shrink-0 text-text-muted"
                >
                    <MoreHorizontal aria-hidden />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {folder && (
                    <>
                        <DropdownMenuItem
                            onSelect={() => onAction('new-note', note)}
                        >
                            <FilePlus2 aria-hidden />
                            Catatan baru di sini
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onSelect={() => onAction('new-folder', note)}
                        >
                            <FolderPlus aria-hidden />
                            Folder baru di sini
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                    </>
                )}
                <DropdownMenuItem onSelect={() => onAction('rename', note)}>
                    Ganti nama
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onAction('move', note)}>
                    Pindahkan
                </DropdownMenuItem>
                <DropdownMenuItem
                    className="text-danger"
                    onSelect={() => onAction('delete', note)}
                >
                    Hapus
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
