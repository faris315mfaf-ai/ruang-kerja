import { Link } from '@inertiajs/react';
import {
    ChevronDown,
    ChevronRight,
    ExternalLink,
    FolderOpen,
    HardDrive,
    Link2,
    Plus,
    RefreshCw,
    Search,
    Upload,
} from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { DriveAccessBadge } from './drive-access-badge';
import { DriveFileIcon } from './drive-file-icon';
import { DriveFilePreview } from './drive-file-preview';
import { formatFileSize, isGoogleNative } from './drive-files';
import { DrivePicker } from './drive-picker';
import { filterFiles, levelSummary, SORT_LABELS, sortFiles } from './file-list';
import type { FileSort } from './file-list';
import { NEW_ITEM_OPTIONS } from './new-item-options';
import type { NewItemType } from './new-item-options';
import type { DriveFileRow, WorkspaceDriveInfo } from './types';

export type FolderCrumb = { id: string | null; name: string };

type Props = {
    drive: WorkspaceDriveInfo;
    files: DriveFileRow[];
    breadcrumbs: FolderCrumb[];
    totalFiles: number;
    folderHref: (id: string | null) => string;
    onNewItem: (type: NewItemType) => void;
    onUpload: (files: FileList | File[] | null) => void;
    onPicked: Parameters<typeof DrivePicker>[0]['onPicked'];
    onRefresh: () => void;
};

function owner(file: DriveFileRow): string {
    return file.owner_name ?? file.owner_email?.split('@')[0] ?? '–';
}

