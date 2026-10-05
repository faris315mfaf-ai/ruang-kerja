import { describe, expect, it } from 'vite-plus/test';

import { filterFiles, levelSummary, sortFiles } from './file-list';
import type { DriveFileRow } from './types';

function row(
    name: string,
    overrides: Partial<DriveFileRow> = {},
): DriveFileRow {
    return {
        id: name,
        google_file_id: name,
        name,
        mime_type: 'application/pdf',
        kind: 'pdf',
        kind_label: 'PDF',
        web_view_link: '#',
        preview_url: null,
        icon_link: null,
        size_bytes: null,
        owner_email: null,
        modified_at: null,
        added_by: null,
        deleted: false,
        parent_id: null,
        linked: false,
        children_count: null,
        owner_name: null,
        used_in: [],
        ...overrides,
    };
}

const rows = [
    row('Wireframe v2.pdf', {
        size_bytes: 2_400_000,
        modified_at: '2026-10-05T03:00:00Z',
    }),
    row('Materi desain', { kind: 'folder', kind_label: 'Folder' }),
    row('Brief landing page', {
        kind: 'doc',
        kind_label: 'Google Docs',
        modified_at: '2026-10-05T05:00:00Z',
    }),
    row('Anggaran', {
        kind: 'sheet',
        kind_label: 'Google Sheets',
        modified_at: '2026-10-01T05:00:00Z',
    }),
];

describe('sortFiles', () => {
    it('keeps folders first and sorts by the chosen order', () => {
        expect(sortFiles(rows, 'modified').map((r) => r.name)).toEqual([
            'Materi desain',
            'Brief landing page',
            'Wireframe v2.pdf',
            'Anggaran',
        ]);
        expect(sortFiles(rows, 'name').map((r) => r.name)).toEqual([
            'Materi desain',
            'Anggaran',
            'Brief landing page',
            'Wireframe v2.pdf',
        ]);
        expect(sortFiles(rows, 'size')[1]?.name).toBe('Wireframe v2.pdf');
    });
});

describe('filterFiles', () => {
    it('filters by name and kind chip', () => {
        expect(filterFiles(rows, 'BRIEF').map((r) => r.name)).toEqual([
            'Brief landing page',
        ]);
        expect(filterFiles(rows, '', 'sheet').map((r) => r.name)).toEqual([
            'Anggaran',
        ]);
        expect(filterFiles(rows, '', 'all')).toHaveLength(4);
    });
});

describe('levelSummary', () => {
    it('counts folders and files of the level', () => {
        expect(levelSummary(rows, 24)).toBe(
            '1 folder · 3 file di tingkat ini · 24 file total',
        );
        expect(levelSummary([], 0)).toBe(
            '0 file di tingkat ini · 0 file total',
        );
    });
});
