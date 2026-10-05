import { Link } from '@inertiajs/react';
import {
    ChevronDown,
    ExternalLink,
    FileText,
    Plus,
    Search,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuShortcut,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { SegmentedTabs } from '@/components/ui/tabs';
import { formatDateTime, formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { DriveAccessBadge } from './drive-access-badge';
import { DriveFileIcon } from './drive-file-icon';
import { DriveFilePreview } from './drive-file-preview';
import { openLabel } from './drive-files';
import { filterFiles } from './file-list';
import type { KindFilter } from './file-list';
import { NEW_ITEM_OPTIONS } from './new-item-options';
import type { NewItemType } from './new-item-options';
import type { DriveFileRow, WorkspaceDriveInfo } from './types';

type Props = {
    workspaceKey: string;
    mobile: boolean;
    drive: WorkspaceDriveInfo;
    documents: DriveFileRow[];
    onNewItem: (type: NewItemType) => void;
};

const DOC_OPTIONS = NEW_ITEM_OPTIONS.filter(
    (option) => option.type !== 'folder',
);

const DOC_FILTERS: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'doc', label: 'Docs' },
    { value: 'sheet', label: 'Sheets' },
    { value: 'slide', label: 'Slides' },
];

function who(file: DriveFileRow): string {
    return file.owner_name ?? file.owner_email?.split('@')[0] ?? '–';
}

/**
 * Tab Dokumen: Google Docs, Sheets and Slides anywhere in the workspace
 * folder, newest first, with "Dokumen baru" (created synchronously and
 * opened in Google).
 */
