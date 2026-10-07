import { router } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import meetingRoutes from '@/routes/meetings';
import { meetingsApi } from './api';
import type {
    MeetingFormErrors,
    MeetingFormField,
    MeetingFormValues,
} from './lib';
import {
    addDays,
    isEmail,
    officeDate,
    parseClock,
    validateMeetingForm,
} from './lib';
import { useNow } from './meetings-context';
import type { Conflict, MeetingFormProps } from './types';

export const REMINDER_OPTIONS = [30, 15, 5];

const CONFLICT_DEBOUNCE_MS = 400;

function blank(
    today: string,
    me: string,
    workspace: string,
    videoEnabled: boolean,
): MeetingFormValues {
    return {
        title: '',
        date: addDays(today, 1),
        start: '09:00',
        duration: 60,
        // Video RuangKerja is the default online place once LiveKit is set up.
        platform: videoEnabled ? 'video' : 'meet',
        joinUrl: '',
        location: '',
        participants: [me],
        agenda: [''],
        recurrence: 'none',
        recurrenceUntil: '',
        reminders: [15, 5],
        minuteTakerId: me,
        workspace,
        leadership: false,
    };
}

function fromMeeting(
    props: MeetingFormProps,
    me: string,
): MeetingFormValues | null {
    const meeting = props.meeting;

    if (!meeting) {
        return null;
    }

    const organizer = meeting.participants.includes(me) ? [] : [me];

    return {
        title: meeting.title,
        date: meeting.date,
        start: meeting.start,
        duration: meeting.duration,
        platform: meeting.platform,
        joinUrl: meeting.join_url ?? '',
        location: meeting.location ?? '',
        participants: [...organizer, ...meeting.participants],
        agenda: meeting.agenda.length > 0 ? meeting.agenda : [''],
        recurrence: meeting.recurrence,
        recurrenceUntil: meeting.recurrence_until ?? '',
        reminders: meeting.reminders,
        minuteTakerId: meeting.minute_taker_id ?? me,
        workspace: meeting.workspace_id ?? 'none',
        leadership: meeting.leadership,
    };
}

/** Server field names → form fields (422 from POST/PATCH /rapat). */
const SERVER_FIELDS: Record<string, MeetingFormField> = {
    platform: 'platform',
    title: 'title',
    date: 'date',
    start: 'start',
    join_url: 'joinUrl',
    location: 'location',
    participant_ids: 'participants',
    guest_emails: 'participants',
    agenda: 'agenda',
    recurrence_until: 'recurrenceUntil',
};

/**
 * State of /rapat/baru and /rapat/{id}/ubah shared by the desktop and phone
 * layouts: values, validation (shown after the first submit, server errors
 * mapped onto the same fields), live conflict check with the participants'
 * RuangKerja meetings (GET /rapat/bentrok) and the save (Inertia POST/PATCH).
 */
