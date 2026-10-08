import type { Participant, Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { postKeepalive, videoApi } from './api';
import { speakingTotals } from './contract';
import type { TalkState, TalkTotals } from './talk-time';
import { mergeTotals, recordSpeakers, startTalk, totalsAt } from './talk-time';
import type { SpeakingTotals } from './types';

/**
 * "Waktu bicara" outside React state, so speaker events and server totals do
 * not re-render the room (audit §4): this browser counts everyone it hears
 * from LiveKit's active-speaker events, the server totals arrive from the
 * report response / realtime / polling, and only the panel that shows the
 * bars subscribes (useTalkTotals).
 */
export class TalkStore {
    private state: TalkState;
    private server: TalkTotals;
    private base: number;
    private listeners = new Set<() => void>();
    silent: string[];
    version = 0;

    constructor(
        private readonly me: string,
        initial: SpeakingTotals | null,
    ) {
        this.state = startTalk(Date.now());
        this.server = speakingTotals(initial);
        this.base = initial?.mine_ms ?? 0;
        this.silent = initial?.silent ?? [];
    }

    subscribe = (listener: () => void) => {
        this.listeners.add(listener);

        return () => this.listeners.delete(listener);
    };

    snapshot = () => this.version;

    private emit() {
        this.version += 1;
        this.listeners.forEach((listener) => listener());
    }

    record(speakers: string[], now: number) {
        this.state = recordSpeakers(this.state, speakers, now);
        this.emit();
    }

    apply = (totals: SpeakingTotals) => {
        this.server = speakingTotals(totals);
        this.silent = totals.silent;
        this.emit();
    };

    /** My own total: stored value + what this browser counted since joining. */
    mine(now: number): number {
        return this.base + (totalsAt(this.state, now)[this.me] ?? 0);
    }

    /** Server and local counts merged (largest per person). */
    totals(now: number): TalkTotals {
        return mergeTotals(this.server, {
            ...totalsAt(this.state, now),
            [this.me]: this.mine(now),
        });
    }

    /** Someone is speaking right now (the bars move). */
    get live(): boolean {
        return this.state.speaking.length > 0;
    }
}

/**
 * Feeds the store from LiveKit and reports my own total to the server
 * (contract §3.2: every `interval_seconds` and once on leave).
 */
export function useTalkReporting({
    store,
    room,
    reportUrl,
    canReport,
    connected,
    intervalSeconds,
}: {
    store: TalkStore;
    room: Room;
    reportUrl: string | null;
    canReport: boolean;
    connected: boolean;
    intervalSeconds: number;
}) {
    useEffect(() => {
        const onSpeakers = (speakers: Participant[]) =>
            store.record(
                speakers.map((participant) => participant.identity),
                Date.now(),
            );

        room.on(RoomEvent.ActiveSpeakersChanged, onSpeakers);

        return () => {
            room.off(RoomEvent.ActiveSpeakersChanged, onSpeakers);
        };
    }, [room, store]);

    useEffect(() => {
        if (!connected || !reportUrl || !canReport) {
            return;
        }

        const report = () =>
            videoApi
                .reportSpeaking(reportUrl, store.mine(Date.now()))
                .then(store.apply)
                .catch(() => undefined);

        void report();
        const id = window.setInterval(
            () => void report(),
            Math.max(10, intervalSeconds) * 1000,
        );
        const onHide = () =>
            void postKeepalive(reportUrl, {
                ms: Math.round(store.mine(Date.now())),
            });

        window.addEventListener('pagehide', onHide);

        return () => {
            window.clearInterval(id);
            window.removeEventListener('pagehide', onHide);
            onHide();
        };
    }, [connected, reportUrl, canReport, intervalSeconds, store]);
}

/**
 * Totals for display, refreshed when the store changes and once a second
 * while someone is speaking (throttled bars instead of per-event renders).
 */
export function useTalkTotals(store: TalkStore): {
    totals: TalkTotals;
    silent: string[];
} {
    useSyncExternalStore(store.subscribe, store.snapshot);
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const id = window.setInterval(() => {
            if (store.live) {
                setNow(Date.now());
            }
        }, 1000);

        return () => window.clearInterval(id);
    }, [store]);

    return {
        totals: store.totals(Math.max(now, Date.now())),
        silent: store.silent,
    };
}
