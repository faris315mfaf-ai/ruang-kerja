import { describe, expect, it } from 'vitest';
import {
    ancestors,
    buildTree,
    childCounts,
    connectedLabel,
    docText,
    documentRoot,
    documentTabs,
    editorsLabel,
    flattenTree,
    nextTabTitle,
    parentOptions,
    savedLabel,
    savePhase,
    subtreeIds,
    toneFor,
    wordCount,
} from './lib';
import type { Note } from './types';

function row(
    id: string,
    parent: string | null,
    position: string,
    kind: Note['kind'] = 'note',
): Note {
    return {
        id,
        workspace_id: 'w',
        parent_id: parent,
        kind,
        preset: null,
        title: id,
        access: 'workspace',
        created_by: 'u',
        updated_by: 'u',
        position,
        created_at: null,
        updated_at: null,
    };
}

const notes: Note[] = [
    row('sop', null, 'b'),
    row('arsip', null, 'c', 'folder'),
    row('drafts', 'arsip', 'a', 'folder'),
    row('lama', 'arsip', 'b'),
    row('checklist', 'sop', 'a'),
    row('akun', 'sop', 'b'),
    row('yatim', 'hilang', 'a'),
];

describe('buildTree', () => {
    it('puts folders above notes, then the manual order', () => {
        const tree = buildTree(notes);

        expect(tree.map((node) => node.note.id)).toEqual([
            'arsip',
            'yatim',
            'sop',
        ]);
        expect(tree[0].children.map((node) => node.note.id)).toEqual([
            'drafts',
            'lama',
        ]);
        expect(tree[2].children.map((node) => node.depth)).toEqual([1, 1]);
    });

    it('keeps matches with their ancestors', () => {
        const tree = buildTree(notes, new Set(['akun']));

        expect(flattenTree(tree).map((node) => node.note.id)).toEqual([
            'sop',
            'akun',
        ]);
        expect(buildTree(notes, new Set())).toEqual([]);
    });

    it('skips children of collapsed rows', () => {
        expect(
            flattenTree(buildTree(notes), new Set(['sop', 'arsip'])).map(
                (node) => node.note.id,
            ),
        ).toEqual(['arsip', 'yatim', 'sop']);
    });
});

describe('tree helpers', () => {
    it('finds ancestors from the root and stops on cycles', () => {
        expect(ancestors(notes, 'akun').map((note) => note.id)).toEqual([
            'sop',
        ]);
        expect(
            ancestors([row('a', 'b', 'a'), row('b', 'a', 'a')], 'a').length,
        ).toBeLessThanOrEqual(2);
    });

    it('collects a subtree', () => {
        expect([...subtreeIds(notes, 'arsip')].sort()).toEqual([
            'arsip',
            'drafts',
            'lama',
        ]);
    });

    it('offers only valid parents', () => {
        expect(
            parentOptions(notes, 'folder', 'drafts').map((note) => note.id),
        ).toEqual(['arsip']);
        expect(
            parentOptions(notes, 'note', 'sop').map((note) => note.id),
        ).toEqual(['arsip', 'drafts', 'lama', 'yatim']);
    });

    it('counts children', () => {
        expect(childCounts(notes).get('arsip')).toBe(2);
        expect(childCounts(notes).get('lama')).toBeUndefined();
    });
});

