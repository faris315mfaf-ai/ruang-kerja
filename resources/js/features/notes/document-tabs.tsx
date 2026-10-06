import { Link, router } from '@inertiajs/react';
import {
    FileText,
    List,
    MoreHorizontal,
    NotebookPen,
    Plus,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn, focusRing } from '@/lib/utils';
import notesRoutes from '@/routes/notes';
import { documentTabs, nextTabTitle } from './lib';
import type { DocumentTab } from './lib';
import { TITLE_FIELD_ID } from './note-parts';
import { DeleteDialog, RenameDialog } from './tree-actions';
import type { Note, NoteDetail } from './types';

/**
 * Tabs of a document (Notulensi, keputusan pemilik 6 Okt 2026), like Google
 * Docs: the document itself, its child notes as tabs, their children as
 * sub-tabs. A tab is an ordinary note (`parent_id`), so it keeps live
 * editing, history and sharing; switching tabs opens /catatan/{tab} and
 * note-taking mode carries on.
 */
export function useDocumentTabs({
    notes,
    current,
    rootId,
    canCreate,
    mobile,
}: {
    notes: Note[];
    current: NoteDetail;
    rootId: string;
    /** The viewer may write notes in this workspace. */
    canCreate: boolean;
    mobile: boolean;
}) {
    const tabs = documentTabs(notes, rootId);
    const [renaming, setRenaming] = useState<Note | null>(null);
    const [deleting, setDeleting] = useState<Note | null>(null);
    const [adding, setAdding] = useState(false);
    const active = tabs.find((tab) => tab.note.id === current.id) ?? null;

    const add = (parentId: string) => {
        if (adding) {
            return;
        }

        router.post(
            notesRoutes.store.url(),
            {
                workspace_id: current.workspace_id,
                parent_id: parentId,
                title: nextTabTitle(tabs, parentId, rootId),
                kind: 'note',
            },
            {
                onStart: () => setAdding(true),
                onFinish: () => setAdding(false),
                onError: () => toast.error('Tab gagal dibuat. Coba lagi.'),
            },
        );
    };

    const rename = (note: Note) => {
        if (note.id === current.id) {
            // The open tab: its title is the big field above the text.
            const field = document.getElementById(TITLE_FIELD_ID);

            if (field instanceof HTMLTextAreaElement) {
                field.focus();
                field.select();
            }

            return;
        }

        setRenaming(note);
    };

    const dialogs = (
        <>
            <RenameDialog
                note={renaming}
                mobile={mobile}
                onClose={() => setRenaming(null)}
                onRenamed={() => router.reload({ only: ['note'] })}
            />
            <DeleteDialog
                note={deleting}
                mobile={mobile}
                backToWorkspace={false}
                backToParent
                onClose={() => setDeleting(null)}
            />
        </>
    );

    return {
        tabs,
        active,
        rootId,
        canCreate,
        adding,
        add,
        rename,
        remove: (note: Note) => setDeleting(note),
        dialogs,
    };
}

export type DocumentTabsState = ReturnType<typeof useDocumentTabs>;

function canEditTab(tab: DocumentTab, current: NoteDetail): boolean {
    // Rights of other tabs are not in the props: the server decides (403 → toast).
    return tab.note.id === current.id ? current.can_edit : true;
}

