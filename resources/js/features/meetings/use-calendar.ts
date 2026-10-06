import { useMemo, useState } from 'react';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import {
    GOOGLE_SYNC,
    HOLIDAYS,
    LEAVES,
    ME,
    MEETINGS,
    PEOPLE,
    TASKS_DUE,
} from './fixtures';
import {
    addDays,
    ALL_LAYERS,
    buildCalendarEntries,
    entriesOn,
    monthGrid,
    officeDate,
    toggleLayer,
    weekDates,
} from './lib';
import type { CalendarLayer, GoogleSync } from './types';
import { useDemoClock, usePreviewState } from './use-preview';

export type CalendarView = 'month' | 'week';

/**
 * State of /kalender for both layouts: month/week cursor, selected day,
 * enabled layers and the Google Calendar connection (`?keadaan=terputus`
 * previews the not-connected state).
 */
export function useCalendar() {
    const { state } = usePreviewState();
    const now = useDemoClock();
    const today = officeDate(now);
    const [view, setView] = useState<CalendarView>('month');
    const [selected, setSelected] = useState(today);
    const [month, setMonth] = useState({
        year: Number(today.slice(0, 4)),
        month: Number(today.slice(5, 7)),
    });
    const [layers, setLayers] = useState<CalendarLayer[]>(ALL_LAYERS);
    const [sync, setSync] = useState<GoogleSync>(() =>
        state === 'terputus'
            ? { connected: false, account: null, last_synced_at: null }
            : GOOGLE_SYNC,
    );
    const mutation = useFakeMutation();

    const entries = useMemo(
        () =>
            state === 'kosong'
                ? []
                : buildCalendarEntries({
                      meetings: MEETINGS,
                      tasks: TASKS_DUE,
                      leaves: LEAVES,
                      holidays: HOLIDAYS,
                      people: PEOPLE,
                      personId: ME,
                      today,
                  }),
        [state, today],
    );

    const select = (date: string) => {
        setSelected(date);
        setMonth({
            year: Number(date.slice(0, 4)),
            month: Number(date.slice(5, 7)),
        });
    };

    /** Previous/next month (month view) or week (week view & phone strip). */
    const shift = (
        direction: -1 | 1,
        unit: 'month' | 'week' = view === 'month' ? 'month' : 'week',
    ) => {
        if (unit === 'week') {
            select(addDays(selected, direction * 7));

            return;
        }

        const index = month.year * 12 + (month.month - 1) + direction;
        const next = { year: Math.floor(index / 12), month: (index % 12) + 1 };
        setMonth(next);
        setSelected(`${next.year}-${String(next.month).padStart(2, '0')}-01`);
    };

    return {
        state,
        now,
        today,
        view,
        setView,
        selected,
        select,
        month,
        shift,
        goToday: () => select(today),
        weeks: monthGrid(month.year, month.month),
        week: weekDates(selected, 7),
        layers,
        toggle: (layer: CalendarLayer) =>
            setLayers((current) => toggleLayer(current, layer)),
        entries,
        on: (date: string) => entriesOn(entries, date, layers),
        countFor: (layer: CalendarLayer) =>
            entries.filter((entry) => entry.layer === layer).length,
        sync,
        processing: mutation.processing,
        connect: () =>
            mutation.run(
                () =>
                    setSync({
                        connected: true,
                        account: 'dimas@spkd.co.id',
                        last_synced_at: new Date(now).toISOString(),
                    }),
                {
                    delay: 900,
                    success:
                        'Google Calendar terhubung. Rapat, tenggat dan cuti akan tersinkron.',
                },
            ),
        syncNow: () =>
            mutation.run(
                () =>
                    setSync((current) => ({
                        ...current,
                        last_synced_at: new Date(now).toISOString(),
                    })),
                {
                    success: 'Kalender tersinkron dengan Google Calendar',
                    fail: state === 'galat',
                    error: 'Sinkron gagal: Google Calendar tidak menjawab.',
                },
            ),
    };
}

export type CalendarData = ReturnType<typeof useCalendar>;
