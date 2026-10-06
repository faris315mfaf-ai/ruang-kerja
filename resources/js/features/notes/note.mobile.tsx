import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    ArrowLeft,
    Eye,
    FileQuestion,
    History,
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
import { EmptyState } from '@/components/empty-state';
import { appBarIconButton } from '@/components/mobile/app-bar';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { PreviewState } from '@/features/notes/preview-state';
import { PreviewBar } from '@/features/notes/preview-state';
import { useKeyboardInset, useKeyboardOpen } from '@/hooks/use-keyboard-open';
import { cn } from '@/lib/utils';
import { EditorToolbar, NoteEditor } from './note-editor';
import {
    EditorsPresence,
    NotePath,
    SaveStatus,
    TitleField,
} from './note-parts';
import { ShareDialog } from './share-dialog';
import type { NotesState } from './types';
import { useNoteSession } from './use-note-session';
import {
    RestoreVersionDialog,
    VersionList,
    VersionPreview,
} from './version-history';

/** Bridge for the phone app bar buttons (rendered by the layout). */
type NoteUi = { history: boolean; share: boolean };

let ui: NoteUi = { history: false, share: false };
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

/** App bar actions of /catatan/{note} on phones: history + share. */
export function NoteAppBarActions() {
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
            <button
                type="button"
                className={cn(appBarIconButton, 'size-11')}
                aria-label="Bagikan"
                onClick={() => setNoteUi({ share: true })}
            >
                <Share2 className="size-5" strokeWidth={2} aria-hidden />
            </button>
        </>
    );
}

/**
 * Note on phones: full-screen editor, formatting bar pinned above the tab
 * bar (or right above the keyboard), history and sharing in bottom sheets.
 */
export function NoteMobile({
    state,
    noteId,
    preview,
}: {
    state: NotesState;
    noteId: string;
    preview: PreviewState;
}) {
    const session = useNoteSession(state, noteId);
    const current = useNoteUi();
    const keyboardOpen = useKeyboardOpen();
    const keyboardInset = useKeyboardInset();
    const toolbarBox = useRef<HTMLDivElement>(null);
    const [toolbarHeight, setToolbarHeight] = useState(64);
    const { note, history } = session;

    // App bar → session.
    useEffect(() => {
        history.setOpen(current.history);
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [current.history]);

    useEffect(() => {
        session.setShareOpen(current.share);
        // oxlint-disable-next-line react-hooks/exhaustive-deps
    }, [current.share]);

    useEffect(() => () => setNoteUi({ history: false, share: false }), []);

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

    if (preview === 'memuat') {
        return (
            <div
                className="flex flex-col gap-4"
                aria-busy
                aria-label="Memuat catatan"
            >
                <PreviewBar />
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-9 w-3/4" />
                {Array.from({ length: 6 }, (_, index) => (
                    <Skeleton key={index} className="h-5 w-full" />
                ))}
            </div>
        );
    }

    if (preview === 'galat') {
        return (
            <div className="flex flex-col gap-4">
                <PreviewBar />
                <EmptyState
                    icon={AlertTriangle}
                    title="Catatan gagal dimuat"
                    description="Periksa koneksi internet Anda, lalu coba lagi."
                    action={
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => router.visit(`/catatan/${noteId}`)}
                        >
                            Coba lagi
                        </Button>
                    }
                />
            </div>
        );
    }

    if (!note) {
        return (
            <div className="flex flex-col gap-4">
                <PreviewBar />
                <EmptyState
                    icon={FileQuestion}
                    title="Catatan tidak ditemukan"
                    description="Catatan ini sudah dihapus atau Anda tidak punya akses."
                    action={
                        <Button variant="outline" size="lg" asChild>
                            <Link href="/catatan">Kembali ke catatan</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    const empty = preview === 'kosong';
    const previewing = history.preview;

    return (
        <div className="flex flex-col gap-3">
            <PreviewBar />
            <NotePath session={session} state={state} />
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <SaveStatus session={session} />
                <EditorsPresence session={session} compact />
            </div>
            {!session.editable && (
                <p className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3 text-[15px] text-text-muted">
                    <Eye className="size-5" aria-hidden />
                    Anda hanya dapat membaca catatan ini.
                </p>
            )}
            <TitleField session={session} size={26} className="pt-1" />
            {empty && (
                <p className="text-[15px] text-text-muted">
                    Catatan masih kosong. Mulai menulis di bawah; perubahan
                    tersimpan otomatis.
                </p>
            )}
            <NoteEditor
                key={`${note.id}-${session.editorKey}-${preview}`}
                initial={empty ? null : note.content}
                editable={session.editable}
                collaborators={empty ? [] : session.collaborators}
                onChange={(content) => !empty && session.setContent(content)}
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
                    <EditorToolbar editor={session.editor} mobile />
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
                            {previewing.id !== session.latestVersionId && (
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
                        people={state.people}
                        isCurrent={previewing.id === session.latestVersionId}
                    />
                ) : (
                    <VersionList
                        versions={session.versions}
                        people={state.people}
                        selectedId={null}
                        onSelect={history.select}
                        mobile
                    />
                )}
                {session.versions.length > 0 && !previewing && (
                    <p className="pt-3 text-center text-[14px] text-text-muted">
                        <Badge variant="label" className="mr-1">
                            {session.versions.length}
                        </Badge>
                        versi tersimpan
                    </p>
                )}
            </BottomSheet>

            <RestoreVersionDialog
                version={history.confirming}
                processing={history.processing}
                onOpenChange={(open) => !open && history.cancelRestore()}
                onConfirm={() => {
                    void history
                        .confirmRestore()
                        .then(() => setNoteUi({ history: false }));
                }}
            />
            <ShareDialog
                open={session.shareOpen}
                onOpenChange={(open) => setNoteUi({ share: open })}
                note={note}
                workspace={session.workspace}
                share={session.share}
                state={state}
                mobile
            />
        </div>
    );
}
