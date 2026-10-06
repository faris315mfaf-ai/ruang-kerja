import { router } from '@inertiajs/react';
import {
    ALargeSmall,
    ArrowLeft,
    History,
    MoreHorizontal,
    NotebookPen,
    Plus,
    RotateCcw,
    Share2,
} from 'lucide-react';
import {
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useKeyboardInset, useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { cn } from '@/lib/utils';
import { DocumentTabStrip, useDocumentTabs } from './document-tabs';
import { TextSizeControl } from './editor/toolbar-extras';
import { MinutesModeBar, useMinutesMode } from './minutes-mode';
import { EditorToolbar, NoteEditor } from './note-editor';
import {
    EditorsPresence,
    NoteBanners,
    NotePath,
    SaveStatus,
    TitleField,
} from './note-parts';
import { ShareDialog } from './share-dialog';
import { DeleteDialog, MoveDialog } from './tree-actions';
import type { NoteShowProps, NoteVersion } from './types';
import { useNoteSession } from './use-note-session';
import {
    RestoreVersionDialog,
    VersionList,
    VersionPreview,
} from './version-history';

/** Bridge for the phone app bar buttons (rendered by the layout). */
type NoteUi = { history: boolean; share: boolean; more: boolean };

let ui: NoteUi = { history: false, share: false, more: false };
const listeners = new Set<() => void>();

function setNoteUi(next: Partial<NoteUi>): void {
    ui = { ...ui, ...next };
    listeners.forEach((listener) => listener());
}

function useNoteUi(): NoteUi {
    return useSyncExternalStore(
        (listener) => {
            listeners.add(listener);

            return () => listeners.delete(listener);
        },
        () => ui,
        () => ui,
    );
}

/** App bar actions of /catatan/{note} on phones: history, share, more. */
export function NoteAppBarActions({ canShare }: { canShare: boolean }) {
    return (
        <>
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label="Riwayat versi"
                onClick={() => setNoteUi({ history: true })}
            >
                <History className="size-5" strokeWidth={2} aria-hidden />
            </button>
            {canShare && (
                <button
                    type="button"
                    className={cn(appBarIconButton, 'size-11')}
                    aria-label="Bagikan"
                    onClick={() => setNoteUi({ share: true })}
                >
                    <Share2 className="size-5" strokeWidth={2} aria-hidden />
                </button>
            )}
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label="Aksi catatan"
                onClick={() => setNoteUi({ more: true })}
            >
                <MoreHorizontal
                    className="size-5"
                    strokeWidth={2}
                    aria-hidden
                />
            </button>
        </>
    );
}

/**
 * Note on phones: full-screen editor, formatting bar pinned above the tab
 * bar (or right above the keyboard), history, sharing and actions in
 * bottom sheets.
 */
export function NoteMobile({
    props,
    versions,
}: {
    props: NoteShowProps;
    versions: NoteVersion[] | undefined;
}) {
    const session = useNoteSession(props, versions);
    const current = useNoteUi();
    const keyboardOpen = useKeyboardOpen();
    const keyboardInset = useKeyboardInset();
    const toolbarBox = useRef<HTMLDivElement>(null);
    const [toolbarHeight, setToolbarHeight] = useState(64);
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
        mobile: true,
    });
    const [textSizeOpen, setTextSizeOpen] = useState(false);
    const showTabs = tabs.tabs.length > 1 || mode.active;

    // App bar → session.
    useEffect(() => {
        history.setOpen(current.history);
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [current.history]);

    useEffect(() => {
        session.setShareOpen(current.share);
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [current.share]);

    useEffect(
        () => () => setNoteUi({ history: false, share: false, more: false }),
        [],
    );

    useLayoutEffect(() => {
        const element = toolbarBox.current;

        if (!element) {
            return;
        }

        const observer = new ResizeObserver(() =>
            setToolbarHeight(element.offsetHeight),
        );
        observer.observe(element);

        return () => observer.disconnect();
    }, [session.editor]);

    const previewing = history.preview;

    return (
        <div className="flex flex-col gap-3">
            {showTabs && <DocumentTabStrip state={tabs} current={note} />}
            <MinutesModeBar mode={mode} mobile />
            <NotePath session={session} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <SaveStatus session={session} />
                <EditorsPresence session={session} compact />
            </div>
            <NoteBanners session={session} />
            <TitleField session={session} size={26} className="pt-1" />
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
            <div aria-hidden style={{ height: toolbarHeight }} />

            {session.editable && session.editor && (
                <div
                    ref={toolbarBox}
                    className={cn(
                        'glass fixed inset-x-0 z-30 border-x-0 border-b-0 px-2 py-1.5',
                        !keyboardOpen &&
                            'bottom-[calc(var(--tab-bar-height)+env(safe-area-inset-bottom))]',
                    )}
                    style={keyboardOpen ? { bottom: keyboardInset } : undefined}
                >
                    <EditorToolbar
                        editor={session.editor}
                        mobile
                        onTextSize={() => setTextSizeOpen(true)}
                    />
                </div>
            )}

            <BottomSheet
                open={history.open}
                onOpenChange={(open) => {
                    setNoteUi({ history: open });

                    if (!open) {
                        history.clearPreview();
                    }
                }}
                title={previewing ? 'Pratinjau versi' : 'Riwayat versi'}
                description={
                    previewing ? undefined : 'Pilih versi untuk melihat isinya'
                }
                className="h-[88svh]"
                footer={
                    previewing && (
                        <div className="flex gap-3">
                            <Button
                                variant="outline"
                                size="lg"
                                className="flex-1"
                                onClick={history.clearPreview}
                            >
                                <ArrowLeft aria-hidden />
                                Daftar
                            </Button>
                            {note.can_edit && (
                                <Button
                                    size="lg"
                                    className="flex-1"
                                    onClick={() =>
                                        history.askRestore(previewing)
                                    }
                                >
                                    <RotateCcw aria-hidden />
                                    Pulihkan
                                </Button>
                            )}
                        </div>
                    )
                }
            >
                {previewing ? (
                    <VersionPreview
                        version={previewing}
                        people={props.people}
                    />
                ) : history.loading ? (
                    <div className="flex flex-col gap-2" aria-busy>
                        {Array.from({ length: 4 }, (_, index) => (
                            <Skeleton key={index} className="h-14 w-full" />
                        ))}
                    </div>
                ) : (
                    <VersionList
                        versions={history.versions}
                        people={props.people}
                        selectedId={null}
                        onSelect={history.select}
                        mobile
                    />
                )}
            </BottomSheet>

            <BottomSheet
                open={current.more}
                onOpenChange={(open) => setNoteUi({ more: open })}
                title="Aksi catatan"
            >
                <div className="flex flex-col gap-2">
                    {mode.canStart && (
                        <Button
                            variant="tonal"
                            size="lg"
                            onClick={() => {
                                setNoteUi({ more: false });
                                mode.start();
                            }}
                        >
                            <NotebookPen aria-hidden />
                            Mode catat
                        </Button>
                    )}
                    {tabs.canCreate && (
                        <Button
                            variant="outline"
                            size="lg"
                            disabled={tabs.adding}
                            onClick={() => {
                                setNoteUi({ more: false });
                                tabs.add(tabs.rootId);
                            }}
                        >
                            <Plus aria-hidden />
                            Tambah tab
                        </Button>
                    )}
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => {
                            setNoteUi({ more: false });
                            setTextSizeOpen(true);
                        }}
                    >
                        <ALargeSmall aria-hidden />
                        Ukuran huruf
                    </Button>
                    {note.can_edit && (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => {
                                setNoteUi({ more: false });
                                session.setMoveOpen(true);
                            }}
                        >
                            Pindahkan
                        </Button>
                    )}
                    {note.can_delete && (
                        <Button
                            variant="outline"
                            size="lg"
                            className="text-danger"
                            onClick={() => {
                                setNoteUi({ more: false });
                                session.setDeleteOpen(true);
                            }}
                        >
                            Hapus catatan
                        </Button>
                    )}
                    {!note.can_edit && !note.can_delete && (
                        <p className="text-[15px] text-text-muted">
                            Anda hanya dapat membaca catatan ini.
                        </p>
                    )}
                </div>
            </BottomSheet>

            <BottomSheet
                open={textSizeOpen}
                onOpenChange={setTextSizeOpen}
                title="Tampilan teks"
                description="Ukuran huruf isi catatan, diingat di perangkat ini"
            >
                <div className="flex justify-center py-2">
                    <TextSizeControl
                        large
                        buttonClassName="flex size-13 items-center justify-center rounded-full border border-border-strong bg-surface text-text transition-colors duration-120 ease-brand disabled:opacity-40 focus-visible:ring-[3px] focus-visible:ring-ring outline-none"
                    />
                </div>
            </BottomSheet>

            <RestoreVersionDialog
                version={history.confirming}
                processing={history.processing}
                onOpenChange={(open) => !open && history.cancelRestore()}
                onConfirm={() => {
                    void history.confirmRestore().then((ok) => {
                        if (ok) {
                            setNoteUi({ history: false });
                        }
                    });
                }}
            />
            {session.share && (
                <ShareDialog
                    open={session.shareOpen}
                    onOpenChange={(open) => setNoteUi({ share: open })}
                    note={note}
                    workspace={workspace}
                    share={session.share}
                    people={props.people}
                    viewerId={props.viewer_id}
                    onSaved={session.setShare}
                    mobile
                />
            )}
            <MoveDialog
                note={session.moveOpen ? note : null}
                notes={props.notes}
                mobile
                onClose={() => session.setMoveOpen(false)}
                onMoved={() => router.reload({ only: ['note'] })}
            />
            <DeleteDialog
                note={session.deleteOpen ? note : null}
                mobile
                backToWorkspace
                onClose={() => session.setDeleteOpen(false)}
            />
        </div>
    );
}
