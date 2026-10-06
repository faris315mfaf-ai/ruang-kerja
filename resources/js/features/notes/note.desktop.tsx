import { router } from '@inertiajs/react';
import {
    History,
    MoreHorizontal,
    PanelLeft,
    Plus,
    Share2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedTabs } from '@/components/ui/tabs';
import { cn, focusRing } from '@/lib/utils';
import { DocumentTabsPanel, useDocumentTabs } from './document-tabs';
import { handleScaleShortcut } from './editor/toolbar-extras';
import {
    MinutesModeBar,
    StartModeButton,
    useMinutesMode,
} from './minutes-mode';
import { NewNoteDialog } from './new-note-dialog';
import { EditorToolbar, NoteEditor } from './note-editor';
import {
    EditorsPresence,
    NoteBanners,
    NotePath,
    SaveStatus,
    TitleField,
} from './note-parts';
import { NoteTree } from './note-tree';
import { ShareDialog } from './share-dialog';
import { DeleteDialog, MoveDialog } from './tree-actions';
import type { NoteShowProps, NoteVersion } from './types';
import { useNoteSession } from './use-note-session';
import {
    RestoreVersionDialog,
    VersionList,
    VersionPreview,
} from './version-history';

function useMinWidth(px: number): boolean {
    const query = `(min-width: ${px}px)`;
    const [matches, setMatches] = useState(
        () => window.matchMedia(query).matches,
    );

    useEffect(() => {
        const list = window.matchMedia(query);
        const onChange = () => setMatches(list.matches);
        list.addEventListener('change', onChange);

        return () => list.removeEventListener('change', onChange);
    }, [query]);

    return matches;
}

/**
 * Note editor on desktop & tablet: left panel with the document tabs
 * (≥ 1024px; collapsible on tablets) and the workspace tree (≥ 1280px, own
 * tab), the editor card with live co-editors and note-taking mode, and
 * version history (third column ≥ 1280px, sheet below).
 */
