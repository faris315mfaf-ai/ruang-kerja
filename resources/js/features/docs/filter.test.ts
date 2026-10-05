import { describe, expect, it } from 'vite-plus/test';
import { filterDocs } from './filter';
import type { DocListItem } from './types';

const doc = (slug: string, title: string, group: string, path: string) =>
    ({
        slug,
        title,
        group,
        path,
        size: 1,
        updatedAt: '2026-10-05T00:00:00Z',
    }) satisfies DocListItem;

const documents = [
    doc('readme', 'README', 'start', 'README.md'),
    doc('prd', 'PRD', 'product', 'docs/PRD.md'),
    doc(
        'sprints-sprint-3-summary',
        'Sprint 3 — Ringkasan: QR dinamis',
        'sprints',
        'docs/sprints/sprint-3/SUMMARY.md',
    ),
    doc('x', 'Lepas', 'unknown', 'docs/X.md'),
];

const groups = [
    { key: 'start', label: 'Mulai di sini' },
    { key: 'product', label: 'Produk & desain' },
    { key: 'sprints', label: 'Riwayat sprint' },
];

describe('filterDocs', () => {
    it('groups everything in group order when the query is empty', () => {
        const sections = filterDocs(documents, groups, '  ');

        expect(sections.map((section) => section.group.key)).toEqual([
            'start',
            'product',
            'sprints',
            'other',
        ]);
        expect(sections[3].group.label).toBe('Lainnya');
    });

    it('matches title and path, case-insensitively, all words', () => {
        expect(
            filterDocs(documents, groups, 'qr SPRINT')[0].documents.map(
                (d) => d.slug,
            ),
        ).toEqual(['sprints-sprint-3-summary']);
        expect(
            filterDocs(documents, groups, 'docs/prd')[0].documents[0].slug,
        ).toBe('prd');
    });

    it('drops groups without matches', () => {
        expect(filterDocs(documents, groups, 'readme')).toHaveLength(1);
        expect(filterDocs(documents, groups, 'tidak ada')).toEqual([]);
    });
});
