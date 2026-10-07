import type { DisciplinePerson } from './types';

export type PersonFilter = 'all' | 'issues' | 'absent' | 'late';

/** Below this rate a person is flagged in the table (warning tone). */
export const LOW_DISCIPLINE = 80;

/**
 * Short status of a person for the list ("2 alpha · 3× terlambat",
 * "Tepat waktu", "Belum ada hari kerja") with its tone.
 */
export function personStatus(person: DisciplinePerson): {
    label: string;
    tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
    if (person.scheduled === 0) {
        return { label: 'Belum ada hari kerja', tone: 'neutral' };
    }

    const parts: string[] = [];

    if (person.absent_days > 0) {
        parts.push(`${person.absent_days} alpha`);
    }

    if (person.late_days > 0) {
        parts.push(`${person.late_days}× terlambat`);
    }

    if (parts.length === 0) {
        return { label: 'Tepat waktu', tone: 'success' };
    }

    return {
        label: parts.join(' · '),
        tone: person.absent_days > 0 ? 'danger' : 'warning',
    };
}

/** People matching the chip and the name/division search (case-insensitive). */
export function filterPeople(
    people: DisciplinePerson[],
    filter: PersonFilter,
    query: string,
): DisciplinePerson[] {
    const needle = query.trim().toLocaleLowerCase('id-ID');

    return people.filter((person) => {
        const matchesFilter =
            filter === 'all' ||
            (filter === 'absent' && person.absent_days > 0) ||
            (filter === 'late' && person.late_days > 0) ||
            (filter === 'issues' &&
                (person.absent_days > 0 ||
                    person.late_days > 0 ||
                    (person.discipline !== null &&
                        person.discipline < LOW_DISCIPLINE)));

        if (!matchesFilter) {
            return false;
        }

        if (needle === '') {
            return true;
        }

        return [person.user.name, person.user.division ?? '']
            .join(' ')
            .toLocaleLowerCase('id-ID')
            .includes(needle);
    });
}
