import { describe, expect, it } from 'vite-plus/test';

import {
    connectUrl,
    driveFileMeta,
    formatFileSize,
    isGoogleNative,
    kindFromMimeType,
    kindLabel,
    openLabel,
    previewUrl,
} from './drive-files';

describe('kindFromMimeType', () => {
    it.each([
        ['application/vnd.google-apps.document', 'doc'],
        ['application/vnd.google-apps.spreadsheet', 'sheet'],
        ['application/vnd.google-apps.presentation', 'slide'],
        ['application/vnd.google-apps.folder', 'folder'],
        ['application/pdf', 'pdf'],
        ['image/jpeg', 'image'],
        ['application/zip', 'other'],
    ] as const)('maps %s to %s', (mime, kind) => {
        expect(kindFromMimeType(mime)).toBe(kind);
    });
});

describe('labels', () => {
    it('uses Indonesian labels', () => {
        expect(kindLabel('doc')).toBe('Google Docs');
        expect(kindLabel('image')).toBe('Gambar');
        expect(openLabel('sheet')).toBe('Buka di Google Sheets');
        expect(openLabel('pdf')).toBe('Buka di Drive');
        expect(isGoogleNative('slide')).toBe(true);
        expect(isGoogleNative('pdf')).toBe(false);
    });
});

describe('previewUrl', () => {
    it('builds /preview URLs for the iframe', () => {
        expect(previewUrl('doc', 'abc')).toBe(
            'https://docs.google.com/document/d/abc/preview',
        );
        expect(previewUrl('sheet', 'abc')).toBe(
            'https://docs.google.com/spreadsheets/d/abc/preview',
        );
        expect(previewUrl('slide', 'abc')).toBe(
            'https://docs.google.com/presentation/d/abc/preview',
        );
        expect(previewUrl('pdf', 'a/b')).toBe(
            'https://drive.google.com/file/d/a%2Fb/preview',
        );
        expect(previewUrl('folder', 'abc')).toBeNull();
    });
});

describe('formatFileSize', () => {
    it('formats bytes with Indonesian decimals', () => {
        expect(formatFileSize(512)).toBe('512 B');
        expect(formatFileSize(2_516_582)).toBe('2,4 MB');
        expect(formatFileSize(1536)).toBe('1,5 KB');
        expect(formatFileSize(null)).toBe('–');
    });
});

describe('connectUrl', () => {
    it('adds a same-site return path', () => {
        expect(connectUrl('/google/connect', '/workspace/plq')).toBe(
            '/google/connect?return=%2Fworkspace%2Fplq',
        );
        expect(connectUrl('/google/connect', '//evil.test')).toBe(
            '/google/connect?return=%2Fsettings%2Fgoogle',
        );
        expect(connectUrl('/google/connect?x=1', '/a')).toBe(
            '/google/connect?x=1&return=%2Fa',
        );
    });
});

describe('driveFileMeta', () => {
    const now = '2026-10-05T10:00:00Z';

    it('shows kind, person and relative time for Google files', () => {
        expect(
            driveFileMeta(
                {
                    kind: 'doc',
                    kind_label: 'Google Docs',
                    size_bytes: null,
                    added_by: { id: '1', name: 'Maya Lestari' },
                    owner_email: 'maya@demo.test',
                    modified_at: '2026-10-05T08:00:00Z',
                },
                now,
            ),
        ).toBe('Google Docs · Maya Lestari · 2 jam lalu');
    });

    it('adds the size for uploaded files and falls back to the owner', () => {
        expect(
            driveFileMeta(
                {
                    kind: 'pdf',
                    kind_label: 'PDF',
                    size_bytes: 2_516_582,
                    added_by: null,
                    owner_email: 'sari@demo.test',
                    modified_at: null,
                },
                now,
            ),
        ).toBe('PDF · 2,4 MB · sari');
    });
});