export function useMeetingForm(props: MeetingFormProps) {
    const now = useNow(60_000);
    const today = officeDate(now);
    const me = props.viewer_id;
    const editing = props.meeting !== null;
    const [values, setValues] = useState<MeetingFormValues>(
        () =>
            fromMeeting(props, me) ??
            blank(
                today,
                me,
                props.workspaces[0]?.id ?? 'none',
                props.video_enabled,
            ),
    );
    const [submitted, setSubmitted] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState<MeetingFormErrors>({});
    const [conflicts, setConflicts] = useState<Conflict[]>([]);
    const [suggestion, setSuggestion] = useState<string | null>(null);
    const [checking, setChecking] = useState(false);

    const set = <K extends keyof MeetingFormValues>(
        key: K,
        value: MeetingFormValues[K],
    ) => {
        setValues((current) => ({ ...current, [key]: value }));
        setServerErrors({});
    };

    const errors: MeetingFormErrors = useMemo(
        () => validateMeetingForm(values, now, me, editing),
        [values, now, me, editing],
    );
    const visibleErrors: MeetingFormErrors = submitted
        ? { ...errors, ...serverErrors }
        : serverErrors;
    const valid = Object.keys(errors).length === 0;

    const internal = useMemo(
        () => values.participants.filter((id) => !isEmail(id)),
        [values.participants],
    );
    const timeOk =
        parseClock(values.start) !== null &&
        /^\d{4}-\d{2}-\d{2}$/.test(values.date);

    // Conflicts with the participants' other meetings (debounced).
    useEffect(() => {
        if (!timeOk || internal.length === 0) {
            setConflicts([]);
            setSuggestion(null);

            return;
        }

        let stale = false;
        const handle = window.setTimeout(() => {
            setChecking(true);
            meetingsApi
                .conflicts({
                    participants: internal,
                    date: values.date,
                    start: values.start,
                    duration: values.duration,
                    ignore: props.meeting?.id,
                })
                .then((result) => {
                    if (!stale) {
                        setConflicts(result.conflicts);
                        setSuggestion(result.suggestion);
                    }
                })
                .catch(() => {
                    // Advisory only: the form still works without the check.
                    if (!stale) {
                        setConflicts([]);
                        setSuggestion(null);
                    }
                })
                .finally(() => !stale && setChecking(false));
        }, CONFLICT_DEBOUNCE_MS);

        return () => {
            stale = true;
            window.clearTimeout(handle);
        };
    }, [
        internal,
        timeOk,
        values.date,
        values.start,
        values.duration,
        props.meeting?.id,
    ]);

    const addParticipant = (idOrEmail: string) => {
        const value = isEmail(idOrEmail)
            ? idOrEmail.trim().toLowerCase()
            : idOrEmail.trim();

        if (!value || values.participants.includes(value)) {
            return;
        }

        set('participants', [...values.participants, value]);
    };

    const removeParticipant = (idOrEmail: string) => {
        if (idOrEmail === me) {
            return;
        }

        setValues((current) => ({
            ...current,
            participants: current.participants.filter(
                (item) => item !== idOrEmail,
            ),
            minuteTakerId:
                current.minuteTakerId === idOrEmail
                    ? me
                    : current.minuteTakerId,
        }));
    };

    /** Validate; open the summary when everything is fine. */
    const review = (): boolean => {
        setSubmitted(true);

        if (!valid) {
            toast.error('Periksa lagi isian yang ditandai merah.');

            return false;
        }

        setSummaryOpen(true);

        return true;
    };

    const payload = () => ({
        title: values.title.trim(),
        date: values.date,
        start: values.start.replace('.', ':'),
        duration: values.duration,
        platform: values.platform,
        join_url:
            values.platform === 'meet' || values.platform === 'zoom'
                ? values.joinUrl.trim() || null
                : null,
        location:
            values.platform === 'room' || values.platform === 'client'
                ? values.location.trim()
                : null,
        participant_ids: values.participants.filter((id) => !isEmail(id)),
        guest_emails: values.participants.filter(isEmail),
        agenda: values.agenda,
        recurrence: values.recurrence,
        recurrence_until:
            values.recurrence === 'none'
                ? null
                : values.recurrenceUntil || null,
        reminders: values.reminders,
        minute_taker_id: values.minuteTakerId || null,
        workspace_id: values.workspace === 'none' ? null : values.workspace,
        leadership: props.can_lead ? values.leadership : undefined,
    });

    const send = () => {
        const route = props.meeting
            ? meetingRoutes.update(props.meeting.id)
            : meetingRoutes.store();
        const options = {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onError: (errorBag: Record<string, string>) => {
                setSummaryOpen(false);
                setSubmitted(true);
                const mapped: MeetingFormErrors = {};

                for (const [key, message] of Object.entries(errorBag)) {
                    const field =
                        SERVER_FIELDS[key] ??
                        SERVER_FIELDS[key.split('.')[0] ?? ''];

                    if (field && !mapped[field]) {
                        mapped[field] = message;
                    }
                }

                setServerErrors(mapped);
                toast.error(
                    Object.values(errorBag)[0] ??
                        'Undangan gagal dikirim. Periksa isian lalu coba lagi.',
                );
            },
        };

        if (props.meeting) {
            router.patch(route.url, payload(), options);
        } else {
            router.post(route.url, payload(), options);
        }
    };

    return {
        now,
        today,
        me,
        editing,
        canLead: props.can_lead,
        videoEnabled: props.video_enabled,
        durations: props.durations,
        workspaces: props.workspaces,
        people: props.people,
        values,
        set,
        setValues,
        errors: visibleErrors,
        valid,
        conflicts,
        suggestion,
        checking,
        applySuggestion: () => suggestion && set('start', suggestion),
        addParticipant,
        removeParticipant,
        internalPeople: props.people.filter((person) =>
            internal.includes(person.id),
        ),
        guests: values.participants.filter(isEmail),
        review,
        summaryOpen,
        setSummaryOpen,
        send,
        processing,
    };
}

export type MeetingForm = ReturnType<typeof useMeetingForm>;
