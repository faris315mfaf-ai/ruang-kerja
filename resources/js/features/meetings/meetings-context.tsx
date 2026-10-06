import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Person, PersonId } from './types';

type MeetingsContextValue = {
    /** People the page refers to (organizer, participants, assignees …). */
    people: Person[];
    /** The signed-in viewer. */
    me: PersonId;
};

const MeetingsContext = createContext<MeetingsContextValue>({
    people: [],
    me: '',
});

/**
 * People and viewer of a meetings page (server props), so rows, pickers and
 * notices can resolve names without passing them through every component.
 */
export function MeetingsProvider({
    people,
    me,
    children,
}: MeetingsContextValue & { children: ReactNode }) {
    const value = useMemo(() => ({ people, me }), [people, me]);

    return (
        <MeetingsContext.Provider value={value}>
            {children}
        </MeetingsContext.Provider>
    );
}

export function useMeetingsContext(): MeetingsContextValue {
    return useContext(MeetingsContext);
}

/** Current time, refreshed every 15 seconds (countdowns, "berlangsung"). */
export function useNow(intervalMs = 15_000): number {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), intervalMs);

        return () => window.clearInterval(id);
    }, [intervalMs]);

    return now;
}
