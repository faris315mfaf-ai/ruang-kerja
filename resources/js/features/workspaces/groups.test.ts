import { describe, expect, it } from 'vitest';
import {
    groupCounts,
    groupWorkspaces,
    parseWorkspaceFilter,
    workspaceGroup,
} from './groups';

const ws = [
    { id: 'p', type: 'personal' as const, is_member: true },
    { id: 'd', type: 'division' as const, is_member: true },
    { id: 't', type: 'team' as const, is_member: true },
    { id: 'x', type: 'project' as const, is_member: true },
    { id: 'o', type: 'project' as const, is_member: false },
    { id: 'od', type: 'division' as const, is_member: false },
];

describe('workspace groups', () => {
    it('puts each workspace in one group', () => {
        expect(ws.map(workspaceGroup)).toEqual([
            'pribadi',
            'divisi',
            'divisi',
            'proyek',
            'lainnya',
            'lainnya',
        ]);
        // Sidebar rows carry no is_member: they are always memberships.
        expect(workspaceGroup({ type: 'project' })).toBe('proyek');
    });

    it('orders the sections and keeps empty member sections', () => {
        const sections = groupWorkspaces([ws[0], ws[3]]);

        expect(sections.map((s) => s.group.key)).toEqual([
            'pribadi',
            'divisi',
            'proyek',
        ]);
        expect(sections[1].items).toEqual([]);
        expect(groupWorkspaces(ws).map((s) => s.group.key)).toContain(
            'lainnya',
        );
    });

    it('filters to one section and counts the chips', () => {
        expect(
            groupWorkspaces(ws, 'proyek').map((s) => s.items.map((i) => i.id)),
        ).toEqual([['x']]);
        expect(groupCounts(ws)).toEqual({
            semua: 6,
            pribadi: 1,
            divisi: 2,
            proyek: 1,
            lainnya: 2,
        });
    });

    it('parses the ?jenis= filter', () => {
        expect(parseWorkspaceFilter('proyek')).toBe('proyek');
        expect(parseWorkspaceFilter('apa')).toBe('semua');
        expect(parseWorkspaceFilter(undefined)).toBe('semua');
    });
});
