import { router } from '@inertiajs/react';
import {
    ALargeSmall,
    ArrowLeft,
    Cloud,
    History,
    List,
    NotebookPen,
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
import type { SavePhase } from './lib';
import { DocumentTabsSheet, useDocumentTabs } from './document-tabs';
import { TextSizeControl } from './editor/toolbar-extras';
import { useToolbarVisibility } from './editor/toolbar-visibility';
import { FinishDialog, useMinutesMode } from './minutes-mode';
import { EditorToolbar, NoteEditor } from './note-editor';
import {
    NoteBanners,
    SaveStatusDetail,
    SaveStatusIcon,
    TitleField,
    saveStatusState,
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

/**
 * Bridge for the phone app bar (rendered by the layout): the three icons
 * read the live session summary, taps open the status/tab sheets or call
 * the session action registered by <NoteMobile> after mount. Only
 * primitives, so publishing never loops.
 */
type NoteUi = {
    status: boolean;
    tabs: boolean;
    statusPhase: SavePhase | null;
    statusLabel: string | null;
    modeActive: boolean;
    modeEnabled: boolean;
    toggleMode: () => void;
};

const EMPTY_UI: NoteUi = {
    status: false,
    tabs: false,
    statusPhase: null,
    statusLabel: null,
    modeActive: false,
    modeEnabled: false,
    toggleMode: () => {},
};

let ui: NoteUi = EMPTY_UI;
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

/**
 * App bar actions of /catatan/{note} on phones (keputusan pemilik 9 Okt
 * 2026): combined save/Presence status, document tabs and note-taking
 * mode — everything else lives in the sheets.
 */
export function NoteAppBarActions() {
    const current = useNoteUi();
    const statusReady = current.statusPhase !== null;

    return (
        <>
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label={current.statusLabel ?? 'Status simpanan catatan'}
                title={current.statusLabel ?? 'Status simpanan catatan'}
                onClick={() => setNoteUi({ status: true })}
            >
                {statusReady && current.statusPhase ? (
                    <SaveStatusIcon phase={current.statusPhase} />
                ) : (
                    <Cloud className="size-5" strokeWidth={2} aria-hidden />
                )}
            </button>
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label="Tab dokumen"
                onClick={() => setNoteUi({ tabs: true })}
            >
                <List className="size-5" strokeWidth={2} aria-hidden />
            </button>
            <button
                type="button"
                className={cn(
                    appBarIconButton,
                    'size-11',
                    current.modeActive &&
                        'border-link bg-link-soft text-link hover:bg-link-soft',
                )}
                aria-pressed={current.modeActive}
                aria-label={
                    current.modeActive
                        ? 'Mode catat aktif, selesai mencatat'
                        : 'Mode catat'
                }
                disabled={!current.modeEnabled}
                onClick={current.toggleMode}
            >
                <NotebookPen className="size-5" strokeWidth={2} aria-hidden />
            </button>
        </>
    );
}

/**
 * Note on phones: a full-screen editor with room to write (keputusan
 * pemilik 9 Okt 2026) — title, banners, text and an auto-hiding formatting
 * bar above the tab bar/keyboard. Tabs, status detail and note actions
 * live in bottom sheets opened from the app bar.
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
    const statusState = saveStatusState(session);
    const modeEnabled = mode.active || mode.canStart;
    const toolbarMounted = session.editable && session.editor !== null;
    const toolbarVisible = useToolbarVisibility(
        toolbarMounted ? session.editor : null,
    );

    // Session → app bar icons (live summary + the mode toggle).
    useEffect(() => {
        setNoteUi({
            statusPhase: statusState.phase,
            statusLabel: statusState.label,
            modeActive: mode.active,
            modeEnabled,
            toggleMode: () => (mode.active ? mode.askFinish() : mode.start()),
        });
        // Primitives only: re-publishing identical values must not loop.
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [statusState.phase, statusState.label, mode.active, modeEnabled]);

    useEffect(
        () => () => {
            ui = EMPTY_UI;
            listeners.forEach((listener) => listener());
        },
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
    const openTabActions = (open: () => void) => () => {
        setNoteUi({ tabs: false });
        open();
    };

    return (
        <div className="flex flex-col gap-3">
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

            {/* Spacer so the fixed bar never covers the caret; only as tall
                as the bar itself, and gone once the bar hides. */}
            <div
                aria-hidden
                className="transition-[height] duration-180 ease-brand"
                style={{
                    height:
                        toolbarMounted && toolbarVisible ? toolbarHeight : 0,
                }}
            />

            {session.editable && session.editor && (
                <div
                    ref={toolbarBox}
                    className={cn(
                        'glass fixed inset-x-0 z-30 border-x-0 border-b-0 px-2 py-1.5 transition-[transform,opacity,visibility] duration-180 ease-brand',
                        toolbarVisible
                            ? 'visible translate-y-0 opacity-100'
                            : 'pointer-events-none invisible translate-y-full opacity-0',
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
                    history.setOpen(open);

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

            <DocumentTabsSheet
                open={current.tabs}
                onOpenChange={(open) => setNoteUi({ tabs: open })}
                state={tabs}
                current={note}
                actions={
                    <div className="flex flex-col gap-2">
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={openTabActions(() =>
                                history.setOpen(true),
                            )}
                        >
                            <History aria-hidden />
                            Riwayat versi
                        </Button>
                        {note.can_share && (
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={openTabActions(() =>
                                    session.setShareOpen(true),
                                )}
                            >
                                <Share2 aria-hidden />
                                Bagikan
                            </Button>
                        )}
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={openTabActions(() =>
                                setTextSizeOpen(true),
                            )}
                        >
                            <ALargeSmall aria-hidden />
                            Ukuran huruf
                        </Button>
                        {note.can_edit && (
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={openTabActions(() =>
                                    session.setMoveOpen(true),
                                )}
                            >
                                Pindahkan
                            </Button>
                        )}
                        {note.can_delete && (
                            <Button
                                variant="outline"
                                size="lg"
                                className="text-danger"
                                onClick={openTabActions(() =>
                                    session.setDeleteOpen(true),
                                )}
                            >
                                Hapus catatan
                            </Button>
                        )}
                    </div>
                }
            />

            <BottomSheet
                open={current.status}
                onOpenChange={(open) => setNoteUi({ status: open })}
                title="Status catatan"
                description={note.title}
            >
                <div className="py-1">
                    <SaveStatusDetail
                        state={statusState}
                        reloadAction={
                            statusState.conflict && (
                                <Button
                                    variant="outline"
                                    className="self-start"
                                    onClick={session.reload}
                                >
                                    Muat ulang
                                </Button>
                            )
                        }
                    />
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

            <FinishDialog mode={mode} mobile />

            <RestoreVersionDialog
                version={history.confirming}
                processing={history.processing}
                onOpenChange={(open) => !open && history.cancelRestore()}
                onConfirm={() => {
                    void history.confirmRestore().then((ok) => {
                        if (ok) {
                            history.setOpen(false);
                        }
                    });
                }}
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