/** Desktop/tablet: "Tab dokumen" list in the left panel. */
export function DocumentTabsPanel({
    state,
    current,
}: {
    state: DocumentTabsState;
    current: NoteDetail;
}) {
    const { tabs } = state;

    return (
        <nav aria-label="Tab dokumen" className="flex flex-col gap-1">
            <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1">
                <p className="text-[13px] font-bold tracking-[.06em] text-text-muted uppercase">
                    Tab dokumen
                </p>
                {state.canCreate && (
                    <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Tambah tab"
                        title="Tambah tab"
                        disabled={state.adding}
                        onClick={() => state.add(state.rootId)}
                    >
                        <Plus aria-hidden />
                    </Button>
                )}
            </div>
            <ul className="flex flex-col gap-0.5">
                {tabs.map((tab, index) => {
                    const isActive = tab.note.id === current.id;
                    const isRoot = index === 0;

                    return (
                        <li
                            key={tab.note.id}
                            className={cn(
                                'group/tab flex items-center rounded-[12px] transition-colors duration-120 ease-brand',
                                isActive
                                    ? 'bg-link-soft text-link'
                                    : 'text-text hover:bg-surface-2',
                                tab.level === 1 && 'ml-5',
                            )}
                        >
                            <Link
                                href={notesRoutes.show.url(tab.note.id)}
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                    'flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-[12px] py-2 pl-3 text-[15px] font-semibold',
                                    focusRing,
                                )}
                            >
                                {isRoot ? (
                                    tab.note.preset === 'minutes' ? (
                                        <NotebookPen
                                            aria-hidden
                                            className="size-4 shrink-0"
                                        />
                                    ) : (
                                        <FileText
                                            aria-hidden
                                            className="size-4 shrink-0"
                                        />
                                    )
                                ) : (
                                    <span
                                        aria-hidden
                                        className={cn(
                                            'shrink-0 rounded-full bg-current',
                                            tab.level === 0
                                                ? 'size-1.5 opacity-70'
                                                : 'size-1 opacity-50',
                                        )}
                                    />
                                )}
                                <span className="truncate">
                                    {tab.note.title}
                                </span>
                            </Link>
                            <TabMenu
                                tab={tab}
                                isRoot={isRoot}
                                state={state}
                                current={current}
                                className={cn(
                                    'opacity-0 group-focus-within/tab:opacity-100 group-hover/tab:opacity-100',
                                    isActive && 'opacity-100',
                                )}
                            />
                        </li>
                    );
                })}
            </ul>
            {state.dialogs}
        </nav>
    );
}

