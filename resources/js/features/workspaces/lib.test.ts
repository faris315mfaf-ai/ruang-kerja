import { describe, expect, it } from 'vite-plus/test';

import { groupByType, workspaceInitial, workspaceMeta } from './lib';

describe('workspaceInitial', () => {
    it('skips the type word like the mockups', () => {
        expect(workspaceInitial('Divisi Operasional', 'division')).toBe('O');
        expect(workspaceInitial('Tim Gudang', 'team')).toBe('G');
        expect(workspaceInitial('Proyek Peluncuran Q4', 'project')).toBe('P');
        expect(workspaceInitial('Direksi', 'division')).toBe('D');
        expect(workspaceInitial('Pribadi', 'personal', 'Dimas Pratama')).toBe(
            'D',
        );
        expect(workspaceInitial('tim', 'team')).toBe('T');
    });
});

describe('groupByType', () => {
    it('orders groups Pribadi, Divisi, Tim, Proyek and drops empty ones', () => {
        const groups = groupByType([
            { id: 'p', type: 'project' as const },
            { id: 'me', type: 'personal' as const },
            { id: 'o', type: 'division' as const },
        ]);

        expect(groups.map((group) => group.type)).toEqual([
            'personal',
            'division',
            'project',
        ]);
    });
});

describe('workspaceMeta', () => {
    it('builds the header line', () => {
        expect(
            workspaceMeta({
                key: 'PLQ',
                type: 'project',
                type_label: 'Proyek',
                visibility: 'internal',
                members_count: 9,
                divisions_count: 3,
            }),
        ).toBe('PLQ · Proyek · Internal · 9 anggota dari 3 divisi');
        expect(
            workspaceMeta({
                key: 'DP',
                type: 'personal',
                type_label: 'Pribadi',
                visibility: 'private',
                members_count: 1,
                divisions_count: 1,
            }),
        ).toBe('DP · Pribadi · Private');
    });
});
