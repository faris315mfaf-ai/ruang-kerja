import type { Participant, Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { useEffect, useRef, useState } from 'react';
import { postKeepalive, videoApi } from './api';
import { speakingTotals } from './contract';
import type { TalkState, TalkTotals } from './talk-time';
import { mergeTotals, recordSpeakers, startTalk, totalsAt } from './talk-time';
import type { SpeakingTotals } from './types';

/**
 * "Waktu bicara" of the room. This browser counts everyone it hears from
 * LiveKit's active-speaker events (live bars), reports only its own total to
 * the server (contract §3.2, every `interval_seconds` and once on leave) and
 * shows the larger of the server's and its own count per person, so people
 * who spoke before this browser joined are not shown as silent.
 */
export function useTalkTime({
    room,
    me,
    initial,
    reportUrl,
    canReport,
    connected,
}: {
    room: Room;
    me: string;
    initial: SpeakingTotals | null;
    reportUrl: string | null;
    canReport: boolean;
    connected: boolean;
}) {
    const state = useRef<TalkState>(startTalk(Date.now()));
    const base = useRef(initial?.mine_ms ?? 0);
    const [server, setServer] = useState<TalkTotals>(() =>
        speakingTotals(initial),
    );
    const [silent, setSilent] = useState<string[]>(initial?.silent ?? []);
    const [now, setNow] = useState(() => Date.now());
    const interval = Math.max(10, initial?.interval_seconds ?? 15) * 1000;

    const mine = (at: number) =>
        base.current + (totalsAt(state.current, at)[me] ?? 0);

    const apply = (totals: SpeakingTotals) => {
        setServer(speakingTotals(totals));
        setSilent(totals.silent);
    };

    useEffect(() => {
        const onSpeakers = (speakers: Participant[]) => {
            state.current = recordSpeakers(
                state.current,
                speakers.map((participant) => participant.identity),
                Date.now(),
            );
        };

        room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);
        const tick = window.setInterval(() => setNow(Date.now()), 1000);

        return () => {
            room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
            window.clearInterval(tick);
        };
    }, [room]);

    // Report my own total while connected, and once more when leaving.
    useEffect(() => {
        if (!connected || !reportUrl || !canReport) {
            return;
        }

        const report = () =>
            videoApi
                .reportSpeaking(reportUrl, mine(Date.now()))
                .then(apply)
                .catch(() => undefined);

        void report();
        const id = window.setInterval(() => void report(), interval);
        const onHide = () =>
            void postKeepalive(reportUrl, { ms: Math.round(mine(Date.now())) });

        window.addEventListener('pagehide', onHide);

        return () => {
            window.clearInterval(id);
            window.removeEventListener('pagehide', onHide);
            onHide();
        };
        // `mine` reads refs only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [connected, reportUrl, canReport, interval]);

    const local = totalsAt(state.current, now);
    const totals = mergeTotals(server, {
        ...local,
        [me]: mine(now),
    });

    return { totals, silent, apply };
}
