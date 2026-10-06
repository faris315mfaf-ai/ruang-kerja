import { describe, expect, it } from 'vitest';
import { NOTES } from './fixtures';
import {
    ancestors,
    buildTree,
    canEdit,
    cursorAt,
    docText,
    editorsLabel,
    flattenTree,
    savedLabel,
    wordCount,
} from './lib';
import type { Note } from './types';

const sdm = NOTES.filter((note) => note.workspace_id === 'w-sdm');

describe('buildTree', () => {
    it('nests children under their parent, alphabetically', () => {
        const tree = buildTree(sdm);

        expect(tree.map((node) => node.note.title)).toEqual([
            'Kebijakan WFH & hybrid',
            'SOP Onboarding Karyawan Baru',
        ]);
        expect(
            tree[1].children.map((node) => [node.note.title, node.depth]),
        ).toEqual([
            ['Checklist hari pertama', 1],
            ['Pembuatan akun & akses sistem', 1],
        ]);
    });

    it('keeps the ancestors of a match found in the body text', () => {
        const tree = buildTree(sdm, 'kartu akses');
        const rows = flattenTree(tree).map((node) => node.note.id);

        expect(rows).toEqual(['sop-onboarding', 'checklist-hari-pertama']);
    });

    it('returns nothing when no note matches', () => {
        expect(buildTree(sdm, 'tidak ada kata ini')).toEqual([]);
    });

    it('puts notes with a missing parent at the root', () => {
        const orphan: Note = { ...sdm[1], id: 'orphan', parent_id: 'gone' };

        expect(buildTree([orphan]).map((node) => node.note.id)).toEqual([
            'orphan',
        ]);
    });

    it('hides children of collapsed notes when flattening', () => {
        const rows = flattenTree(buildTree(sdm), new Set(['sop-onboarding']));

        expect(rows.map((node) => node.note.id)).toEqual([
            'kebijakan-wfh',
            'sop-onboarding',
        ]);
    });
});

describe('note helpers', () => {
    it('extracts plain text and counts words', () => {
        const doc = {
            type: 'doc' as const,
            content: [
                {
                    type: 'heading',
                    content: [{ type: 'text', text: 'Hari pertama' }],
                },
                {
                    type: 'bulletList',
                    content: [
                        {
                            type: 'listItem',
                            content: [
                                {
                                    type: 'paragraph',
                                    content: [
                                        { type: 'text', text: 'Tur kantor' },
                                    ],
                                },
                            ],
                        },
                    ],
                },
            ],
        };

        expect(docText(doc)).toBe('Hari pertama\nTur kantor\n\n');
        expect(wordCount(doc)).toBe(4);
        expect(wordCount(null)).toBe(0);
    });

    it('walks up to the root for the breadcrumb', () => {
        expect(
            ancestors(NOTES, 'checklist-hari-pertama').map((note) => note.id),
        ).toEqual(['sop-onboarding']);
        expect(ancestors(NOTES, 'sop-onboarding')).toEqual([]);
    });

    it('formats the autosave status', () => {
        const now = 100_000;

        expect(savedLabel(now, now, true)).toBe('Menyimpan…');
        expect(savedLabel(null, now, false)).toBe('Tersimpan');
        expect(savedLabel(now - 500, now, false)).toBe('Tersimpan · baru saja');
        expect(savedLabel(now - 2_000, now, false)).toBe(
            'Tersimpan · 2 dtk lalu',
        );
        expect(savedLabel(now - 180_000, now, false)).toBe(
            'Tersimpan · 3 mnt lalu',
        );
        expect(savedLabel(now - 7_200_000, now, false)).toBe(
            'Tersimpan · 2 jam lalu',
        );
    });

    it('decides edit rights from the share settings', () => {
        expect(canEdit(undefined, 'me')).toBe(true);
        expect(
            canEdit({ note_id: 'n', access: 'workspace', people: [] }, 'me'),
        ).toBe(true);
        expect(
            canEdit(
                {
                    note_id: 'n',
                    access: 'workspace',
                    people: [{ user_id: 'me', role: 'view' }],
                },
                'me',
            ),
        ).toBe(false);
        expect(
            canEdit({ note_id: 'n', access: 'restricted', people: [] }, 'me'),
        ).toBe(false);
        expect(
            canEdit(
                {
                    note_id: 'n',
                    access: 'restricted',
                    people: [{ user_id: 'me', role: 'edit' }],
                },
                'me',
            ),
        ).toBe(true);
    });

    it('moves simulated carets inside text blocks', () => {
        const blocks: [number, number][] = [
            [1, 20],
            [22, 30],
            [32, 32],
        ];

        for (let tick = 0; tick < 12; tick++) {
            for (const seat of [0, 1]) {
                const position = cursorAt(blocks, tick, seat)!;
                const inside = blocks.some(
                    ([start, end]) => position >= start && position <= end,
                );

                expect(inside).toBe(true);
            }
        }

        expect(cursorAt([], 0, 0)).toBeNull();
    });

    it('describes who is editing', () => {
        expect(editorsLabel([])).toBeNull();
        expect(editorsLabel(['Hana Pratiwi'])).toBe('Hana sedang menyunting');
        expect(editorsLabel(['Hana Pratiwi', 'Dewi Kartika'])).toBe(
            'Hana dan Dewi sedang menyunting',
        );
        expect(editorsLabel(['A', 'B', 'C'])).toBe('3 orang sedang menyunting');
    });
});
