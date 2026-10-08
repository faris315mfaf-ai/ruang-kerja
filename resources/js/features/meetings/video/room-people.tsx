import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import type { RoomParticipant } from './types';

/** Shown for a LiveKit identity that is not an invited employee (audit R-05). */
export const UNKNOWN_GUEST = 'Tamu tak dikenal';

export type RoomPerson = {
    id: string;
    name: string;
    first_name: string;
    avatar_url: string | null;
    seat: number;
    /** false: identity not in the server's participant list (flag it). */
    known: boolean;
};

/**
 * Who someone is, from the server's `participants` by LiveKit identity
 * (= user ULID). Never from `participant.name`/metadata: those can be changed
 * by the participant (canUpdateOwnMetadata), audit R-05.
 */
export function resolvePerson(
    people: Map<string, RoomParticipant>,
    identity: string,
): RoomPerson {
    const person = people.get(identity);

    return person
        ? {
              id: person.id,
              name: person.name,
              first_name: person.first_name,
              avatar_url: person.avatar_url ?? null,
              seat: person.seat,
              known: true,
          }
        : {
              id: identity,
              name: UNKNOWN_GUEST,
              first_name: UNKNOWN_GUEST,
              avatar_url: null,
              seat: 9,
              known: false,
          };
}

const PeopleContext = createContext<Map<string, RoomParticipant>>(new Map());

export function RoomPeopleProvider({
    participants,
    children,
}: {
    participants: RoomParticipant[];
    children: ReactNode;
}) {
    const map = useMemo(
        () => new Map(participants.map((p) => [p.id, p])),
        [participants],
    );

    return (
        <PeopleContext.Provider value={map}>{children}</PeopleContext.Provider>
    );
}

export function useRoomPeople(): Map<string, RoomParticipant> {
    return useContext(PeopleContext);
}

export function useRoomPerson(identity: string): RoomPerson {
    return resolvePerson(useRoomPeople(), identity);
}
