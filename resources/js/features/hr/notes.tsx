import { Link } from '@inertiajs/react';
import { FileText, Lock, NotebookPen, Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NewNoteDialog } from '@/features/notes/new-note-dialog';
import type { NewNoteDefaults } from '@/features/notes/new-note-dialog';
import { QuickMinutesButton } from '@/features/notes/quick-minutes-button';
import type { Note, NoteWorkspace } from '@/features/notes/types';
import { formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { HubShell } from './hub-shell';
import type { HrNotesProps } from './types';

const ALL = '__all';

/** Root folder of a note (walks up the tree), or null. */
export function rootFolderOf(note: Note, byId: Map<string, Note>): Note | null {
    let current: Note | undefined = note;
    let root: Note | null = null;
    const seen = new Set<string>();

    while (current && !seen.has(current.id)) {
        seen.add(current.id);

        if (current.kind === 'folder' && current.parent_id === null) {
            root = current;
        }

        current = current.parent_id ? byId.get(current.parent_id) : undefined;
    }

    return root;
}

/**
 * Documents shown in the list: notes at the root or inside a folder (tabs,
 * i.e. notes under another note, open from their parent).
 */
export function listedNotes(items: Note[]): Note[] {
    const byId = new Map(items.map((note) => [note.id, note]));

    return items.filter((note) => {
        if (note.kind !== 'note') {
            return false;
        }

        const parent = note.parent_id ? byId.get(note.parent_id) : undefined;

        return parent === undefined || parent.kind === 'folder';
    });
}

function NoteRow({ note, folder }: { note: Note; folder: string | null }) {
    const Icon = note.preset === 'minutes' ? NotebookPen : FileText;

    return (
        <li className="border-t border-divider first:border-t-0">
            <Link
                href={`/catatan/${note.id}`}
                className={cn(
                    'flex min-h-[72px] items-center gap-3.5 px-5 py-2.5 transition-colors duration-120 ease-brand hover:bg-background md:px-6',
                    focusRing,
                    'focus-visible:ring-inset',
                )}
            >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-text-muted">
                    <Icon aria-hidden className="size-5" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-[16px] leading-6 font-semibold">
                            {note.title}
                        </span>
                        {note.preset === 'minutes' && (
                            <Badge
                                variant="status"
                                tone="link"
                                className="h-6 px-2 text-[12px]"
                            >
                                Notulensi
                            </Badge>
                        )}
                        {note.access === 'restricted' && (
                            <Badge
                                variant="status"
                                tone="warning"
                                className="h-6 px-2 text-[12px]"
                            >
                                <Lock aria-hidden className="size-3" />
                                Terbatas
                            </Badge>
                        )}
                    </span>
                    <span className="truncate text-meta text-text-muted">
                        {[
                            folder,
                            `diperbarui ${formatRelative(note.updated_at)}`,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </span>
                </span>
            </Link>
        </li>
    );
}

/** Ruang HR › Catatan (Catatan.dc.html): notes of the "Tim HR" workspace. */
export function HrNotes({
    props,
    mobile,
}: {
    props: HrNotesProps;
    mobile: boolean;
}) {
    const { hub, notes } = props;
    const [query, setQuery] = useState('');
    const [folder, setFolder] = useState(ALL);
    const [dialog, setDialog] = useState(false);
    const byId = useMemo(
        () => new Map(notes.items.map((note) => [note.id, note])),
        [notes.items],
    );
    const documents = useMemo(() => listedNotes(notes.items), [notes.items]);
    const folders = notes.items.filter(
        (note) => note.kind === 'folder' && note.parent_id === null,
    );
    const folderOf = (note: Note) => rootFolderOf(note, byId);
    const needle = query.trim().toLocaleLowerCase('id-ID');
    const shown = documents
        .filter((note) => folder === ALL || folderOf(note)?.id === folder)
        .filter(
            (note) =>
                needle === '' ||
                note.title.toLocaleLowerCase('id-ID').includes(needle),
        )
        .sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
    const count = (id: string) =>
        id === ALL
            ? documents.length
            : documents.filter((note) => folderOf(note)?.id === id).length;

    const workspace: NoteWorkspace | null = notes.workspace
        ? {
              ...notes.workspace,
              color: 'teal',
              type: 'team',
              can_create: notes.can_create,
          }
        : null;
    const defaults = useMemo<NewNoteDefaults>(
        () => ({
            kind: 'note',
            workspaceId: workspace?.id,
            parentId: folder === ALL ? null : folder,
        }),
        [workspace?.id, folder],
    );

    if (!notes.enabled || workspace === null) {
        return (
            <HubShell hub={hub} title="Catatan · Ruang HR" mobile={mobile}>
                <EmptyState
                    icon={NotebookPen}
                    title="Catatan belum aktif"
                    description={
                        hub.features.notes
                            ? 'Workspace "Tim HR" dibuat otomatis begitu ada akun HR yang aktif.'
                            : 'Fitur Catatan bersama belum dinyalakan untuk perusahaan ini.'
                    }
                />
            </HubShell>
        );
    }

    const search = (
        <div className="relative w-full max-w-md">
            <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
            />
            <Input
                type="search"
                aria-label="Cari catatan"
                placeholder="Cari judul catatan"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="pl-11"
            />
        </div>
    );

    const list =
        shown.length === 0 ? (
            <EmptyState
                size="sm"
                icon={FileText}
                className="m-4 md:m-5"
                title={
                    documents.length === 0
                        ? 'Belum ada catatan tim HR'
                        : 'Tidak ada catatan yang cocok'
                }
                description={
                    documents.length === 0
                        ? 'SOP, notulen wawancara, dan rapat tim HR disimpan di sini.'
                        : undefined
                }
            />
        ) : (
            <ul className="flex flex-col">
                {shown.map((note) => (
                    <NoteRow
                        key={note.id}
                        note={note}
                        folder={
                            folder === ALL
                                ? (folderOf(note)?.title ?? null)
                                : null
                        }
                    />
                ))}
            </ul>
        );

    const create = notes.can_create && (
        <NewNoteDialog
            open={dialog}
            onOpenChange={setDialog}
            workspaces={[workspace]}
            notes={notes.items}
            defaults={defaults}
            mobile={mobile}
        />
    );

    if (mobile) {
        return (
            <HubShell hub={hub} title="Catatan · Ruang HR" mobile>
                {search}
                {folders.length > 0 && (
                    <ChipScroller
                        label="Folder"
                        value={folder}
                        onChange={setFolder}
                        chips={[
                            { value: ALL, label: 'Semua', count: count(ALL) },
                            ...folders.map((item) => ({
                                value: item.id,
                                label: item.title,
                                count: count(item.id),
                            })),
                        ]}
                    />
                )}
                <QuickMinutesButton mobile />
                <section
                    aria-label="Daftar catatan"
                    className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
                >
                    {list}
                </section>
                {notes.can_create && (
                    <Fab label="Catatan baru" onClick={() => setDialog(true)} />
                )}
                {create}
            </HubShell>
        );
    }

    return (
        <HubShell hub={hub} title="Catatan · Ruang HR" mobile={false}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                {search}
                <div className="flex flex-wrap items-center gap-3">
                    <QuickMinutesButton />
                    {notes.can_create && (
                        <Button type="button" onClick={() => setDialog(true)}>
                            <Plus aria-hidden />
                            Catatan baru
                        </Button>
                    )}
                </div>
            </div>
            <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
                <nav
                    aria-label="Folder catatan HR"
                    className="flex flex-col gap-1 rounded-panel border border-border bg-surface p-3 shadow-card"
                >
                    {[{ id: ALL, title: 'Semua catatan' }, ...folders].map(
                        (item) => {
                            const active = folder === item.id;

                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-current={active ? 'true' : undefined}
                                    onClick={() => setFolder(item.id)}
                                    className={cn(
                                        'flex min-h-11 items-center justify-between gap-3 rounded-[10px] px-3 text-left text-[15px] transition-colors duration-120 ease-brand',
                                        active
                                            ? 'bg-link-soft font-bold text-link'
                                            : 'font-medium text-text hover:bg-surface-2',
                                        focusRing,
                                    )}
                                >
                                    <span className="truncate">
                                        {item.title}
                                    </span>
                                    <span className="shrink-0 text-meta text-text-muted tnum">
                                        {count(item.id)}
                                    </span>
                                </button>
                            );
                        },
                    )}
                    <p className="mt-2 border-t border-divider px-3 pt-3 text-meta text-text-muted">
                        Dokumen di workspace {workspace.name}. Semua anggota HR
                        bisa menyunting; catatan "Terbatas" hanya untuk yang
                        diundang.
                    </p>
                </nav>
                <section
                    aria-label="Daftar catatan"
                    className="min-w-0 overflow-hidden rounded-panel border border-border bg-surface py-1 shadow-card"
                >
                    {list}
                </section>
            </div>
            {create}
        </HubShell>
    );
}