export function WorkspaceDocuments({
    workspaceKey,
    mobile,
    drive,
    documents,
    onNewItem,
}: Props) {
    const [query, setQuery] = useState('');
    const [kind, setKind] = useState<KindFilter>('all');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [sheetOpen, setSheetOpen] = useState(false);
    const rows = useMemo(
        () => filterFiles(documents, query, kind),
        [documents, query, kind],
    );
    const selected = documents.find((file) => file.id === selectedId) ?? null;
    const canAdd = drive.can_contribute && drive.access.state !== 'preparing';
    const loading =
        drive.access.state === 'preparing' ||
        (drive.syncing && documents.length === 0);

    const empty = (
        <EmptyState
            icon={FileText}
            title={
                query || kind !== 'all'
                    ? 'Tidak ada dokumen yang cocok'
                    : 'Belum ada dokumen'
            }
            description={
                query || kind !== 'all'
                    ? 'Coba kata kunci atau jenis lain.'
                    : canAdd
                      ? 'Buat Google Docs, Sheets, atau Slides langsung di folder workspace.'
                      : 'Dokumen Google di folder workspace akan tampil di sini.'
            }
        />
    );

    if (mobile) {
        return (
            <div className="flex flex-col gap-3.5 pb-24">
                <DriveAccessBadge access={drive.access} />
                <ChipScroller
                    label="Jenis dokumen"
                    chips={DOC_FILTERS}
                    value={kind}
                    onChange={setKind}
                />
                {loading ? (
                    <div className="space-y-2" aria-busy>
                        {[0, 1, 2].map((index) => (
                            <Skeleton
                                key={index}
                                className="h-[72px] w-full rounded-card"
                            />
                        ))}
                    </div>
                ) : rows.length === 0 ? (
                    empty
                ) : (
                    <ul className="divide-y divide-divider overflow-hidden rounded-card border border-border bg-surface">
                        {rows.map((file) => (
                            <li key={file.id}>
                                <a
                                    href={file.web_view_link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex min-h-16 items-center gap-3 px-5 py-3.5 active:bg-surface-2"
                                >
                                    <DriveFileIcon kind={file.kind} />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-[17px] font-semibold text-text">
                                            {file.name}
                                        </span>
                                        <span className="block truncate text-label font-normal text-text-muted">
                                            {file.modified_at
                                                ? `Diubah ${formatRelative(file.modified_at)}`
                                                : file.kind_label}{' '}
                                            · {who(file)}
                                        </span>
                                    </span>
                                    <ExternalLink
                                        aria-hidden
                                        className="size-4 shrink-0 text-text-subtle"
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                )}
                {canAdd && (
                    <Fab
                        label="Dokumen baru"
                        onClick={() => setSheetOpen(true)}
                    />
                )}
                <BottomSheet
                    open={sheetOpen}
                    onOpenChange={setSheetOpen}
                    title={`Dokumen baru di ${workspaceKey}`}
                    description="Dibuat di folder workspace dan dibuka di Google."
                >
                    <ul className="space-y-1">
                        {DOC_OPTIONS.map((option) => (
                            <li key={option.type}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSheetOpen(false);
                                        onNewItem(option.type);
                                    }}
                                    className="flex min-h-[72px] w-full items-center gap-4 rounded-lg px-1 py-2 text-left active:bg-surface-2"
                                >
                                    <DriveFileIcon
                                        kind={option.kind}
                                        size="lg"
                                    />
                                    <span>
                                        <span className="block text-[17px] font-semibold text-text">
                                            {option.mobileLabel}
                                        </span>
                                        <span className="block text-meta text-text-muted">
                                            {option.description}
                                        </span>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                </BottomSheet>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-3">
                {drive.can_contribute && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button disabled={!canAdd}>
                                <Plus />
                                Dokumen baru
                                <ChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                            {DOC_OPTIONS.map((option) => (
                                <DropdownMenuItem
                                    key={option.type}
                                    className="items-start gap-3 py-2"
                                    onSelect={() => onNewItem(option.type)}
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
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <SegmentedTabs
                    label="Jenis dokumen"
                    value={kind}
                    onValueChange={setKind}
                    options={DOC_FILTERS}
                />
                <div className="ml-auto flex items-center gap-3">
                    <DriveAccessBadge access={drive.access} />
                    <label className="relative">
                        <span className="sr-only">Cari dokumen</span>
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                        />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder={`Cari di ${documents.length} dokumen`}
                            className="w-72 pl-10"
                        />
                    </label>
                </div>
            </div>

            <div
                className={cn(
                    'grid items-start gap-4',
                    selected && 'xl:grid-cols-[minmax(0,1fr)_380px]',
                )}
            >
                <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
                    {loading ? (
                        <div className="flex flex-col gap-3 p-5" aria-busy>
                            {[0, 1, 2].map((index) => (
                                <Skeleton key={index} className="h-12 w-full" />
                            ))}
                        </div>
                    ) : rows.length === 0 ? (
                        <div className="p-5">{empty}</div>
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
                                        className="hidden w-36 px-5 py-3 font-semibold lg:table-cell"
                                    >
                                        Jenis
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
                                        className={cn(
                                            'w-48 px-5 py-3 font-semibold',
                                            selected
                                                ? 'hidden'
                                                : 'hidden xl:table-cell',
                                        )}
                                    >
                                        Dipakai di tugas
                                    </th>
                                    <th scope="col" className="w-14 px-2 py-3">
                                        <span className="sr-only">Buka</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-divider">
                                {rows.map((file) => (
                                    <tr
                                        key={file.id}
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
                                            </span>
                                        </td>
                                        <td className="hidden px-5 py-3.5 text-text-muted lg:table-cell">
                                            {file.kind_label}
                                        </td>
                                        <td
                                            className={cn(
                                                'truncate px-5 py-3.5 text-text',
                                                selected
                                                    ? 'hidden'
                                                    : 'hidden lg:table-cell',
                                            )}
                                        >
                                            {who(file)}
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
                                        <td
                                            className={cn(
                                                'px-5 py-3.5',
                                                selected
                                                    ? 'hidden'
                                                    : 'hidden xl:table-cell',
                                            )}
                                        >
                                            <span className="flex flex-wrap gap-1">
                                                {file.used_in.length === 0 ? (
                                                    <span className="text-text-subtle">
                                                        –
                                                    </span>
                                                ) : (
                                                    file.used_in
                                                        .slice(0, 3)
                                                        .map((task) => (
                                                            <Link
                                                                key={task.key}
                                                                href={task.url}
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
                                        <td className="px-3 py-3.5 text-right">
                                            <Button
                                                asChild
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-text-muted"
                                            >
                                                <a
                                                    href={file.web_view_link}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={`${openLabel(file.kind)}: ${file.name}`}
                                                >
                                                    <ExternalLink />
                                                </a>
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
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
        </div>
    );
}
