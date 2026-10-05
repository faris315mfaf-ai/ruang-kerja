import type { DriveFileKind } from './types';

/** "Dokumen baru" choices (mockups WorkspaceFile dropdown, MFile sheet). */
export type NewItemType =
    | 'document'
    | 'spreadsheet'
    | 'presentation'
    | 'folder';

export type NewItemOption = {
    type: NewItemType;
    kind: DriveFileKind;
    label: string;
    mobileLabel: string;
    description: string;
    shortcut: string;
    placeholder: string;
};

export const NEW_ITEM_OPTIONS: NewItemOption[] = [
    {
        type: 'document',
        kind: 'doc',
        label: 'Google Docs',
        mobileLabel: 'Google Docs baru',
        description: 'Dokumen teks, brief, notulen',
        shortcut: 'D',
        placeholder: 'Dokumen tanpa judul',
    },
    {
        type: 'spreadsheet',
        kind: 'sheet',
        label: 'Google Sheets',
        mobileLabel: 'Google Sheets baru',
        description: 'Tabel, anggaran, rekap',
        shortcut: 'S',
        placeholder: 'Spreadsheet tanpa judul',
    },
    {
        type: 'presentation',
        kind: 'slide',
        label: 'Google Slides',
        mobileLabel: 'Google Slides baru',
        description: 'Presentasi dan deck',
        shortcut: 'P',
        placeholder: 'Presentasi tanpa judul',
    },
    {
        type: 'folder',
        kind: 'folder',
        label: 'Folder',
        mobileLabel: 'Folder baru',
        description: 'Akses ikut anggota workspace',
        shortcut: 'F',
        placeholder: 'Nama folder',
    },
];

export function newItemOption(type: NewItemType): NewItemOption {
    return (
        NEW_ITEM_OPTIONS.find((option) => option.type === type) ??
        NEW_ITEM_OPTIONS[0]
    );
}
