import { useMemo, useState } from 'react';
import { GOOGLE_SYNC, ME, MEETINGS, MINUTES } from './fixtures';
import {
    isParticipant,
    meetingPhase,
    meetingsOn,
    nextMeeting,
    officeDate,
    openActionsFor,
    weekDates,
} from './lib';
import type { Meeting } from './types';
import { useDemoClock, usePreviewState } from './use-preview';

/**
 * Shared data for /rapat (desktop & mobile): the viewer's meetings this
 * week, the selected day, the hero meeting and open follow-ups. Later the
 * controller passes `meetings`, `minutes` and `sync` as props.
 */
export function useAgenda() {
    const { state } = usePreviewState();
    const now = useDemoClock();
    const today = officeDate(now);
    const days = useMemo(() => weekDates(today), [today]);
    const [day, setDay] = useState(today);
    const [noticeOpen, setNoticeOpen] = useState(false);

    const meetings = useMemo<Meeting[]>(
        () =>
            state === 'kosong'
                ? []
                : MEETINGS.filter((meeting) => isParticipant(meeting, ME)),
        [state],
    );

    const counts = useMemo(
        () =>
            Object.fromEntries(
                days.map((date) => [date, meetingsOn(meetings, date).length]),
            ),
        [days, meetings],
    );

    const next = nextMeeting(meetings, now);
    const live = next && meetingPhase(next, now) === 'live' ? next : null;
    const followUps = state === 'kosong' ? [] : openActionsFor(MINUTES, ME);
    const pendingMinutes = meetings.filter(
        (meeting) =>
            meeting.minute_taker_id === ME &&
            meeting.minutes_status === 'draft',
    ).length;

    return {
        state,
        now,
        today,
        days,
        day,
        setDay,
        meetings,
        dayMeetings: meetingsOn(meetings, day),
        weekMeetings: days.map((date) => ({
            date,
            meetings: meetingsOn(meetings, date),
        })),
        counts,
        next,
        live,
        followUps,
        pendingMinutes,
        sync: GOOGLE_SYNC,
        noticeOpen,
        setNoticeOpen,
    };
}

export type AgendaData = ReturnType<typeof useAgenda>;
