import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { BUSY, ME, MEETINGS, PEOPLE } from './fixtures';
import type { MeetingFormErrors, MeetingFormValues } from './lib';
import {
    addDays,
    findConflicts,
    isEmail,
    officeDate,
    officeInstant,
    parseClock,
    suggestFreeSlot,
    validateMeetingForm,
} from './lib';
import { useDemoClock, usePreviewState } from './use-preview';

export const DURATIONS = [15, 30, 45, 60, 90, 120];

export const WORKSPACES = [
    { key: 'OPS', name: 'Divisi Operasional' },
    { key: 'PLQ', name: 'Peluncuran Q4' },
    { key: 'none', name: 'Tanpa workspace' },
];

export const REMINDER_OPTIONS = [30, 15, 5];

function blank(today: string): MeetingFormValues {
    return {
        title: '',
        date: addDays(today, 1),
        start: '15:00',
        duration: 60,
        platform: 'meet',
        zoomUrl: '',
        zoomPasscode: '',
        room: '',
        participants: [ME],
        agenda: [''],
        recurrence: 'none',
        reminders: [15, 5],
        minuteTakerId: ME,
        workspace: 'OPS',
    };
}

/** Filled sample (DRapatBaru) that shows a schedule conflict with Bayu. */
function sample(today: string): MeetingFormValues {
    return {
        ...blank(today),
        title: 'Review vendor logistik',
        start: '13:30',
        participants: [
            ME,
            'bayu',
            'rizky',
            'fitri',
            'logistik@sinarlogistik.co.id',
        ],
        agenda: [
            'Evaluasi ketepatan pengiriman September',
            'Penawaran harga kuartal IV',
            'SLA klaim barang rusak',
        ],
        minuteTakerId: 'fitri',
    };
}

/**
 * State of /rapat/baru shared by the desktop and phone layouts: values,
 * validation (shown after the first submit), conflicts with the
 * participants' calendars, a free-slot suggestion and the fake save.
 */
export function useMeetingForm() {
    const now = useDemoClock();
    const today = officeDate(now);
    const { state } = usePreviewState();
    const [values, setValues] = useState<MeetingFormValues>(() => blank(today));
    const [submitted, setSubmitted] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [saved, setSaved] = useState<MeetingFormValues | null>(null);
    const mutation = useFakeMutation();

    const set = <K extends keyof MeetingFormValues>(
        key: K,
        value: MeetingFormValues[K],
    ) => setValues((current) => ({ ...current, [key]: value }));

    const errors: MeetingFormErrors = useMemo(
        () => validateMeetingForm(values, now, ME),
        [values, now],
    );
    const visibleErrors: MeetingFormErrors = submitted ? errors : {};
    const valid = Object.keys(errors).length === 0;

    const internal = useMemo(
        () => values.participants.filter((id) => !isEmail(id)),
        [values.participants],
    );
    const timeOk =
        parseClock(values.start) !== null &&
        /^\d{4}-\d{2}-\d{2}$/.test(values.date);
    const startsAt = timeOk ? officeInstant(values.date, values.start) : null;
    const endsAt = startsAt
        ? new Date(
              Date.parse(startsAt) + values.duration * 60_000,
          ).toISOString()
        : null;

    const conflicts = useMemo(
        () =>
            startsAt && endsAt
                ? findConflicts(internal, startsAt, endsAt, MEETINGS, BUSY)
                : [],
        [internal, startsAt, endsAt],
    );
    const hasConflicts = conflicts.length > 0;
    const suggestion = useMemo(
        () =>
            hasConflicts && timeOk
                ? suggestFreeSlot(
                      internal,
                      values.date,
                      values.start,
                      values.duration,
                      MEETINGS,
                      BUSY,
                  )
                : null,
        [
            hasConflicts,
            timeOk,
            internal,
            values.date,
            values.start,
            values.duration,
        ],
    );

    const addParticipant = (idOrEmail: string) => {
        const value = idOrEmail.trim().toLowerCase();

        if (!value || values.participants.includes(value)) {
            return;
        }

        set('participants', [...values.participants, value]);
    };

    const removeParticipant = (idOrEmail: string) => {
        if (idOrEmail === ME) {
            return;
        }

        setValues((current) => ({
            ...current,
            participants: current.participants.filter(
                (item) => item !== idOrEmail,
            ),
            minuteTakerId:
                current.minuteTakerId === idOrEmail
                    ? ME
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

    const send = () =>
        mutation.run(
            () => {
                setSaved(values);
                setSummaryOpen(false);
            },
            {
                success: 'Undangan rapat terkirim',
                fail: state === 'galat',
                error: 'Google Calendar menolak undangan. Coba lagi sebentar.',
            },
        );

    const reset = () => {
        setValues(blank(today));
        setSubmitted(false);
        setSaved(null);
    };

    return {
        now,
        today,
        state,
        values,
        set,
        setValues,
        fillSample: () => {
            setValues(sample(today));
            setSubmitted(false);
        },
        errors: visibleErrors,
        valid,
        conflicts,
        suggestion,
        applySuggestion: () => suggestion && set('start', suggestion),
        addParticipant,
        removeParticipant,
        internalPeople: PEOPLE.filter((person) => internal.includes(person.id)),
        guests: values.participants.filter(isEmail),
        review,
        summaryOpen,
        setSummaryOpen,
        send,
        processing: mutation.processing,
        saved,
        reset,
        startsAt,
        endsAt,
    };
}

export type MeetingForm = ReturnType<typeof useMeetingForm>;
