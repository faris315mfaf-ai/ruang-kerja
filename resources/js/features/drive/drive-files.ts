import { formatRelative } from '@/lib/format';
import type { DateInput } from '@/lib/format';
import type { DriveFileData, DriveFileKind } from './types';

const GOOGLE_APPS = 'application/vnd.google-apps.';

/** Same mapping as DriveFileKind::fromMimeType() on the server. */
export function kindFromMimeType(mimeType: string): DriveFileKind {
    switch (mimeType) {
        case `${GOOGLE_APPS}document`:
            return 'doc';
        case `${GOOGLE_APPS}spreadsheet`:
            return 'sheet';
        case `${GOOGLE_APPS}presentation`:
            return 'slide';
        case `${GOOGLE_APPS}folder`:
            return 'folder';
        case 'application/pdf':
            return 'pdf';
        default:
            return mimeType.startsWith('image/') ? 'image' : 'other';
    }
}

const KIND_LABELS: Record<DriveFileKind, string> = {
    doc: 'Google Docs',
    sheet: 'Google Sheets',
    slide: 'Google Slides',
    pdf: 'PDF',
    image: 'Gambar',
    folder: 'Folder',
    other: 'File',
};

export function kindLabel(kind: DriveFileKind): string {
    return KIND_LABELS[kind];
}

export function isGoogleNative(kind: DriveFileKind): boolean {
    return kind === 'doc' || kind === 'sheet' || kind === 'slide';
}

/** Embeddable `/preview` URL (iframe) or null for folders. */
export function previewUrl(kind: DriveFileKind, fileId: string): string | null {
    const id = encodeURIComponent(fileId);

    switch (kind) {
        case 'doc':
            return `https://docs.google.com/document/d/${id}/preview`;
        case 'sheet':
            return `https://docs.google.com/spreadsheets/d/${id}/preview`;
        case 'slide':
            return `https://docs.google.com/presentation/d/${id}/preview`;
        case 'folder':
            return null;
        default:
            return `https://drive.google.com/file/d/${id}/preview`;
    }
}

/** "Buka di Google Docs" / "Buka di Drive". */
export function openLabel(kind: DriveFileKind): string {
    return isGoogleNative(kind)
        ? `Buka di ${kindLabel(kind)}`
        : 'Buka di Drive';
}

const sizeFormat = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });

/** "2,4 MB" (1024-based, Indonesian decimals); "–" when unknown. */
export function formatFileSize(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || bytes < 0) {
        return '–';
    }

    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unit = 0;

    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit++;
    }

    return `${sizeFormat.format(value)} ${units[unit]}`;
}

/** Same-site path used as `?return=` after connecting Google. */
export function connectUrl(base: string, returnPath: string): string {
    const safe =
        returnPath.startsWith('/') && !returnPath.startsWith('//')
            ? returnPath
            : '/settings/google';

    return `${base}${base.includes('?') ? '&' : '?'}return=${encodeURIComponent(safe)}`;
}

/**
 * Card subtitle, e.g. "Google Docs · Maya Lestari · 2 jam lalu" or
 * "PDF · 2,4 MB · sari · 3 jam lalu".
 */
export function driveFileMeta(
    file: Pick<
        DriveFileData,
        | 'kind'
        | 'kind_label'
        | 'size_bytes'
        | 'added_by'
        | 'owner_email'
        | 'modified_at'
    >,
    now: DateInput = new Date(),
): string {
    const who = file.added_by?.name ?? file.owner_email?.split('@')[0] ?? null;

    return [
        file.kind_label,
        !isGoogleNative(file.kind) && file.size_bytes !== null
            ? formatFileSize(file.size_bytes)
            : null,
        who,
        file.modified_at ? formatRelative(file.modified_at, now) : null,
    ]
        .filter((part): part is string => Boolean(part))
        .join(' · ');
}
