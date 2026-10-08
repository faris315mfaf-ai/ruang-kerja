import { Link, router } from '@inertiajs/react';
import { FileText, MoreHorizontal, NotebookPen, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
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

/**
 * Phone: "Tab dokumen" bottom sheet with the full tab list, the tab actions
 * and (via `actions`) the note actions that left the app bar — the strip
 * itself is gone from the content flow (keputusan pemilik 9 Okt 2026).
 */
export function DocumentTabsSheet({
    open,
    onOpenChange,
    state,
    current,
    actions,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    state: DocumentTabsState;
    current: NoteDetail;
    /** Extra rows under the list (history, sharing, move/delete, …). */
    actions?: ReactNode;
}) {
    const { tabs } = state;
    const active = tabs.find((tab) => tab.note.id === current.id) ?? null;
    const openTabId = active?.tabId ?? state.rootId;
    const openTab = tabs.find((tab) => tab.note.id === openTabId);
    const isRootOpen = current.id === state.rootId;

    return (
        <BottomSheet
            open={open}
            onOpenChange={onOpenChange}
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
                                onOpenChange(false);
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
                                    onOpenChange(false);
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
                                onClick={() => onOpenChange(false)}
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
            {actions && (
                <div className="mt-4 flex flex-col gap-2 border-t border-divider pt-4">
                    {actions}
                </div>
            )}
            {state.dialogs}
        </BottomSheet>
    );
}
