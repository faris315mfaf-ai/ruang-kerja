import { normalizeText } from '@/features/tasks/lib/filters';
import type { DriveFileKind, DriveFileRow } from './types';

export type FileSort = 'modified' | 'name' | 'size';

export const SORT_LABELS: Record<FileSort, string> = {
    modified: 'Diubah terakhir',
    name: 'Nama',
    size: 'Ukuran',
};

/** Mobile chips (mockup MFile): Semua · Docs · Sheets · Slides · PDF · Gambar. */
export type KindFilter = 'all' | 'doc' | 'sheet' | 'slide' | 'pdf' | 'image';

export const KIND_FILTERS: { value: KindFilter; label: string }[] = [
    { value: 'all', label: 'Semua' },
    { value: 'doc', label: 'Docs' },
    { value: 'sheet', label: 'Sheets' },
    { value: 'slide', label: 'Slides' },
    { value: 'pdf', label: 'PDF' },
    { value: 'image', label: 'Gambar' },
];

function time(row: DriveFileRow): number {
    return row.modified_at ? new Date(row.modified_at).getTime() : 0;
}

/** Folders always first, then by the chosen order. */
export function sortFiles(
    rows: DriveFileRow[],
    sort: FileSort,
): DriveFileRow[] {
    const byName = (a: DriveFileRow, b: DriveFileRow) =>
        a.name.localeCompare(b.name, 'id', {
            sensitivity: 'base',
            numeric: true,
        });

    return [...rows].sort((a, b) => {
        const folders =
            Number(b.kind === 'folder') - Number(a.kind === 'folder');

        if (folders !== 0) {
            return folders;
        }

        switch (sort) {
            case 'modified':
                return time(b) - time(a) || byName(a, b);
            case 'size':
                return (
                    (b.size_bytes ?? -1) - (a.size_bytes ?? -1) || byName(a, b)
                );
            default:
                return byName(a, b);
        }
    });
}

/** Name search (accent/case-insensitive) and kind chip; folders only for "Semua". */
export function filterFiles(
    rows: DriveFileRow[],
    query: string,
    kind: KindFilter = 'all',
): DriveFileRow[] {
    const needle = normalizeText(query.trim());

    return rows.filter(
        (row) =>
            (kind === 'all' || row.kind === (kind as DriveFileKind)) &&
            (needle === '' || normalizeText(row.name).includes(needle)),
    );
}

/** "2 folder · 6 file di tingkat ini · 24 file total". */
export function levelSummary(rows: DriveFileRow[], totalFiles: number): string {
    const folders = rows.filter((row) => row.kind === 'folder').length;
    const files = rows.length - folders;
    const parts = [
        folders > 0 ? `${folders} folder` : null,
        `${files} file di tingkat ini`,
        `${totalFiles} file total`,
    ];

    return parts.filter(Boolean).join(' · ');
}
