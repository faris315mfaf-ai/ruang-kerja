import { Link } from '@inertiajs/react';
import {
    Camera,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    FolderOpen,
    HardDrive,
    RefreshCw,
    Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { EmptyState } from '@/components/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { DriveAccessBadge } from './drive-access-badge';
import { DriveFileIcon } from './drive-file-icon';
import { DriveFilePreview } from './drive-file-preview';
import { formatFileSize, isGoogleNative, kindLabel } from './drive-files';
import { useDrivePicker } from './use-drive-picker';
import { filterFiles, KIND_FILTERS, sortFiles } from './file-list';
import type { KindFilter } from './file-list';
import { NEW_ITEM_OPTIONS } from './new-item-options';
import type { NewItemType } from './new-item-options';
import type {
    DriveFileRow,
    PickedDriveFile,
    WorkspaceDriveInfo,
} from './types';
import type { FolderCrumb } from './workspace-files.desktop';

type Props = {
    workspaceKey: string;
    drive: WorkspaceDriveInfo;
    files: DriveFileRow[];
    breadcrumbs: FolderCrumb[];
    folderHref: (id: string | null) => string;
    onNewItem: (type: NewItemType) => void;
    onUpload: (files: FileList | File[] | null) => void;
    onPicked: (files: PickedDriveFile[]) => void;
    onRefresh: () => void;
};

function rowMeta(file: DriveFileRow): string {
    const who =
        file.added_by?.name.split(' ')[0] ?? file.owner_email?.split('@')[0];

    return [
        file.modified_at ? `Diubah ${formatRelative(file.modified_at)}` : null,
        who,
    ]
        .filter(Boolean)
        .join(' · ');
}

function rowSide(file: DriveFileRow): string {
    if (file.kind === 'folder') {
        return `${file.children_count ?? 0} file`;
    }

    if (!isGoogleNative(file.kind) && file.size_bytes !== null) {
        return formatFileSize(file.size_bytes);
    }

    return kindLabel(file.kind).replace('Google ', '');
}

/**
 * Mobile File tab (mockup MFile): folder card with access status, kind
 * chips, list, FAB → "Tambah ke KEY" sheet (new Docs/Sheets/Slides, upload
 * from phone, take a photo of a document, pick from Drive).
 */
export function WorkspaceFilesMobile({
    workspaceKey,
    drive,
    files,
    breadcrumbs,
    folderHref,
    onNewItem,
    onUpload,
    onPicked,
    onRefresh,
}: Props) {
    const [kind, setKind] = useState<KindFilter>('all');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [preview, setPreview] = useState<DriveFileRow | null>(null);
    const uploadInput = useRef<HTMLInputElement>(null);
    const cameraInput = useRef<HTMLInputElement>(null);
    const picker = useDrivePicker({ onPicked });
    const rows = useMemo(
        () => sortFiles(filterFiles(files, '', kind), 'modified'),
        [files, kind],
    );
    const current = breadcrumbs[breadcrumbs.length - 1];
    const parent =
        breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2] : null;
    const canAdd = drive.can_contribute && drive.access.state !== 'preparing';
    const location = `Disimpan di Shared Drive › ${current?.name ?? drive.folder_name}`;

    const choose = (action: () => void) => {
        setSheetOpen(false);
        action();
    };

    return (
        <div className="space-y-3 pb-20">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
                <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-border text-text-muted"
                >
                    <HardDrive className="size-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex min-w-0 items-center gap-1 text-[14px] text-text-muted">
                        <span className="shrink-0">Shared Drive</span>
                        <ChevronRight
                            aria-hidden
                            className="size-3.5 shrink-0"
                        />
                        <span className="truncate font-medium text-text">
                            {current?.name}
                        </span>
                    </p>
                    <DriveAccessBadge access={drive.access} />
                </div>
                {drive.folder_url && (
                    <a
                        href={drive.folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Buka folder di Google Drive"
                        className="flex size-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-surface-2"
                    >
                        <ExternalLink className="size-5" />
                    </a>
                )}
            </div>

            {parent && (
                <Link
                    href={folderHref(parent.id)}
                    className="flex h-11 items-center gap-1 text-[15px] font-medium text-primary"
                >
                    <ChevronLeft className="size-5" aria-hidden />
                    {parent.name}
                </Link>
            )}

            <ChipScroller
                label="Jenis file"
                chips={KIND_FILTERS}
                value={kind}
                onChange={setKind}
            />

            {drive.access.state === 'preparing' ||
            (drive.syncing && files.length === 0) ? (
                <div className="space-y-2" aria-busy>
                    {[0, 1, 2, 3].map((index) => (
                        <Skeleton key={index} className="h-14 w-full" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <EmptyState
                    icon={FolderOpen}
                    title={
                        kind === 'all'
                            ? 'Folder ini masih kosong'
                            : 'Tidak ada file jenis ini'
                    }
                    description={
                        drive.can_contribute && kind === 'all'
                            ? 'Ketuk + untuk membuat dokumen atau mengunggah foto nota.'
                            : undefined
                    }
                />
            ) : (
                <ul className="-mx-4 divide-y divide-border border-y border-border">
                    {rows.map((file) => {
                        const content = (
                            <>
                                <DriveFileIcon kind={file.kind} />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[16px] text-text">
                                        {file.name}
                                    </span>
                                    <span className="block truncate text-[13px] text-text-muted">
                                        {rowMeta(file)}
                                    </span>
                                </span>
                                <span className="shrink-0 text-[13px] text-text-muted tnum">
                                    {rowSide(file)}
                                </span>
                            </>
                        );

                        return (
                            <li key={file.id}>
                                {file.kind === 'folder' ? (
                                    <Link
                                        href={folderHref(file.google_file_id)}
                                        className="flex min-h-16 items-center gap-3 px-4 py-2 active:bg-surface-2"
                                    >
                                        {content}
                                    </Link>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setPreview(file)}
                                        className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left active:bg-surface-2"
                                    >
                                        {content}
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}

            <button
                type="button"
                onClick={onRefresh}
                disabled={drive.syncing}
                className="flex h-11 items-center gap-1.5 text-[13px] text-text-muted disabled:opacity-60"
            >
                <RefreshCw
                    aria-hidden
                    className={cn('size-4', drive.syncing && 'animate-spin')}
                />
                {drive.syncing ? 'Menyegarkan…' : 'Muat ulang isi folder'}
            </button>

            {canAdd && (
                <Fab
                    label={`Tambah ke ${workspaceKey}`}
                    onClick={() => setSheetOpen(true)}
                />
            )}

            <input
                ref={uploadInput}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                    onUpload(event.target.files);
                    event.target.value = '';
                }}
            />
            <input
                ref={cameraInput}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(event) => {
                    onUpload(event.target.files);
                    event.target.value = '';
                }}
            />

            <BottomSheet
                open={sheetOpen}
                onOpenChange={setSheetOpen}
                title={`Tambah ke ${workspaceKey}`}
                description={location}
            >
                <ul className="space-y-1">
                    {NEW_ITEM_OPTIONS.filter(
                        (option) => option.type !== 'folder',
                    ).map((option) => (
                        <li key={option.type}>
                            <SheetAction
                                icon={
                                    <DriveFileIcon
                                        kind={option.kind}
                                        size="lg"
                                    />
                                }
                                title={option.mobileLabel}
                                description={option.description}
                                onClick={() =>
                                    choose(() => onNewItem(option.type))
                                }
                            />
                        </li>
                    ))}
                    <li className="my-2 border-t border-border" aria-hidden />
                    <li>
                        <SheetAction
                            icon={
                                <ActionIcon>
                                    <Upload />
                                </ActionIcon>
                            }
                            title="Unggah dari ponsel"
                            description="Foto, PDF, atau dokumen lain"
                            onClick={() =>
                                choose(() => uploadInput.current?.click())
                            }
                        />
                    </li>
                    <li>
                        <SheetAction
                            icon={
                                <ActionIcon>
                                    <Camera />
                                </ActionIcon>
                            }
                            title="Ambil foto dokumen"
                            description="Nota, kuitansi, tanda terima"
                            onClick={() =>
                                choose(() => cameraInput.current?.click())
                            }
                        />
                    </li>
                    <li>
                        <SheetAction
                            icon={
                                <ActionIcon>
                                    <HardDrive />
                                </ActionIcon>
                            }
                            title="Pilih dari Drive"
                            description="Tautkan file yang sudah ada"
                            onClick={() => choose(() => void picker.open())}
                        />
                    </li>
                    <li>
                        <SheetAction
                            icon={<DriveFileIcon kind="folder" size="lg" />}
                            title="Folder baru"
                            description="Akses ikut anggota workspace"
                            onClick={() => choose(() => onNewItem('folder'))}
                        />
                    </li>
                </ul>
            </BottomSheet>

            <BottomSheet
                open={preview !== null}
                onOpenChange={(open) => !open && setPreview(null)}
                title={preview?.name ?? 'Pratinjau'}
                description={preview ? kindLabel(preview.kind) : undefined}
            >
                {preview && (
                    <DriveFilePreview
                        file={preview}
                        className="border-0 shadow-none"
                    />
                )}
            </BottomSheet>

            {picker.state.status === 'needs_connect' && (
                <BottomSheet
                    open
                    onOpenChange={(open) => !open && picker.dismiss()}
                    title="Hubungkan akun Google"
                    description={picker.state.message}
                    footer={
                        <a
                            href={picker.state.connectUrl}
                            className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-[16px] font-medium text-primary-foreground"
                        >
                            Hubungkan akun Google
                        </a>
                    }
                >
                    <p className="text-[15px] text-text-muted">
                        RuangKerja hanya dapat membuka file yang Anda pilih
                        sendiri di Google Picker.
                    </p>
                </BottomSheet>
            )}
        </div>
    );
}

function ActionIcon({ children }: { children: ReactNode }) {
    return (
        <span
            aria-hidden
            className="flex size-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary [&_svg]:size-5"
        >
            {children}
        </span>
    );
}

function SheetAction({
    icon,
    title,
    description,
    onClick,
}: {
    icon: ReactNode;
    title: string;
    description: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-16 w-full items-center gap-4 rounded-lg px-1 py-2 text-left active:bg-surface-2"
        >
            {icon}
            <span className="min-w-0">
                <span className="block text-[17px] text-text">{title}</span>
                <span className="block text-[14px] text-text-muted">
                    {description}
                </span>
            </span>
        </button>
    );
}
