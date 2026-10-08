import type { Room as LiveRoom } from 'livekit-client';
import type { MutableRefObject, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { MeetingsProvider } from '../meetings-context';
import type { Minutes } from '../types';
import type { MinutesData } from '../use-minutes';
import { useMinutes } from '../use-minutes';
import type { Room } from './contract';
import { minutesPropsFor } from './contract';
import type { RoomMinutes } from './types';
import type { MinutesCollab } from './use-minutes-collab';
import { useMinutesCollab } from './use-minutes-collab';
import { nudgeMinutes } from './use-room-live';

export type MinutesSync = MutableRefObject<((minutes: Minutes) => void) | null>;

type Value = { data: MinutesData | null; collab: MinutesCollab };

const MinutesContext = createContext<Value>({
    data: null,
    collab: { mode: 'off' },
});

/** The room's minutes (only the document, navigator and quick add read it). */
export function useRoomMinutes(): Value {
    return useContext(MinutesContext);
}

/** What other people need to refetch for (content saves are covered by saved_at). */
function itemsSignature(minutes: Minutes): string {
    return minutes.action_items
        .map(
            (item) =>
                `${item.id}:${item.text}:${item.assignee_id}:${item.due_date}:${item.done}:${item.task_key}`,
        )
        .join('|');
}

function Host({
    room,
    minutes,
    live,
    syncRef,
    children,
}: {
    room: Room;
    minutes: RoomMinutes;
    live: LiveRoom;
    syncRef: MinutesSync;
    children: ReactNode;
}) {
    // useMinutes reads its props once (initial state); identity is enough.
    const props = useMemo(
        () => minutesPropsFor(room, minutes),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [minutes.doc.meeting_key],
    );
    const data = useMinutes(props);
    const me = room.participants.find((p) => p.id === room.viewer.id);
    const collab = useMinutesCollab(
        room.features.collab_minutes && minutes.mode === 'collab'
            ? minutes.collab
            : null,
        { id: room.viewer.id, name: room.viewer.name, seat: me?.seat ?? 0 },
        data.minutes.saved_at,
    );
    const fromServer = useRef<string | null>(null);
    const date = room.meeting.occurrence_date;

    syncRef.current = (next: Minutes) => {
        fromServer.current = `${next.saved_at}#${itemsSignature(next)}`;
        data.syncFromServer(next);
    };

    // After my own change is stored, nudge everyone in the room to refetch.
    const signature = `${data.minutes.saved_at}#${itemsSignature(data.minutes)}`;

    useEffect(() => {
        if (data.readOnly || signature === fromServer.current) {
            return;
        }

        const id = window.setTimeout(() => nudgeMinutes(live, date), 1200);

        return () => window.clearTimeout(id);
    }, [signature, data.readOnly, live, date]);

    return (
        <MeetingsProvider people={room.people} me={room.viewer.id}>
            <MinutesContext.Provider value={{ data, collab }}>
                {children}
            </MinutesContext.Provider>
        </MeetingsProvider>
    );
}

/**
 * Provides the room's minutes through the existing minutes editor hook
 * (features/meetings/use-minutes) as context: typing re-renders only the
 * consumers (document, navigator), not the video around them. `data` is
 * null when the server sends no minutes for the room (older backend).
 */
export function MinutesProvider({
    room,
    live,
    syncRef,
    children,
}: {
    room: Room;
    live: LiveRoom;
    syncRef: MinutesSync;
    children: ReactNode;
}) {
    if (!room.minutes) {
        return <>{children}</>;
    }

    return (
        <Host room={room} minutes={room.minutes} live={live} syncRef={syncRef}>
            {children}
        </Host>
    );
}
