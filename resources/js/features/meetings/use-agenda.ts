import { useMemo, useState } from 'react';
import {
    meetingPhase,
    meetingsOn,
    nextMeeting,
    officeDate,
    weekDates,
} from './lib';
import { useNow } from './meetings-context';
import type { AgendaProps } from './types';

/**
 * Shared data for /rapat (desktop & mobile): the viewer's meetings of the
 * week (server props, series already expanded), the selected day, the hero
 * meeting and open follow-ups.
 */
export function useAgenda(props: AgendaProps) {
    const now = useNow();
    const today = officeDate(now);
    const days = useMemo(() => weekDates(props.week_start), [props.week_start]);
    const [day, setDay] = useState(() =>
        days.includes(today) ? today : days[0],
    );
    const meetings = props.meetings;

    const counts = useMemo(
        () =>
            Object.fromEntries(
                days.map((date) => [date, meetingsOn(meetings, date).length]),
            ),
        [days, meetings],
    );

    const next = nextMeeting(meetings, now);
    const live = next && meetingPhase(next, now) === 'live' ? next : null;
    const pendingMinutes = meetings.filter(
        (meeting) =>
            meeting.minute_taker_id === props.viewer_id &&
            meeting.minutes_status === 'draft',
    ).length;

    return {
        now,
        today,
        me: props.viewer_id,
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
        followUps: props.follow_ups,
        pendingMinutes,
    };
}

export type AgendaData = ReturnType<typeof useAgenda>;