describe('labels', () => {
    it('describes the save state', () => {
        expect(savedLabel(null, 0, true)).toBe('Menyimpan…');
        expect(savedLabel(null, 0, false)).toBe('Tersimpan');
        expect(savedLabel(1000, 1500, false)).toBe('Tersimpan · baru saja');
        expect(savedLabel(0, 12_000, false)).toBe('Tersimpan · 12 dtk lalu');
        expect(savedLabel(0, 180_000, false)).toBe('Tersimpan · 3 mnt lalu');
        expect(savedLabel(0, 7_200_000, false)).toBe('Tersimpan · 2 jam lalu');
    });

    it('names co-editors', () => {
        expect(editorsLabel([])).toBeNull();
        expect(editorsLabel(['Hana Pratiwi'])).toBe('Hana sedang menyunting');
        expect(editorsLabel(['Hana Pratiwi', 'Dewi Kartika'])).toBe(
            'Hana dan Dewi sedang menyunting',
        );
        expect(editorsLabel(['A', 'B', 'C'])).toBe('3 orang sedang menyunting');
        expect(connectedLabel(2)).toBe('Tersambung · 3 orang');
    });

    it('gives a person a stable colour seat', () => {
        expect(toneFor('01jbbb', 4)).toBe(toneFor('01jbbb', 4));
        expect(toneFor('x', 4)).toBeGreaterThanOrEqual(0);
        expect(toneFor('x', 4)).toBeLessThan(4);
    });

    it('counts words of a document', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Satu dua' }],
                },
                {
                    type: 'heading',
                    content: [{ type: 'text', text: 'tiga' }],
                },
            ],
        };

        expect(docText(doc)).toBe('Satu dua\ntiga\n');
        expect(wordCount(doc)).toBe(3);
        expect(wordCount(null)).toBe(0);
    });
});

describe('document tabs (Notulensi)', () => {
    const doc: Note[] = [
        row('folder', null, 'a', 'folder'),
        row('rapat', 'folder', 'b'),
        row('tab-b', 'rapat', 'c'),
        row('tab-a', 'rapat', 'b'),
        row('sub-1', 'tab-a', 'a'),
        row('deep', 'sub-1', 'a'),
        row('arsip', 'rapat', 'd', 'folder'),
    ];

    it('finds the top note of the document, never a folder', () => {
        expect(documentRoot(doc, 'deep')?.id).toBe('rapat');
        expect(documentRoot(doc, 'tab-b')?.id).toBe('rapat');
        expect(documentRoot(doc, 'rapat')?.id).toBe('rapat');
        expect(documentRoot(doc, 'nope')).toBeUndefined();
    });

    it('lists the document, its tabs in order and their sub-tabs', () => {
        expect(
            documentTabs(doc, 'rapat').map((tab) => [
                tab.note.id,
                tab.level,
                tab.tabId,
            ]),
        ).toEqual([
            ['rapat', 0, 'rapat'],
            ['tab-a', 0, 'tab-a'],
            ['sub-1', 1, 'tab-a'],
            ['tab-b', 0, 'tab-b'],
        ]);
        expect(documentTabs(doc, 'nope')).toEqual([]);
    });

    it('names new tabs and sub-tabs', () => {
        const tabs = documentTabs(doc, 'rapat');

        expect(nextTabTitle(tabs, 'rapat', 'rapat')).toBe('Tab 4');
        expect(nextTabTitle(tabs, 'tab-a', 'rapat')).toBe('Sub-tab 2');
        expect(nextTabTitle(tabs, 'tab-b', 'rapat')).toBe('Sub-tab 1');
    });
});

describe('savePhase', () => {
    const base = {
        conflict: false,
        mode: 'live' as const,
        saving: false,
        connected: true,
    };

    it('spinner while connecting, saving or reconnecting', () => {
        expect(savePhase({ ...base, mode: 'connecting' })).toBe('syncing');
        expect(savePhase({ ...base, saving: true })).toBe('syncing');
        expect(savePhase({ ...base, connected: false })).toBe('syncing');
    });

    it('check-cloud once saved on a live connection', () => {
        expect(savePhase(base)).toBe('saved');
    });

    it('triangle for offline mode (also while it is saving)', () => {
        expect(savePhase({ ...base, mode: 'offline', connected: false })).toBe(
            'offline',
        );
        expect(savePhase({ ...base, mode: 'offline', saving: true })).toBe(
            'syncing',
        );
    });

    it('conflict wins over everything', () => {
        expect(savePhase({ ...base, conflict: true, saving: true })).toBe(
            'conflict',
        );
        expect(savePhase({ ...base, conflict: true, mode: 'offline' })).toBe(
            'conflict',
        );
    });
});
