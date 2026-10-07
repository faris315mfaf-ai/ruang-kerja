import { describe, expect, it } from 'vitest';
import { filterPeople, personStatus } from './lib';
import type { DisciplinePerson } from './types';

const person = (
    name: string,
    extra: Partial<DisciplinePerson> = {},
): DisciplinePerson => ({
    user: { id: name, name, avatar: null, division: 'Operasional' },
    scheduled: 10,
    on_time: 10,
    discipline: 100,
    late_days: 0,
    average_late: null,
    absent_days: 0,
    ...extra,
});

describe('personStatus', () => {
    it('describes alpha and late days with a tone', () => {
        expect(
            personStatus(person('A', { absent_days: 2, late_days: 3 })),
        ).toEqual({
            label: '2 alpha · 3× terlambat',
            tone: 'danger',
        });
        expect(personStatus(person('B', { late_days: 1 }))).toEqual({
            label: '1× terlambat',
            tone: 'warning',
        });
        expect(personStatus(person('C'))).toEqual({
            label: 'Tepat waktu',
            tone: 'success',
        });
        expect(
            personStatus(person('D', { scheduled: 0, discipline: null })),
        ).toEqual({
            label: 'Belum ada hari kerja',
            tone: 'neutral',
        });
    });
});

describe('filterPeople', () => {
    const people = [
        person('Rizky', { late_days: 2, discipline: 80 }),
        person('Sari', { absent_days: 1, discipline: 90 }),
        person('Budi', { discipline: 70 }),
        person('Maya', {
            user: { id: 'm', name: 'Maya', avatar: null, division: 'Keuangan' },
        }),
    ];

    it('keeps people needing attention (alpha, late, or below 80%)', () => {
        expect(
            filterPeople(people, 'issues', '').map((p) => p.user.name),
        ).toEqual(['Rizky', 'Sari', 'Budi']);
        expect(
            filterPeople(people, 'absent', '').map((p) => p.user.name),
        ).toEqual(['Sari']);
        expect(
            filterPeople(people, 'late', '').map((p) => p.user.name),
        ).toEqual(['Rizky']);
        expect(filterPeople(people, 'all', '')).toHaveLength(4);
    });

    it('searches names and divisions', () => {
        expect(
            filterPeople(people, 'all', 'keuangan').map((p) => p.user.name),
        ).toEqual(['Maya']);
        expect(
            filterPeople(people, 'all', ' RIZ ').map((p) => p.user.name),
        ).toEqual(['Rizky']);
    });
});
