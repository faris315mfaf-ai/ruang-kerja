import { router } from '@inertiajs/react';
import {
    AlertTriangle,
    NotebookPen,
    Plus,
    Search,
    SearchX,
} from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { UserAvatar } from '@/components/shell/user-avatar';
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
import { Skeleton } from '@/components/ui/skeleton';
import { prototypeNow } from '@/features/chat/lib';
import type { PreviewState } from '@/features/chat/preview-state';
import { PreviewBar } from '@/features/chat/preview-state';
import { formatRelative } from '@/lib/format';
import { paletteGradient } from '@/lib/palette';
import { cn } from '@/lib/utils';
import { buildTree, editorsLabel } from './lib';
import { NewNoteDialog } from './new-note-dialog';
import { NoteTree } from './note-tree';
import type { NotesState, NoteWorkspace } from './types';

const ALL = 'semua';

function WorkspaceTile({ workspace }: { workspace: NoteWorkspace }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-9 shrink-0 items-center justify-center rounded-[10px] text-[12px] font-extrabold text-on-brand',
                paletteGradient(workspace.color),
            )}
        >
            {workspace.key}
        </span>
    );
}

function IndexSkeleton() {
    return (
        <div
            aria-busy
            aria-label="Memuat catatan"
            className="flex flex-col gap-5"
        >
            <Skeleton className="h-11 w-full max-w-md" />
            {Array.from({ length: 2 }, (_, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-6"
                >
                    <Skeleton className="h-7 w-48" />
                    {Array.from({ length: 3 }, (__, row) => (
                        <Skeleton key={row} className="h-12 w-full" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/** /catatan: notes per workspace as trees, search, workspace filter. */
export function NotesIndex({
    state,
    preview,
    mobile,
}: {
    state: NotesState;
    preview: PreviewState;
    mobile: boolean;
}) {
    const [query, setQuery] = useState('');
    const [workspaceId, setWorkspaceId] = useState(ALL);
    const [creating, setCreating] = useState(false);
    const notes = preview === 'kosong' ? [] : state.notes;
    const workspaces = state.workspaces.filter(
        (workspace) => workspaceId === ALL || workspace.id === workspaceId,
    );
    const sections = workspaces
        .map((workspace) => ({
            workspace,
            notes: notes.filter((note) => note.workspace_id === workspace.id),
        }))
        .filter(
            (section) =>
                section.notes.length > 0 &&
                buildTree(section.notes, query).length > 0,
        );
    const recent = [...notes]
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 5);
    const live = notes.filter(
        (note) => (state.activeEditors[note.id] ?? []).length > 0,
    );
    const now = prototypeNow();

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
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari judul atau isi catatan"
                className={cn('pl-10', mobile && 'h-12 rounded-lg')}
            />
        </label>
    );

    let content;

    if (preview === 'memuat') {
        content = <IndexSkeleton />;
    } else if (preview === 'galat') {
        content = (
            <EmptyState
                icon={AlertTriangle}
                title="Catatan gagal dimuat"
                description="Server catatan tidak menjawab. Perubahan yang sedang Anda tulis tetap aman di perangkat."
                action={
                    <Button
                        variant="outline"
                        onClick={() => router.visit('/catatan')}
                    >
                        Coba lagi
                    </Button>
                }
            />
        );
    } else if (notes.length === 0) {
        content = (
            <EmptyState
                icon={NotebookPen}
                title="Belum ada catatan"
                description="Tulis SOP, wiki tim, atau notulen ringan yang bisa diedit bersama."
                action={
                    <Button onClick={() => setCreating(true)}>
                        <Plus aria-hidden />
                        Catatan baru
                    </Button>
                }
            />
        );
    } else if (sections.length === 0) {
        content = (
            <EmptyState
                icon={SearchX}
                size="sm"
                title="Tidak ada catatan yang cocok"
                description={`Tidak ada judul atau isi yang memuat “${query}”.`}
                action={
                    <Button variant="outline" onClick={() => setQuery('')}>
                        Hapus pencarian
                    </Button>
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
                            <>
                                <WorkspaceTile workspace={workspace} />
                                {workspace.name}
                            </>
                        }
                        action={
                            <span className="text-[15px] text-text-muted tnum">
                                {items.length} catatan
                            </span>
                        }
                        bodyClassName={cn(mobile ? 'px-2' : 'px-4')}
                    >
                        <NoteTree
                            notes={items}
                            query={query}
                            people={state.people}
                            activeEditors={state.activeEditors}
                            mobile={mobile}
                        />
                    </Panel>
                ))}
            </div>
        );
    }

    const showAside = !mobile && preview === 'normal' && notes.length > 0;

    return (
        <div className="flex flex-col gap-5">
            <PreviewBar />
            {!mobile && (
                <section className="flex flex-wrap items-end justify-between gap-4">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-h1 text-text lg:text-display">
                            Catatan
                        </h1>
                        <p className="text-body-lg text-text-muted">
                            Wiki, SOP, dan notulen ringan yang diedit bersama
                            {preview === 'normal' && (
                                <>
                                    {' · '}
                                    <span className="tnum">
                                        {notes.length}
                                    </span>{' '}
                                    catatan
                                </>
                            )}
                        </p>
                    </div>
                    <Button onClick={() => setCreating(true)}>
                        <Plus aria-hidden />
                        Catatan baru
                    </Button>
                </section>
            )}
            {preview === 'normal' && notes.length > 0 && (
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
                                ...state.workspaces.map((workspace) => ({
                                    value: workspace.id,
                                    label: workspace.key,
                                    count: notes.filter(
                                        (note) =>
                                            note.workspace_id === workspace.id,
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
                                {state.workspaces.map((workspace) => (
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
                    <div className="flex min-w-0 flex-col gap-5">
                        {live.length > 0 && (
                            <Panel title="Sedang disunting" flush>
                                <ul className="divide-y divide-divider">
                                    {live.map((note) => {
                                        const names = (
                                            state.activeEditors[note.id] ?? []
                                        )
                                            .map(
                                                (id) =>
                                                    state.people.find(
                                                        (person) =>
                                                            person.id === id,
                                                    )?.name,
                                            )
                                            .filter(
                                                (name): name is string =>
                                                    name !== undefined,
                                            );

                                        return (
                                            <li key={note.id}>
                                                <ListRow
                                                    href={`/catatan/${note.id}`}
                                                    leading={
                                                        <span className="relative flex">
                                                            <UserAvatar
                                                                name={
                                                                    names[0] ??
                                                                    ''
                                                                }
                                                                className="size-10 text-[14px]"
                                                            />
                                                            <span
                                                                aria-hidden
                                                                className="absolute right-0 bottom-0 size-3 rounded-full bg-fill-teal ring-2 ring-surface"
                                                            />
                                                        </span>
                                                    }
                                                    title={note.title}
                                                    meta={editorsLabel(names)}
                                                />
                                            </li>
                                        );
                                    })}
                                </ul>
                            </Panel>
                        )}
                        <Panel title="Baru diubah" flush>
                            <ul className="divide-y divide-divider">
                                {recent.map((note) => {
                                    const author = state.people.find(
                                        (person) =>
                                            person.id === note.updated_by,
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
                    </div>
                )}
            </div>

            {mobile && (
                <Fab label="Catatan baru" onClick={() => setCreating(true)} />
            )}
            <NewNoteDialog
                open={creating}
                onOpenChange={setCreating}
                state={state}
                defaultWorkspaceId={
                    workspaceId === ALL ? undefined : workspaceId
                }
                mobile={mobile}
            />
        </div>
    );
}