export function NoteDesktop({
    props,
    versions,
}: {
    props: NoteShowProps;
    versions: NoteVersion[] | undefined;
}) {
    const session = useNoteSession(props, versions);
    const wide = useMinWidth(1280);
    const desktop = useMinWidth(1024);
    const [creating, setCreating] = useState(false);
    const { note, history } = session;
    const workspace = props.workspaces.find(
        (item) => item.id === note.workspace_id,
    );
    const mode = useMinutesMode(session);
    const tabs = useDocumentTabs({
        notes: props.notes,
        current: note,
        rootId: mode.rootId,
        canCreate: workspace?.can_create ?? false,
        mobile: false,
    });
    // Tablet: the panel folds away; open by default when the document has tabs.
    const [panelOpen, setPanelOpen] = useState(() => tabs.tabs.length > 1);
    const [panelTab, setPanelTab] = useState<'document' | 'workspace'>(
        'document',
    );
    const showPanel = desktop || panelOpen;

    // Ctrl/⌘ + Alt + = / − / 0: text size of the note body.
    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            handleScaleShortcut(event);
        };
        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
    const previewVersion = history.preview;
    const newDefaults = useMemo(
        () => ({ kind: 'note' as const, workspaceId: note.workspace_id }),
        [note.workspace_id],
    );

    const historyPanel = (
        <div className="flex h-full min-h-0 flex-col">
            <header className="flex items-center gap-2 border-b border-divider px-5 py-3">
                <h2 className="flex-1 text-[18px] font-bold text-text">
                    Riwayat versi
                </h2>
                <button
                    type="button"
                    onClick={() => history.setOpen(false)}
                    aria-label="Tutup riwayat versi"
                    className={cn(
                        'flex size-11 items-center justify-center rounded-full text-text-muted hover:bg-surface-2 hover:text-text',
                        focusRing,
                    )}
                >
                    <X className="size-5" aria-hidden />
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
                <p className="px-3 pb-2 text-[14px] text-text-muted">
                    Versi disimpan otomatis paling sering tiap 5 menit
                    menyunting. Pilih versi untuk melihat isinya.
                </p>
                {history.loading ? (
                    <div className="flex flex-col gap-2 p-3" aria-busy>
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-12 w-full" />
                        ))}
                    </div>
                ) : (
                    <VersionList
                        versions={history.versions}
                        people={props.people}
                        selectedId={previewVersion?.id ?? null}
                        onSelect={(version) => {
                            history.select(version);

                            if (!wide) {
                                history.setOpen(false);
                            }
                        }}
                    />
                )}
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <div
                className={cn(
                    'grid items-start gap-5',
                    showPanel &&
                        (wide && history.open
                            ? 'grid-cols-[240px_minmax(0,1fr)_340px]'
                            : desktop
                              ? 'grid-cols-[240px_minmax(0,1fr)]'
                              : 'grid-cols-[220px_minmax(0,1fr)]'),
                )}
            >
                {showPanel && (
                    <aside
                        aria-label="Panel catatan"
                        className="sticky top-[calc(var(--menu-bar-height)+24px)] flex max-h-[calc(100svh-var(--menu-bar-height)-var(--dock-space)-48px)] flex-col gap-3 overflow-y-auto rounded-panel border border-border bg-surface p-3 shadow-card max-lg:top-6 max-lg:max-h-[calc(100svh-48px)]"
                    >
                        {wide && (
                            <SegmentedTabs
                                label="Isi panel"
                                value={panelTab}
                                onValueChange={setPanelTab}
                                options={[
                                    {
                                        value: 'document',
                                        label: 'Tab dokumen',
                                        id: 'note-panel-document',
                                        controls: 'note-panel',
                                    },
                                    {
                                        value: 'workspace',
                                        label: 'Workspace',
                                        id: 'note-panel-workspace',
                                        controls: 'note-panel',
                                    },
                                ]}
                                className="flex w-full [&>button]:flex-1 [&>button]:px-2"
                            />
                        )}
                        <div
                            id="note-panel"
                            role={wide ? 'tabpanel' : undefined}
                            aria-labelledby={
                                wide ? `note-panel-${panelTab}` : undefined
                            }
                        >
                            {wide && panelTab === 'workspace' ? (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center justify-between gap-2 px-2 pt-1">
                                        <p className="truncate text-[13px] font-bold tracking-[.06em] text-text-muted uppercase">
                                            {workspace?.name}
                                        </p>
                                        {workspace?.can_create && (
                                            <Button
                                                size="icon-sm"
                                                variant="ghost"
                                                aria-label="Catatan baru"
                                                title="Catatan baru"
                                                onClick={() =>
                                                    setCreating(true)
                                                }
                                            >
                                                <Plus aria-hidden />
                                            </Button>
                                        )}
                                    </div>
                                    <NoteTree
                                        notes={props.notes}
                                        activeId={note.id}
                                        people={props.people}
                                        compact
                                    />
                                </div>
                            ) : (
                                <DocumentTabsPanel
                                    state={tabs}
                                    current={note}
                                />
                            )}
                        </div>
                    </aside>
                )}

                <article className="min-w-0 rounded-panel border border-border bg-surface shadow-card">
                    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-6 py-4 lg:px-8">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <NotePath session={session} />
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <SaveStatus session={session} />
                                <EditorsPresence session={session} />
                            </div>
                        </div>
                        {!desktop && (
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={
                                    panelOpen
                                        ? 'Sembunyikan tab dokumen'
                                        : 'Tampilkan tab dokumen'
                                }
                                title="Tab dokumen"
                                aria-pressed={panelOpen}
                                onClick={() => setPanelOpen(!panelOpen)}
                            >
                                <PanelLeft aria-hidden />
                            </Button>
                        )}
                        <StartModeButton mode={mode} />
                        <Button
                            variant="outline"
                            aria-pressed={history.open}
                            onClick={() => history.setOpen(!history.open)}
                        >
                            <History aria-hidden />
                            Riwayat
                        </Button>
                        {note.can_share && (
                            <Button onClick={() => session.setShareOpen(true)}>
                                <Share2 aria-hidden />
                                Bagikan
                            </Button>
                        )}
                        {(note.can_edit || note.can_delete) && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        aria-label="Aksi catatan"
                                    >
                                        <MoreHorizontal aria-hidden />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    {note.can_edit && (
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                session.setMoveOpen(true)
                                            }
                                        >
                                            Pindahkan
                                        </DropdownMenuItem>
                                    )}
                                    {note.can_delete && (
                                        <DropdownMenuItem
                                            className="text-danger"
                                            onSelect={() =>
                                                session.setDeleteOpen(true)
                                            }
                                        >
                                            Hapus
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </header>

                    {previewVersion ? (
                        <div className="px-6 py-8 lg:px-12">
                            <VersionPreview
                                version={previewVersion}
                                people={props.people}
                                onRestore={
                                    note.can_edit
                                        ? () =>
                                              history.askRestore(previewVersion)
                                        : undefined
                                }
                                onClose={history.clearPreview}
                            />
                        </div>
                    ) : (
                        <>
                            {session.editable && session.editor && (
                                <div className="sticky top-0 z-10 border-b border-divider bg-surface px-4 py-1.5 lg:top-(--menu-bar-height) lg:px-6">
                                    <EditorToolbar editor={session.editor} />
                                </div>
                            )}
                            <div className="flex flex-col gap-4 px-6 pt-8 pb-12 lg:px-12">
                                <MinutesModeBar mode={mode} />
                                <NoteBanners session={session} />
                                <TitleField session={session} size={34} />
                                <NoteEditor
                                    key={`${note.id}-${session.editorKey}-${session.mode}`}
                                    live={session.live}
                                    initial={note.content}
                                    editable={session.editable}
                                    me={session.me}
                                    workspaceKey={note.workspace_key}
                                    onChange={session.setContent}
                                    onReady={session.onReady}
                                />
                            </div>
                        </>
                    )}
                </article>

                {wide && history.open && (
                    <aside
                        aria-label="Riwayat versi"
                        className="sticky top-[calc(var(--menu-bar-height)+24px)] h-[calc(100svh-var(--menu-bar-height)-var(--dock-space)-48px)] overflow-hidden rounded-panel border border-border bg-surface shadow-card"
                    >
                        {historyPanel}
                    </aside>
                )}
            </div>

            {!wide && (
                <Sheet open={history.open} onOpenChange={history.setOpen}>
                    <SheetContent
                        side="right"
                        className="w-full gap-0 p-0 sm:max-w-[400px] [&>button:last-child]:hidden"
                    >
                        <SheetTitle className="sr-only">
                            Riwayat versi
                        </SheetTitle>
                        <SheetDescription className="sr-only">
                            {note.title}
                        </SheetDescription>
                        {historyPanel}
                    </SheetContent>
                </Sheet>
            )}

            <RestoreVersionDialog
                version={history.confirming}
                processing={history.processing}
                onOpenChange={(open) => !open && history.cancelRestore()}
                onConfirm={() => void history.confirmRestore()}
            />
            {session.share && (
                <ShareDialog
                    open={session.shareOpen}
                    onOpenChange={session.setShareOpen}
                    note={note}
                    workspace={workspace}
                    share={session.share}
                    people={props.people}
                    viewerId={props.viewer_id}
                    onSaved={session.setShare}
                />
            )}
            <MoveDialog
                note={session.moveOpen ? note : null}
                notes={props.notes}
                mobile={false}
                onClose={() => session.setMoveOpen(false)}
                onMoved={() => router.reload({ only: ['note'] })}
            />
            <DeleteDialog
                note={session.deleteOpen ? note : null}
                mobile={false}
                backToWorkspace
                onClose={() => session.setDeleteOpen(false)}
            />
            {workspace && (
                <NewNoteDialog
                    open={creating}
                    onOpenChange={setCreating}
                    workspaces={[workspace]}
                    notes={props.notes}
                    defaults={newDefaults}
                />
            )}
        </div>
    );
}
