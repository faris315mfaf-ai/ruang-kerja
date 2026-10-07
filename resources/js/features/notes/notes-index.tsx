import { Link, router } from '@inertiajs/react';
import { FolderPlus, NotebookPen, Plus, Search, SearchX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ListRow } from '@/components/ui/list-row';
import { Panel } from '@/components/ui/panel';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { formatRelative } from '@/lib/format';
import { paletteGradient } from '@/lib/palette';
import { cn } from '@/lib/utils';
import notesRoutes from '@/routes/notes';
import { notes as workspaceNotes } from '@/routes/workspaces';
import { buildTree } from './lib';
import { NoteTree } from './note-tree';
import { useTreeActions } from './tree-actions';
import type { NotesIndexProps, NoteWorkspace } from './types';

const ALL = 'semua';
const SEARCH_DELAY = 300;

function WorkspaceTile({ workspace }: { workspace: NoteWorkspace }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-extrabold text-on-brand',
                workspace.type === 'personal'
                    ? 'bg-grad-slate'
                    : paletteGradient(workspace.color),
            )}
        >
            {workspace.type === 'personal' ? 'P' : workspace.key}
        </span>
    );
}

/**
 * /catatan: folders and notes per workspace as trees, full-text search on
 * the server (?q=), workspace filter, recently changed notes.
 */
