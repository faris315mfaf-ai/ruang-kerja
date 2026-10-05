import { describe, expect, it } from 'vitest';
import type { OrgChart, OrgDivision, OrgPerson } from './types';
import {
    divisionPeople,
    divisionTone,
    filterChart,
    filterDivision,
    headSubtitle,
    isChartEmpty,
    normalize,
    personMatches,
    teamCountLabel,
} from './utils';

function person(name: string, extra: Partial<OrgPerson> = {}): OrgPerson {
    return {
        id: name,
        name,
        avatar: null,
        position: 'Staf',
        level: 5,
        managerId: null,
        roles: [],
        ...extra,
    };
}

function division(extra: Partial<OrgDivision> = {}): OrgDivision {
    return {
        id: 'ops',
        name: 'Operasional',
        code: 'OPS',
        isBoard: false,
        head: person('Dimas Pratama', { position: 'Kepala Divisi' }),
        teams: [
            {
                id: 'gdg',
                name: 'Tim Gudang',
                code: 'GDG',
                lead: person('Sari Wulandari'),
                members: [person('Nadia Putri'), person('Yoga Pratama')],
                size: 3,
            },
        ],
        members: [person('Bayu Saputra'), person('Rizky Aditya')],
        size: 6,
        children: [],
        ...extra,
    };
}

const chart: OrgChart = {
    companyName: 'PT Contoh',
    board: division({
        id: 'dir',
        name: 'Direksi',
        code: 'DIR',
        isBoard: true,
        head: person('Hendra Wijaya', { position: 'Direktur Utama' }),
        teams: [],
        members: [person('Lestari Anggraini')],
    }),
    divisions: [
        division(),
        division({
            id: 'keu',
            name: 'Keuangan',
            code: 'KEU',
            head: null,
            teams: [],
            members: [person('Fitri Handayani')],
        }),
    ],
    unassigned: [person('Admin Sistem')],
    stats: { divisions: 2, teams: 1, people: 10 },
};

describe('normalize & personMatches', () => {
    it('ignores case and diacritics', () => {
        expect(normalize('  Séno ')).toBe('seno');
        expect(personMatches(person('Séno'), 'SENO')).toBe(true);
    });

    it('matches on position too', () => {
        expect(
            personMatches(person('Ani', { position: 'Staf Gudang' }), 'gudang'),
        ).toBe(true);
        expect(personMatches(person('Ani', { position: null }), 'gudang')).toBe(
            false,
        );
    });

    it('matches everyone on an empty query', () => {
        expect(personMatches(person('Ani'), '  ')).toBe(true);
    });
});

describe('filterDivision', () => {
    it('keeps the whole division when its name or exact code matches', () => {
        expect(filterDivision(division(), 'operas')).toEqual(division());
        expect(filterDivision(division(), 'ops')).toEqual(division());
    });

    it('prunes to matching people and keeps their team', () => {
        const result = filterDivision(division(), 'nadia');

        expect(result?.members).toEqual([]);
        expect(result?.teams).toHaveLength(1);
        expect(result?.teams[0].members.map((p) => p.name)).toEqual([
            'Nadia Putri',
        ]);
    });

    it('keeps a team whose lead matches', () => {
        const result = filterDivision(division(), 'sari');

        expect(result?.teams[0].lead?.name).toBe('Sari Wulandari');
        expect(result?.teams[0].members).toEqual([]);
    });

    it('returns null when nothing matches', () => {
        expect(filterDivision(division(), 'zzz')).toBeNull();
    });

    it('searches sub-divisions', () => {
        const parent = division({
            id: 'p',
            name: 'Induk',
            code: 'IND',
            head: null,
            teams: [],
            members: [],
            children: [division()],
        });

        expect(
            filterDivision(parent, 'bayu')?.children[0].members.map(
                (p) => p.name,
            ),
        ).toEqual(['Bayu Saputra']);
    });
});

describe('filterChart', () => {
    it('returns the same chart for an empty query', () => {
        expect(filterChart(chart, '')).toBe(chart);
    });

    it('filters board, divisions and unassigned people', () => {
        const result = filterChart(chart, 'fitri');

        expect(result.board).toBeNull();
        expect(result.divisions.map((d) => d.code)).toEqual(['KEU']);
        expect(result.unassigned).toEqual([]);
        expect(isChartEmpty(result)).toBe(false);
        expect(isChartEmpty(filterChart(chart, 'tidak ada'))).toBe(true);
    });

    it('finds people outside any division', () => {
        expect(
            filterChart(chart, 'admin').unassigned.map((p) => p.name),
        ).toEqual(['Admin Sistem']);
    });
});

describe('labels', () => {
    it('describes division heads with notable roles', () => {
        expect(
            headSubtitle(
                person('Hana', { roles: ['kepala_divisi', 'hr'] }),
                false,
            ),
        ).toBe('Kepala Divisi · HR');
        expect(
            headSubtitle(person('Dimas', { roles: ['kepala_divisi'] }), false),
        ).toBe('Kepala Divisi');
        expect(
            headSubtitle(
                person('Hendra', { position: 'Direktur Utama' }),
                true,
            ),
        ).toBe('Direktur Utama');
    });

    it('labels team counts', () => {
        expect(teamCountLabel(0)).toBe('Tanpa tim');
        expect(teamCountLabel(2)).toBe('2 tim');
    });

    it('cycles division tones', () => {
        expect(divisionTone(0).bar).toBe('border-t-primary');
        expect(divisionTone(6)).toEqual(divisionTone(0));
    });

    it('lists everyone in a division once', () => {
        expect(divisionPeople(division()).map((p) => p.name)).toEqual([
            'Dimas Pratama',
            'Sari Wulandari',
            'Nadia Putri',
            'Yoga Pratama',
            'Bayu Saputra',
            'Rizky Aditya',
        ]);
    });
});
