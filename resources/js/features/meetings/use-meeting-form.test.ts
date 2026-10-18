import { describe, expect, it } from 'vitest';
import type { MeetingFormProps } from './types';
import { fromMeeting } from './use-meeting-form';

const props = (guestNames?: Record<string, string>): MeetingFormProps => ({
    viewer_id: 'me',
    people: [],
    workspaces: [],
    can_lead: false,
    durations: [30, 60],
    video_enabled: true,
    meeting: {
        id: 'm1',
        title: 'Sinkron mitra',
        date: '2026-10-06',
        start: '10:00',
        duration: 60,
        platform: 'video',
        join_url: null,
        location: null,
        participants: ['u2', 'budi@mitra.test'],
        agenda: [''],
        recurrence: 'none',
        recurrence_until: null,
        reminders: [15, 5],
        minute_taker_id: null,
        workspace_id: null,
        leadership: false,
        ...(guestNames ? { guest_names: guestNames } : {}),
    },
});

describe('fromMeeting guest names', () => {
    it('prefills the guest name fields from the server', () => {
        const values = fromMeeting(
            props({ 'budi@mitra.test': 'Budi Mitra' }),
            'me',
        );

        expect(values?.guestNames).toEqual({ 'budi@mitra.test': 'Budi Mitra' });
    });

    it('starts empty for a server that does not send guest_names', () => {
        expect(fromMeeting(props(), 'me')?.guestNames).toEqual({});
    });

    it('does not share the server object with the form state', () => {
        const names = { 'budi@mitra.test': 'Budi' };
        const values = fromMeeting(props(names), 'me');

        expect(values?.guestNames).not.toBe(names);
    });
});
