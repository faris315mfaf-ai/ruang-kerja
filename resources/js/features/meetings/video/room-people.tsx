import type { ReactNode } from 'react';
import { createContext, useContext, useMemo } from 'react';
import { isGuestIdentity, stripGuestSuffix } from '../guests/lib';
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
    /** External guest (identity `guest:…`): shown with a "Tamu" badge. */
    guest: boolean;
    /** Name without the " (Tamu)" suffix (avatar initials). */
    plain_name: string;
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
              guest: false,
              plain_name: person.name,
          }
        : {
              id: identity,
              name: UNKNOWN_GUEST,
              first_name: UNKNOWN_GUEST,
              avatar_url: null,
              seat: 9,
              known: false,
              guest: false,
              plain_name: UNKNOWN_GUEST,
          };
}

/**
 * Who a LiveKit participant is. Guests (identity `guest:…`) and, in the guest
 * view, everybody else are named by `participant.name`: the server signs it
 * into the token and nobody has `canUpdateOwnMetadata`, so it cannot be
 * forged (audit R-05). Employees seen by employees still come from the
 * server's participant list.
 */
export function personOfParticipant(
    people: Map<string, RoomParticipant>,
    participant: { identity: string; name?: string },
    guestView: boolean,
): RoomPerson {
    if (isGuestIdentity(participant.identity)) {
        const plain = stripGuestSuffix(participant.name ?? '') || 'Tamu';

        return {
            id: participant.identity,
            name: `${plain} (Tamu)`,
            first_name: plain.split(' ')[0] ?? plain,
            avatar_url: null,
            seat: 8,
            known: true,
            guest: true,
            plain_name: plain,
        };
    }

    if (guestView) {
        const name = participant.name?.trim() || 'Peserta';

        return {
            id: participant.identity,
            name,
            first_name: name.split(' ')[0] ?? name,
            avatar_url: null,
            seat: 0,
            known: true,
            guest: false,
            plain_name: name,
        };
    }

    return resolvePerson(people, participant.identity);
}

/** True inside the external guest's room (names come from LiveKit). */
const GuestViewContext = createContext(false);

export function GuestViewProvider({ children }: { children: ReactNode }) {
    return (
        <GuestViewContext.Provider value={true}>
            {children}
        </GuestViewContext.Provider>
    );
}

export function useParticipantPerson(participant: {
    identity: string;
    name?: string;
}): RoomPerson {
    return personOfParticipant(
        useRoomPeople(),
        participant,
        useContext(GuestViewContext),
    );
}

export function useIsGuestView(): boolean {
    return useContext(GuestViewContext);
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