export function NotesIndex({
    props,
    mobile,
}: {
    props: NotesIndexProps;
    mobile: boolean;
}) {
    const [query, setQuery] = useState(props.query);
    const [searching, setSearching] = useState(false);
    const [workspaceId, setWorkspaceId] = useState(ALL);
    const timer = useRef<number | undefined>(undefined);
    const actions = useTreeActions({
        notes: props.notes,
        workspaces: props.workspaces,
        mobile,
    });
    const notes = actions.rows;
    const matches = props.matches === null ? null : new Set(props.matches);
    const writable = props.workspaces.filter((item) => item.can_create);

    useEffect(() => () => window.clearTimeout(timer.current), []);

    const search = (value: string) => {
        setQuery(value);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
            router.get(
                notesRoutes.index.url(),
                value.trim() === '' ? {} : { q: value.trim() },
                {
                    only: ['notes'],
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    onStart: () => setSearching(true),
                    onFinish: () => setSearching(false),
                },
            );
        }, SEARCH_DELAY);
    };

    const sections = props.workspaces
        .filter((item) => workspaceId === ALL || item.id === workspaceId)
        .map((workspace) => ({
            workspace,
            notes: notes.filter((note) => note.workspace_id === workspace.id),
        }))
        .filter(
            (section) =>
                section.notes.length > 0 &&
                buildTree(section.notes, matches).length > 0,
        );
    const recent = notes
        .filter((note) => note.kind === 'note')
        .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))
        .slice(0, 5);
    const now = new Date();
    const defaultWorkspace =
        workspaceId === ALL
            ? undefined
            : writable.find((item) => item.id === workspaceId)?.id;

    const searchBox = (
        <label className={cn('relative block', !mobile && 'w-full max-w-sm')}>
            <span className="sr-only">Cari catatan</span>
            <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-text-subtle"
            />
            <Input
                type="search"
                value={query}
                onChange={(event) => search(event.target.value)}
                placeholder="Cari judul atau isi catatan"
                aria-busy={searching}
                className={cn('pl-10', mobile && 'h-12 rounded-lg')}
            />
        </label>
    );

    let content;

    if (props.notes.length === 0) {
        content = (
            <EmptyState
                icon={NotebookPen}
                title="Belum ada catatan"
                description="Tulis SOP, wiki tim, atau notulen ringan yang bisa diedit bersama. Mulai dari workspace Pribadi untuk catatan Anda sendiri."
                action={
                    writable.length > 0 ? (
                        <Button
                            onClick={() =>
                                actions.openNew({
                                    kind: 'note',
                                    workspaceId: defaultWorkspace,
                                })
                            }
                        >
                            <Plus aria-hidden />
                            Catatan baru
                        </Button>
                    ) : undefined
                }
            />
        );
    } else if (sections.length === 0) {
        content = (
            <EmptyState
                icon={SearchX}
                size="sm"
                title="Tidak ada catatan yang cocok"
                description={
                    props.query
                        ? `Tidak ada judul atau isi yang memuat “${props.query}”.`
                        : 'Workspace ini belum punya catatan.'
                }
                action={
                    props.query ? (
                        <Button variant="outline" onClick={() => search('')}>
                            Hapus pencarian
                        </Button>
                    ) : undefined
                }
            />
        );
    } else {
        content = (
            <div className="flex flex-col gap-5">
                {sections.map(({ workspace, notes: items }) => (
                    <Panel
                        key={workspace.id}
                        flush
                        title={
                            <Link
                                href={workspaceNotes.url(workspace.key)}
                                className="flex min-w-0 items-center gap-3 hover:underline"
                            >
                                <WorkspaceTile workspace={workspace} />
                                <span className="truncate">
                                    {workspace.name}
                                </span>
                            </Link>
                        }
                        action={
                            <span className="text-[15px] text-text-muted tnum">
                                {
                                    items.filter((item) => item.kind === 'note')
                                        .length
                                }{' '}
                                catatan
                            </span>
                        }
                        bodyClassName={cn(mobile ? 'px-2' : 'px-4')}
                    >
                        <NoteTree
                            notes={items}
                            matches={matches}
                            people={props.people}
                            mobile={mobile}
                            onAction={
                                workspace.can_create
                                    ? actions.onAction
                                    : undefined
                            }
                        />
                    </Panel>
                ))}
            </div>
        );
    }

    const showAside = !mobile && recent.length > 0 && props.matches === null;

    return (
        <div className="flex flex-col gap-5">
            {!mobile && (
                <section className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-h1 text-text lg:text-display">
                            Catatan
                        </h1>
                        <p className="text-body-lg text-text-muted">
                            Wiki, SOP, dan notulen ringan yang diedit bersama ·{' '}
                            <span className="tnum">
                                {
                                    props.notes.filter(
                                        (note) => note.kind === 'note',
                                    ).length
                                }
                            </span>{' '}
                            catatan
                        </p>
                    </div>
                    {writable.length > 0 && (
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={() =>
                                    actions.openNew({
                                        kind: 'folder',
                                        workspaceId: defaultWorkspace,
                                    })
                                }
                            >
                                <FolderPlus aria-hidden />
                                Folder baru
                            </Button>
                            <Button
                                onClick={() =>
                                    actions.openNew({
                                        kind: 'note',
                                        workspaceId: defaultWorkspace,
                                    })
                                }
                            >
                                <Plus aria-hidden />
                                Catatan baru
                            </Button>
                        </div>
                    )}
                </section>
            )}
            {props.notes.length > 0 && (
                <div
                    className={cn(
                        'flex gap-3',
                        mobile ? 'flex-col' : 'flex-wrap items-center',
                    )}
                >
                    {searchBox}
                    {mobile ? (
                        <ChipScroller
                            label="Workspace"
                            value={workspaceId}
                            onChange={setWorkspaceId}
                            chips={[
                                { value: ALL, label: 'Semua' },
                                ...props.workspaces.map((workspace) => ({
                                    value: workspace.id,
                                    label:
                                        workspace.type === 'personal'
                                            ? 'Pribadi'
                                            : workspace.key,
                                    count: notes.filter(
                                        (note) =>
                                            note.workspace_id ===
                                                workspace.id &&
                                            note.kind === 'note',
                                    ).length,
                                })),
                            ]}
                        />
                    ) : (
                        <Select
                            value={workspaceId}
                            onValueChange={setWorkspaceId}
                        >
                            <SelectTrigger
                                aria-label="Filter workspace"
                                className="w-64"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>
                                    Semua workspace
                                </SelectItem>
                                {props.workspaces.map((workspace) => (
                                    <SelectItem
                                        key={workspace.id}
                                        value={workspace.id}
                                    >
                                        {workspace.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            )}

            <div
                className={cn(
                    'grid items-start gap-5',
                    showAside && 'xl:grid-cols-[minmax(0,1fr)_360px]',
                )}
            >
                <div className="min-w-0">{content}</div>
                {showAside && (
                    <Panel title="Baru diubah" flush>
                        <ul className="divide-y divide-divider">
                            {recent.map((note) => {
                                const author = props.people.find(
                                    (person) => person.id === note.updated_by,
                                );

                                return (
                                    <li key={note.id}>
                                        <ListRow
                                            href={`/catatan/${note.id}`}
                                            title={note.title}
                                            meta={`${author?.name.split(' ')[0] ?? ''} · ${formatRelative(note.updated_at, now)}`}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </Panel>
                )}
            </div>

            {mobile && writable.length > 0 && (
                <Fab
                    label="Catatan baru"
                    onClick={() =>
                        actions.openNew({
                            kind: 'note',
                            workspaceId: defaultWorkspace,
                        })
                    }
                />
            )}
            {actions.dialogs}
        </div>
    );
}