function TabMenu({
    tab,
    isRoot,
    state,
    current,
    className,
}: {
    tab: DocumentTab;
    isRoot: boolean;
    state: DocumentTabsState;
    current: NoteDetail;
    className?: string;
}) {
    const editable = canEditTab(tab, current);
    const canSub = state.canCreate && !isRoot && tab.level === 0;

    if (!editable && !canSub) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    aria-label={`Aksi tab ${tab.note.title}`}
                    className={cn(
                        'mr-1 flex size-8 shrink-0 items-center justify-center rounded-[10px] text-text-muted transition-opacity duration-120 ease-brand hover:bg-surface hover:text-text data-[state=open]:opacity-100',
                        focusRing,
                        className,
                    )}
                >
                    <MoreHorizontal className="size-4" aria-hidden />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                {editable && (
                    <DropdownMenuItem onSelect={() => state.rename(tab.note)}>
                        Ganti nama
                    </DropdownMenuItem>
                )}
                {canSub && (
                    <DropdownMenuItem onSelect={() => state.add(tab.note.id)}>
                        Tambah sub-tab
                    </DropdownMenuItem>
                )}
                {isRoot && state.canCreate && (
                    <DropdownMenuItem onSelect={() => state.add(state.rootId)}>
                        Tambah tab
                    </DropdownMenuItem>
                )}
                {editable && !isRoot && (
                    <DropdownMenuItem
                        className="text-danger"
                        onSelect={() => state.remove(tab.note)}
                    >
                        Hapus tab
                    </DropdownMenuItem>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

const CHIP =
    'hit-area flex h-10 max-w-[220px] shrink-0 snap-start items-center gap-1.5 rounded-full px-4 text-[15px] font-bold transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring';

/**
 * Phone: chips of the document and its tabs under the app bar, a second
 * row for the sub-tabs of the open tab, and "Tab dokumen" (bottom sheet)
 * with the full list and the actions.
 */
export function DocumentTabStrip({
    state,
    current,
}: {
    state: DocumentTabsState;
    current: NoteDetail;
}) {
    const [sheet, setSheet] = useState(false);
    const { tabs, active } = state;
    const topLevel = tabs.filter((tab) => tab.level === 0);
    const openTabId = active?.tabId ?? state.rootId;
    const subTabs = tabs.filter(
        (tab) =>
            tab.level === 1 &&
            tab.tabId === openTabId &&
            openTabId !== state.rootId,
    );
    const openTab = tabs.find((tab) => tab.note.id === openTabId);
    const isRootOpen = current.id === state.rootId;

    return (
        <nav aria-label="Tab dokumen" className="flex flex-col gap-2">
            <div className="-mx-4 flex snap-x scroll-px-4 [scrollbar-width:none] items-center gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
                {topLevel.map((tab) => {
                    const selected = tab.note.id === openTabId;

                    return (
                        <Link
                            key={tab.note.id}
                            href={notesRoutes.show.url(tab.note.id)}
                            aria-current={
                                tab.note.id === current.id ? 'page' : undefined
                            }
                            className={cn(
                                CHIP,
                                selected
                                    ? 'bg-primary bg-grad-aksi text-on-brand'
                                    : 'border border-border-strong bg-surface text-text',
                            )}
                        >
                            <span className="truncate">{tab.note.title}</span>
                        </Link>
                    );
                })}
                {state.canCreate && (
                    <button
                        type="button"
                        aria-label="Tambah tab"
                        disabled={state.adding}
                        onClick={() => state.add(state.rootId)}
                        className={cn(
                            CHIP,
                            'border border-dashed border-border-strong bg-transparent px-3 text-link disabled:opacity-50',
                        )}
                    >
                        <Plus className="size-4" aria-hidden />
                        Tab
                    </button>
                )}
                <button
                    type="button"
                    aria-label="Semua tab dokumen"
                    onClick={() => setSheet(true)}
                    className={cn(
                        CHIP,
                        'border border-border-strong bg-surface px-3 text-text',
                    )}
                >
                    <List className="size-4" aria-hidden />
                </button>
            </div>
            {subTabs.length > 0 && (
                <div className="-mx-4 flex [scrollbar-width:none] items-center gap-2 overflow-x-auto px-4 pb-1 [&::-webkit-scrollbar]:hidden">
                    {subTabs.map((tab) => (
                        <Link
                            key={tab.note.id}
                            href={notesRoutes.show.url(tab.note.id)}
                            aria-current={
                                tab.note.id === current.id ? 'page' : undefined
                            }
                            className={cn(
                                'flex h-11 max-w-[200px] shrink-0 items-center rounded-[12px] px-3 text-[15px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                tab.note.id === current.id
                                    ? 'bg-link-soft text-link'
                                    : 'bg-surface-2 text-text-muted',
                            )}
                        >
                            <span className="truncate">{tab.note.title}</span>
                        </Link>
                    ))}
                </div>
            )}

            <BottomSheet
                open={sheet}
                onOpenChange={setSheet}
                title="Tab dokumen"
                description={tabs[0]?.note.title}
                footer={
                    state.canCreate && (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="lg"
                                className="flex-1"
                                disabled={state.adding}
                                onClick={() => {
                                    setSheet(false);
                                    state.add(state.rootId);
                                }}
                            >
                                <Plus aria-hidden />
                                Tab baru
                            </Button>
                            {!isRootOpen && openTab && (
                                <Button
                                    variant="outline"
                                    size="lg"
                                    className="flex-1"
                                    disabled={state.adding}
                                    onClick={() => {
                                        setSheet(false);
                                        state.add(openTab.note.id);
                                    }}
                                >
                                    <Plus aria-hidden />
                                    Sub-tab
                                </Button>
                            )}
                        </div>
                    )
                }
            >
                <ul className="flex flex-col gap-1">
                    {tabs.map((tab, index) => {
                        const isActive = tab.note.id === current.id;

                        return (
                            <li
                                key={tab.note.id}
                                className={cn(
                                    'flex items-center gap-1 rounded-[14px]',
                                    isActive && 'bg-link-soft',
                                    tab.level === 1 && 'ml-6',
                                )}
                            >
                                <Link
                                    href={notesRoutes.show.url(tab.note.id)}
                                    aria-current={isActive ? 'page' : undefined}
                                    onClick={() => setSheet(false)}
                                    className={cn(
                                        'flex min-h-14 min-w-0 flex-1 items-center gap-3 px-3 text-[17px] font-semibold',
                                        isActive ? 'text-link' : 'text-text',
                                        focusRing,
                                    )}
                                >
                                    {index === 0 ? (
                                        <NotebookPen
                                            aria-hidden
                                            className="size-5 shrink-0"
                                        />
                                    ) : null}
                                    <span className="truncate">
                                        {tab.note.title}
                                    </span>
                                </Link>
                                {index > 0 && canEditTab(tab, current) && (
                                    <TabMenu
                                        tab={tab}
                                        isRoot={false}
                                        state={state}
                                        current={current}
                                        className="size-11"
                                    />
                                )}
                            </li>
                        );
                    })}
                </ul>
            </BottomSheet>
            {state.dialogs}
        </nav>
    );
}
