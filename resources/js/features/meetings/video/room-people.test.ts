import { describe, expect, it } from 'vitest';
import { resolvePerson, UNKNOWN_GUEST } from './room-people';
import type { RoomParticipant } from './types';

const sari = {
    id: '01HZSARI0000000000000000AA',
    name: 'Sari Wulandari',
    first_name: 'Sari',
    initials: 'SW',
    title: 'Notulis',
    division: 'Operasional',
    avatar_url: null,
    tone: 'teal',
    seat: 1,
    roles: ['minute_taker'],
    role_label: 'Notulis',
    rsvp: 'yes',
    optional: false,
} satisfies RoomParticipant;

describe('resolvePerson (audit R-05)', () => {
    const people = new Map([[sari.id, sari]]);

    it('takes the name from the server list by identity, never from LiveKit', () => {
        expect(resolvePerson(people, sari.id)).toMatchObject({
            name: 'Sari Wulandari',
            first_name: 'Sari',
            seat: 1,
            known: true,
        });
    });

    it('flags identities that are not invited employees', () => {
        expect(resolvePerson(people, 'Direktur Utama')).toMatchObject({
            name: UNKNOWN_GUEST,
            first_name: UNKNOWN_GUEST,
            avatar_url: null,
            known: false,
        });
    });
});