/** Folder path card: "Google Shared Drive › RuangKerja › Proyek Peluncuran Q4 [PLQ]". */
export function DriveFolderBar({
    drive,
    breadcrumbs,
    folderHref,
}: Pick<Props, 'drive' | 'breadcrumbs' | 'folderHref'>) {
    const last = breadcrumbs.length - 1;

    return (
        <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface px-4 py-3 shadow-card">
            <span
                aria-hidden
                className="flex size-10 items-center justify-center rounded-control bg-surface-2 text-text-muted"
            >
                <HardDrive className="size-5" />
            </span>
            <nav aria-label="Lokasi folder" className="min-w-0 flex-1">
                <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-label font-normal text-text-muted">
                    <li>Google Shared Drive</li>
                    <li aria-hidden>
                        <ChevronRight className="size-3.5" />
                    </li>
                    <li>{drive.shared_drive_name}</li>
                    {breadcrumbs.map((crumb, index) => (
                        <li
                            key={crumb.id ?? 'root'}
                            className="flex min-w-0 items-center gap-1"
                        >
                            <ChevronRight
                                aria-hidden
                                className="size-3.5 shrink-0"
                            />
                            {index === last ? (
                                <span
                                    aria-current="page"
                                    className="truncate font-bold text-text"
                                >
                                    {crumb.name}
                                </span>
                            ) : (
                                <Link
                                    href={folderHref(crumb.id)}
                                    className="truncate rounded-xs font-semibold text-link hover:underline"
                                >
                                    {crumb.name}
                                </Link>
                            )}
                        </li>
                    ))}
                </ol>
            </nav>
            <DriveAccessBadge access={drive.access} />
            {drive.folder_url && (
                <Button asChild variant="outline" size="sm">
                    <a
                        href={drive.folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Buka di Drive
                        <ExternalLink />
                    </a>
                </Button>
            )}
        </div>
    );
}

/** Desktop File tab (mockup WorkspaceFile): toolbar, table and preview panel. */
export function WorkspaceFilesDesktop({
    drive,
    files,
    breadcrumbs,
    totalFiles,
    folderHref,
    onNewItem,
    onUpload,
    onPicked,
    onRefresh,
}: Props) {
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<FileSort>('modified');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const rows = useMemo(
        () => sortFiles(filterFiles(files, query), sort),
        [files, query, sort],
    );
    const selected = files.find((file) => file.id === selectedId) ?? null;
    const canAdd = drive.can_contribute && drive.access.state !== 'preparing';

    const drop = (event: DragEvent) => {
        event.preventDefault();
        setDragging(false);

        if (canAdd && event.dataTransfer.files.length > 0) {
            onUpload(event.dataTransfer.files);
        }
    };

    return (
        <div className="flex flex-col gap-5">
            <DriveFolderBar
                drive={drive}
                breadcrumbs={breadcrumbs}
                folderHref={folderHref}
            />

            <div className="flex flex-wrap items-center gap-3">
                {drive.can_contribute && (
                    <>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button disabled={!canAdd}>
                                    <Plus />
                                    Dokumen baru
                                    <ChevronDown />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-72">
                                {NEW_ITEM_OPTIONS.map((option) => (
                                    <div key={option.type}>
                                        {option.type === 'folder' && (
                                            <DropdownMenuSeparator />
                                        )}
                                        <DropdownMenuItem
                                            className="items-start gap-3 py-2"
                                            onSelect={() =>
                                                onNewItem(option.type)
                                            }
                                        >
                                            <DriveFileIcon
                                                kind={option.kind}
                                                size="sm"
                                            />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-label text-text">
                                                    {option.label}
                                                </span>
                                                <span className="block text-meta text-text-muted">
                                                    {option.description}
                                                </span>
                                            </span>
                                            <DropdownMenuShortcut>
                                                {option.shortcut}
                                            </DropdownMenuShortcut>
                                        </DropdownMenuItem>
                                    </div>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="outline"
                            size="default"
                            disabled={!canAdd}
                            onClick={() => input.current?.click()}
                        >
                            <Upload />
                            Unggah
                        </Button>
                        <input
                            ref={input}
                            type="file"
                            multiple
                            hidden
                            onChange={(event) => {
                                onUpload(event.target.files);
                                event.target.value = '';
                            }}
                        />
                        <DrivePicker onPicked={onPicked} disabled={!canAdd} />
                    </>
                )}
                <div className="ml-auto flex items-center gap-2">
                    <label className="relative">
                        <span className="sr-only">Cari file</span>
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                        />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={`Cari di ${files.length} file`}
                            className="w-64 pl-10"
                        />
                    </label>
                    <label className="flex h-11 items-center gap-1.5 rounded-control border border-border-strong bg-surface px-3.5 text-[15px] text-text-muted focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/55">
                        Urutkan:
                        <select
                            value={sort}
                            onChange={(event) =>
                                setSort(event.target.value as FileSort)
                            }
                            className="bg-transparent font-semibold text-text focus-visible:outline-none"
                        >
                            {Object.entries(SORT_LABELS).map(
                                ([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ),
                            )}
                        </select>
                    </label>
                </div>
            </div>

            <div
                className={cn(
                    'grid items-start gap-4',
                    selected && 'xl:grid-cols-[minmax(0,1fr)_380px]',
                )}
            >
                <div
                    onDragOver={(event) => {
                        if (canAdd) {
                            event.preventDefault();
                            setDragging(true);
                        }
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={drop}
                    className={cn(
                        'overflow-hidden rounded-panel border border-border bg-surface shadow-card',
                        dragging && 'border-primary ring-4 ring-ring/55',
                    )}
                >
                    {drive.access.state === 'preparing' ? (
                        <div className="flex flex-col gap-3 p-5" aria-busy>
                            <p className="text-label font-normal text-text-muted">
                                Menyiapkan folder Google Drive workspace…
                            </p>
                            {[0, 1, 2].map((index) => (
                                <Skeleton key={index} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        drive.syncing && files.length === 0 ? (
                            <div className="flex flex-col gap-3 p-5" aria-busy>
                                {[0, 1, 2, 3].map((index) => (
                                    <Skeleton
                                        key={index}
                                        className="h-12 w-full"
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={FolderOpen}
                                className="m-4 border-0"
                                title={
                                    query
                                        ? 'Tidak ada file yang cocok'
                                        : 'Folder ini masih kosong'
                                }
                                description={
                                    query
                                        ? 'Coba kata kunci lain.'
                                        : drive.can_contribute
                                          ? 'Buat dokumen baru, unggah file (maks. 100 MB), atau seret file ke sini.'
                                          : 'Belum ada file di folder ini.'
                                }
                            />
                        )
                    ) : (
                        <table className="w-full table-fixed text-[15px]">
                            <thead className="border-b border-border bg-background text-left text-meta text-text-muted">
                                <tr>
                                    <th
                                        scope="col"
                                        className="px-5 py-3 font-semibold"
                                    >
                                        Nama
                                    </th>
                                    <th
                                        scope="col"
                                        className={cn(
                                            'w-44 px-5 py-3 font-semibold',
                                            selected
                                                ? 'hidden'
                                                : 'hidden lg:table-cell',
                                        )}
                                    >
                                        Pemilik
                                    </th>
                                    <th
                                        scope="col"
                                        className="w-32 px-5 py-3 font-semibold"
                                    >
                                        Diubah
                                    </th>
                                    <th
                                        scope="col"
                                        className="hidden w-28 px-5 py-3 text-right font-semibold lg:table-cell"
                                    >
                                        Ukuran
                                    </th>
                                    <th
                                        scope="col"
                                        className={cn(
                                            'w-48 px-5 py-3 font-semibold',
                                            selected
                                                ? 'hidden'
                                                : 'hidden xl:table-cell',
                                        )}
                                    >
                                        Dipakai di tugas
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-divider">
                                {rows.map((file) => {
                                    const folder = file.kind === 'folder';

                                    return (
                                        <tr
                                            key={file.id}
                                            aria-selected={
                                                file.id === selectedId
                                            }
                                            className={cn(
                                                'transition-colors duration-120 ease-brand hover:bg-background',
                                                file.id === selectedId &&
                                                    'bg-link-soft',
                                            )}
                                        >
                                            <td className="max-w-0 px-5 py-3.5">
                                                <span className="flex min-w-0 items-center gap-2.5">
                                                    <DriveFileIcon
                                                        kind={file.kind}
                                                        size="sm"
                                                    />
                                                    {folder ? (
                                                        <Link
                                                            href={folderHref(
                                                                file.google_file_id,
                                                            )}
                                                            className={cn(
                                                                'truncate rounded-xs text-[16px] font-semibold text-text hover:text-link',
                                                                focusRing,
                                                            )}
                                                        >
                                                            {file.name}
                                                        </Link>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                setSelectedId(
                                                                    file.id ===
                                                                        selectedId
                                                                        ? null
                                                                        : file.id,
                                                                )
                                                            }
                                                            className={cn(
                                                                'truncate rounded-xs text-left text-[16px] font-semibold text-text hover:text-link',
                                                                focusRing,
                                                            )}
                                                        >
                                                            {file.name}
                                                        </button>
                                                    )}
                                                    {file.linked && (
                                                        <span
                                                            title="Ditautkan dari Drive lain"
                                                            className="inline-flex shrink-0 items-center gap-1 rounded-xs bg-surface-2 px-2 py-0.5 text-[13px] font-semibold text-text-muted"
                                                        >
                                                            <Link2
                                                                aria-hidden
                                                                className="size-3"
                                                            />
                                                            Ditautkan
                                                        </span>
                                                    )}
                                                </span>
                                            </td>
                                            <td
                                                className={cn(
                                                    'truncate px-5 py-3.5 text-text',
                                                    selected
                                                        ? 'hidden'
                                                        : 'hidden lg:table-cell',
                                                )}
                                            >
                                                {owner(file)}
                                            </td>
                                            <td
                                                className="px-5 py-3.5 whitespace-nowrap text-text-muted"
                                                title={
                                                    file.modified_at
                                                        ? formatDateTime(
                                                              file.modified_at,
                                                          )
                                                        : undefined
                                                }
                                            >
                                                {file.modified_at
                                                    ? formatRelative(
                                                          file.modified_at,
                                                      )
                                                    : '–'}
                                            </td>
                                            <td className="hidden px-5 py-3.5 text-right whitespace-nowrap text-text-muted tnum lg:table-cell">
                                                {folder
                                                    ? `${file.children_count ?? 0} item`
                                                    : isGoogleNative(
                                                            file.kind,
                                                        ) ||
                                                        file.size_bytes === null
                                                      ? '–'
                                                      : formatFileSize(
                                                            file.size_bytes,
                                                        )}
                                            </td>
                                            <td
                                                className={cn(
                                                    'px-5 py-3.5',
                                                    selected
                                                        ? 'hidden'
                                                        : 'hidden xl:table-cell',
                                                )}
                                            >
                                                <span className="flex flex-wrap gap-1">
                                                    {file.used_in.length ===
                                                    0 ? (
                                                        <span className="text-text-subtle">
                                                            –
                                                        </span>
                                                    ) : (
                                                        file.used_in
                                                            .slice(0, 3)
                                                            .map((task) => (
                                                                <Link
                                                                    key={
                                                                        task.key
                                                                    }
                                                                    href={
                                                                        task.url
                                                                    }
                                                                    title={
                                                                        task.title
                                                                    }
                                                                    className={cn(
                                                                        'rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[13px] font-semibold text-text hover:text-link',
                                                                        focusRing,
                                                                    )}
                                                                >
                                                                    {task.key}
                                                                </Link>
                                                            ))
                                                    )}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {selected && (
                    <DriveFilePreview
                        key={selected.id}
                        file={selected}
                        onClose={() => setSelectedId(null)}
                        className="xl:sticky xl:top-20"
                    />
                )}
            </div>

            <p className="flex flex-wrap items-center gap-x-2 text-meta text-text-muted">
                <span>{levelSummary(files, totalFiles)}.</span>
                <span>
                    Isi folder disegarkan otomatis bila lebih dari 5 menit.
                </span>
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={drive.syncing}
                    className={cn(
                        '-my-2 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 font-semibold text-link hover:underline disabled:opacity-60',
                        focusRing,
                    )}
                >
                    <RefreshCw
                        aria-hidden
                        className={cn(
                            'size-4 motion-reduce:animate-none',
                            drive.syncing && 'animate-spin',
                        )}
                    />
                    {drive.syncing ? 'Menyegarkan…' : 'Muat ulang'}
                </button>
            </p>
        </div>
    );
}
