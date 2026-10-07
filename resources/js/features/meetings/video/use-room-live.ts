import { echo, echoIsConfigured } from '@laravel/echo-react';
import type { Room } from 'livekit-client';
import { RoomEvent } from 'livekit-client';
import { useEffect, useRef } from 'react';
import type { Minutes } from '../types';
import type { AttendanceRoster } from './api';
import { videoApi } from './api';
import type { SpeakingTotals } from './types';

/** LiveKit data topic: "I just saved the minutes" (instant refresh). */
export const MINUTES_TOPIC = 'rk.minutes';

const encoder = new TextEncoder();

/** Tell everyone in the room the minutes changed (no content, just a nudge). */
export function nudgeMinutes(room: Room, date: string): void {
    void room.localParticipant
        .publishData(encoder.encode(JSON.stringify({ date })), {
            reliable: true,
            topic: MINUTES_TOPIC,
        })
        .catch(() => undefined);
}

type Handlers = {
    onMinutes: (minutes: Minutes) => void;
    onAttendance: (roster: AttendanceRoster) => void;
    onSpeaking: (totals: SpeakingTotals) => void;
};

/**
 * Keeps the room's shared data fresh (contract §5): Reverb events on the
 * private channel `meeting.{id}` (minutes.updated, attendance.updated,
 * participant.called, speaking.updated — filtered by occurrence), LiveKit
 * nudges from the person who just saved, people joining/leaving, and
 * polling when there is no realtime connection.
 */
export function useRoomLive({
    room,
    connected,
    channel,
    date,
    me,
    minutesUrl,
    attendanceUrl,
    speakingUrl,
    realtime,
    handlers,
}: {
    room: Room;
    connected: boolean;
    channel: string | null;
    date: string;
    me: string;
    minutesUrl: string | null;
    attendanceUrl: string | null;
    speakingUrl: string | null;
    realtime: boolean;
    handlers: Handlers;
}) {
    const latest = useRef(handlers);
    latest.current = handlers;
    const timers = useRef(new Map<string, number>());

    useEffect(() => {
        const pending = timers.current;
        const later = (key: string, ms: number, run: () => void) => {
            if (pending.has(key)) {
                return;
            }

            pending.set(
                key,
                window.setTimeout(() => {
                    pending.delete(key);
                    run();
                }, ms),
            );
        };
        const loadMinutes = () =>
            minutesUrl &&
            later('minutes', 600, () =>
                videoApi
                    .minutes(minutesUrl)
                    .then(({ minutes }) => latest.current.onMinutes(minutes))
                    .catch(() => undefined),
            );
        const loadAttendance = (delay = 2000) =>
            attendanceUrl &&
            later('attendance', delay, () =>
                videoApi
                    .attendance(attendanceUrl)
                    .then((roster) => latest.current.onAttendance(roster))
                    .catch(() => undefined),
            );
        const loadSpeaking = () =>
            speakingUrl &&
            later('speaking', 300, () =>
                videoApi
                    .speaking(speakingUrl)
                    .then((totals) => latest.current.onSpeaking(totals))
                    .catch(() => undefined),
            );

        if (!connected) {
            return;
        }

        const decoder = new TextDecoder();
        const onData = (
            payload: Uint8Array,
            _participant: unknown,
            _kind: unknown,
            topic?: string,
        ) => {
            if (topic !== MINUTES_TOPIC) {
                return;
            }

            try {
                const body = JSON.parse(decoder.decode(payload)) as {
                    date?: string;
                };

                if (body.date === date) {
                    loadMinutes();
                }
            } catch {
                // Not ours.
            }
        };
        const onPeople = () => loadAttendance(2500);

        room.on(RoomEvent.DataReceived, onData)
            .on(RoomEvent.ParticipantConnected, onPeople)
            .on(RoomEvent.ParticipantDisconnected, onPeople);

        // Reverb (contract §5).
        let leave = () => {};

        if (realtime && channel) {
            try {
                if (echoIsConfigured()) {
                    const instance = echo();
                    const mine =
                        <T extends { occurrence_date?: string }>(
                            run: (event: T) => void,
                        ) =>
                        (event: T) => {
                            if (event.occurrence_date === date) {
                                run(event);
                            }
                        };

                    instance
                        .private(channel)
                        .listen(
                            '.minutes.updated',
                            mine<{
                                occurrence_date: string;
                                updated_by?: string;
                            }>((event) => {
                                if (event.updated_by !== me) {
                                    loadMinutes();
                                }
                            }),
                        )
                        .listen(
                            '.attendance.updated',
                            mine(() => loadAttendance()),
                        )
                        .listen(
                            '.participant.called',
                            mine(() => loadAttendance(0)),
                        )
                        .listen(
                            '.speaking.updated',
                            mine<{
                                occurrence_date: string;
                                totals?: SpeakingTotals;
                            }>((event) =>
                                event.totals
                                    ? latest.current.onSpeaking(event.totals)
                                    : loadSpeaking(),
                            ),
                        );
                    leave = () => instance.leave(channel);
                }
            } catch {
                // Polling below covers it.
            }
        }

        // Polling: slower with realtime (safety net), faster without.
        const polls = [
            window.setInterval(
                () => loadAttendance(0),
                realtime ? 60_000 : 30_000,
            ),
            window.setInterval(
                () => loadSpeaking(),
                realtime ? 60_000 : 20_000,
            ),
            window.setInterval(() => loadMinutes(), realtime ? 60_000 : 10_000),
        ];

        return () => {
            room.off(RoomEvent.DataReceived, onData)
                .off(RoomEvent.ParticipantConnected, onPeople)
                .off(RoomEvent.ParticipantDisconnected, onPeople);
            leave();
            polls.forEach((id) => window.clearInterval(id));
            pending.forEach((id) => window.clearTimeout(id));
            pending.clear();
        };
    }, [
        room,
        connected,
        channel,
        date,
        me,
        minutesUrl,
        attendanceUrl,
        speakingUrl,
        realtime,
    ]);
}
