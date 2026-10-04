import { roleLabel } from '@/lib/roles';
import type { OrgChart, OrgDivision, OrgPerson, OrgTeam } from './types';

/** Accent colors for division cards, assigned by position on the chart. */
export const DIVISION_TONES = [
    { bar: 'border-t-primary', dot: 'bg-primary' },
    { bar: 'border-t-info', dot: 'bg-info' },
    { bar: 'border-t-warning', dot: 'bg-warning' },
    { bar: 'border-t-danger', dot: 'bg-danger' },
    { bar: 'border-t-success', dot: 'bg-success' },
    { bar: 'border-t-accent-blue', dot: 'bg-accent-blue' },
] as const;

export type DivisionTone = (typeof DIVISION_TONES)[number];

export function divisionTone(index: number): DivisionTone {
    const size = DIVISION_TONES.length;

    return DIVISION_TONES[((index % size) + size) % size];
}

/** Lower-cased and stripped of diacritics, for forgiving search. */
export function normalize(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .trim();
}

export function personMatches(person: OrgPerson, query: string): boolean {
    const needle = normalize(query);

    if (needle === '') {
        return true;
    }

    return (
        normalize(person.name).includes(needle) ||
        normalize(person.position ?? '').includes(needle)
    );
}

function unitMatches(name: string, code: string | null, query: string) {
    const needle = normalize(query);

    return (
        normalize(name).includes(needle) ||
        (code !== null && normalize(code) === needle)
    );
}

function filterTeam(team: OrgTeam, query: string): OrgTeam | null {
    if (unitMatches(team.name, team.code, query)) {
        return team;
    }

    const members = team.members.filter((p) => personMatches(p, query));
    const leadMatches = team.lead !== null && personMatches(team.lead, query);

    return members.length > 0 || leadMatches ? { ...team, members } : null;
}

/**
 * The division pruned to what matches `query`: a matching unit (name or exact
 * code) keeps everything; otherwise only matching people (and the units that
 * contain them) remain. Heads and leads stay visible as context. Returns null
 * when nothing inside matches.
 */
export function filterDivision(
    division: OrgDivision,
    query: string,
): OrgDivision | null {
    if (
        normalize(query) === '' ||
        unitMatches(division.name, division.code, query)
    ) {
        return division;
    }

    const teams = division.teams
        .map((team) => filterTeam(team, query))
        .filter((team): team is OrgTeam => team !== null);
    const members = division.members.filter((p) => personMatches(p, query));
    const children = division.children
        .map((child) => filterDivision(child, query))
        .filter((child): child is OrgDivision => child !== null);
    const headMatches =
        division.head !== null && personMatches(division.head, query);

    if (
        !headMatches &&
        teams.length === 0 &&
        members.length === 0 &&
        children.length === 0
    ) {
        return null;
    }

    return { ...division, teams, members, children };
}

export function filterChart(chart: OrgChart, query: string): OrgChart {
    if (normalize(query) === '') {
        return chart;
    }

    return {
        ...chart,
        board: chart.board ? filterDivision(chart.board, query) : null,
        divisions: chart.divisions
            .map((division) => filterDivision(division, query))
            .filter((division): division is OrgDivision => division !== null),
        unassigned: chart.unassigned.filter((p) => personMatches(p, query)),
    };
}

/** True when the (filtered) chart shows nobody and no unit. */
export function isChartEmpty(chart: OrgChart): boolean {
    return (
        chart.board === null &&
        chart.divisions.length === 0 &&
        chart.unassigned.length === 0
    );
}

/**
 * Subtitle under a division head: "Kepala Divisi", plus other notable roles
 * (e.g. "Kepala Divisi · HR"). Board heads show their position instead.
 */
export function headSubtitle(person: OrgPerson, isBoard: boolean): string {
    if (isBoard) {
        return person.position ?? 'Direksi';
    }

    const extra = person.roles
        .filter((role) => role === 'hr' || role === 'super_admin')
        .map(roleLabel);

    return ['Kepala Divisi', ...extra].join(' · ');
}

/** "Tanpa tim", "1 tim", "3 tim". */
export function teamCountLabel(count: number): string {
    return count === 0 ? 'Tanpa tim' : `${count} tim`;
}

/** Everyone listed under a division: head, team leads & members, loose members. */
export function divisionPeople(division: OrgDivision): OrgPerson[] {
    const people = new Map<string, OrgPerson>();
    const add = (person: OrgPerson | null) => {
        if (person) {
            people.set(person.id, person);
        }
    };

    add(division.head);
    division.teams.forEach((team) => {
        add(team.lead);
        team.members.forEach(add);
    });
    division.members.forEach(add);

    return [...people.values()];
}
