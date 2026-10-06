import { Link, router } from '@inertiajs/react';
import {
    AlertTriangle,
    Eye,
    FileQuestion,
    History,
    Plus,
    Share2,
    X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import type { PreviewState } from '@/features/notes/preview-state';
import { PreviewBar } from '@/features/notes/preview-state';
import { cn, focusRing } from '@/lib/utils';
import { NewNoteDialog } from './new-note-dialog';
import { EditorToolbar, NoteEditor } from './note-editor';
import {
    EditorsPresence,
    NotePath,
    SaveStatus,
    TitleField,
} from './note-parts';
import { NoteTree } from './note-tree';
import { ShareDialog } from './share-dialog';
import type { NotesState } from './types';
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

function EditorSkeleton() {
    return (
        <div
            aria-busy
            aria-label="Memuat catatan"
            className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-10"
        >
            <Skeleton className="h-5 w-56" />
            <Skeleton className="h-11 w-2/3" />
            {Array.from({ length: 6 }, (_, index) => (
                <Skeleton key={index} className="h-5 w-full" />
            ))}
        </div>
    );
}

/**
 * Note editor on desktop & tablet: workspace tree (≥ 1280px), the editor
 * card with live co-editors, and version history (third column ≥ 1280px,
 * sheet below).
 */
export function NoteDesktop({
    state,
    noteId,
    preview,
}: {
    state: NotesState;
    noteId: string;
    preview: PreviewState;
}) {
    const session = useNoteSession(state, noteId);
    const wide = useMinWidth(1280);
    const [creating, setCreating] = useState(false);
    const { note, history } = session;

    if (preview === 'memuat') {
        return (
            <div className="flex flex-col gap-4">
                <PreviewBar />
                <EditorSkeleton />
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
                    description="Tidak dapat tersambung ke server penyuntingan bersama. Coba lagi sebentar."
                    action={
                        <Button
                            variant="outline"
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
                        <Button variant="outline" asChild>
                            <Link href="/catatan">Kembali ke catatan</Link>
                        </Button>
                    }
                />
            </div>
        );
    }

    const workspaceNotes = state.notes.filter(
        (item) => item.workspace_id === note.workspace_id,
    );
    const empty = preview === 'kosong';
    const previewVersion = history.preview;
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
                    Disimpan otomatis tiap ada jeda menyunting. Pilih versi
                    untuk melihat isinya.
                </p>
                <VersionList
                    versions={session.versions}
                    people={state.people}
                    selectedId={history.preview?.id ?? null}
                    onSelect={(version) => {
                        history.select(version);

                        if (!wide) {
                            history.setOpen(false);
                        }
                    }}
                />
            </div>
        </div>
    );

    return (
        <div className="flex flex-col gap-4">
            <PreviewBar />
            <div
                className={cn(
                    'grid items-start gap-5',
                    wide &&
                        (history.open
                            ? 'grid-cols-[240px_minmax(0,1fr)_340px]'
                            : 'grid-cols-[240px_minmax(0,1fr)]'),
                )}
            >
                {wide && (
                    <aside
                        aria-label={`Catatan ${session.workspace?.name ?? ''}`}
                        className="sticky top-[calc(var(--menu-bar-height)+24px)] flex flex-col gap-2 rounded-panel border border-border bg-surface p-3 shadow-card"
                    >
                        <div className="flex items-center justify-between gap-2 px-2 pt-1">
                            <p className="truncate text-[13px] font-bold tracking-[.06em] text-text-muted uppercase">
                                {session.workspace?.name}
                            </p>
                            <Button
                                size="icon-sm"
                                variant="ghost"
                                aria-label="Catatan baru"
                                title="Catatan baru"
                                onClick={() => setCreating(true)}
                            >
                                <Plus aria-hidden />
                            </Button>
                        </div>
                        <NoteTree
                            notes={workspaceNotes}
                            activeId={note.id}
                            people={state.people}
                            activeEditors={state.activeEditors}
                            compact
                        />
                    </aside>
                )}

                <article className="min-w-0 rounded-panel border border-border bg-surface shadow-card">
                    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-6 py-4 lg:px-8">
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                            <NotePath session={session} state={state} />
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                <SaveStatus session={session} />
                                <EditorsPresence session={session} />
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            aria-pressed={history.open}
                            onClick={() => history.setOpen(!history.open)}
                        >
                            <History aria-hidden />
                            Riwayat
                        </Button>
                        <Button onClick={() => session.setShareOpen(true)}>
                            <Share2 aria-hidden />
                            Bagikan
                        </Button>
                    </header>

                    {previewVersion ? (
                        <div className="px-6 py-8 lg:px-12">
                            <VersionPreview
                                version={previewVersion}
                                people={state.people}
                                isCurrent={
                                    previewVersion.id ===
                                    session.latestVersionId
                                }
                                onRestore={() =>
                                    history.askRestore(previewVersion)
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
                            {!session.editable && (
                                <p className="mx-6 mt-4 flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3 text-[15px] text-text-muted">
                                    <Eye className="size-5" aria-hidden />
                                    Anda hanya dapat membaca catatan ini.
                                </p>
                            )}
                            <div className="flex flex-col gap-4 px-6 pt-8 pb-12 lg:px-12">
                                <TitleField session={session} size={34} />
                                {empty && (
                                    <p className="text-[15px] text-text-muted">
                                        Catatan masih kosong. Mulai menulis di
                                        bawah judul; perubahan tersimpan
                                        otomatis dan langsung terlihat oleh
                                        penyunting lain.
                                    </p>
                                )}
                                <NoteEditor
                                    key={`${note.id}-${session.editorKey}-${preview}`}
                                    initial={empty ? null : note.content}
                                    editable={session.editable}
                                    collaborators={
                                        empty ? [] : session.collaborators
                                    }
                                    onChange={(content) =>
                                        !empty && session.setContent(content)
                                    }
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
            <ShareDialog
                open={session.shareOpen}
                onOpenChange={session.setShareOpen}
                note={note}
                workspace={session.workspace}
                share={session.share}
                state={state}
            />
            <NewNoteDialog
                open={creating}
                onOpenChange={setCreating}
                state={state}
                defaultWorkspaceId={note.workspace_id}
            />
        </div>
    );
}
