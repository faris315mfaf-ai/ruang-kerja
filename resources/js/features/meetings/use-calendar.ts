import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { calendar as calendarRoute } from '@/routes';
import {
    addDays,
    ALL_LAYERS,
    entriesOn,
    monthGrid,
    officeDate,
    toggleLayer,
    weekDates,
} from './lib';
import { useNow } from './meetings-context';
import type { CalendarLayer, CalendarProps } from './types';

export type CalendarView = 'month' | 'week';

const LAYERS_KEY = 'rk.calendar.layers';

function storedLayers(): CalendarLayer[] {
    try {
        const raw = window.localStorage.getItem(LAYERS_KEY);
        const value = raw ? (JSON.parse(raw) as CalendarLayer[]) : null;
        const valid = value?.filter((layer) => ALL_LAYERS.includes(layer));

        return valid && valid.length > 0 ? valid : ALL_LAYERS;
    } catch {
        return ALL_LAYERS;
    }
}

const monthKey = (date: string) => date.slice(0, 7);

/**
 * State of /kalender for both layouts: month/week cursor, selected day and
 * enabled layers (remembered per browser). Entries come from the server for
 * the weeks covering one month (`?bulan=YYYY-MM`); moving outside them loads
 * that month with a partial Inertia visit.
 */
export function useCalendar(props: CalendarProps) {
    const now = useNow(60_000);
    const today = officeDate(now);
    const loadedMonth = `${props.year}-${String(props.month).padStart(2, '0')}`;
    const [view, setView] = useState<CalendarView>('month');
    const [selected, setSelected] = useState(() =>
        monthKey(today) === loadedMonth ? today : `${loadedMonth}-01`,
    );
    const [layers, setLayers] = useState<CalendarLayer[]>(() =>
        typeof window === 'undefined' ? ALL_LAYERS : storedLayers(),
    );
    const [loading, setLoading] = useState(false);

    const load = (month: string) =>
        router.get(
            calendarRoute({ query: { bulan: month } }).url,
            {},
            {
                only: ['calendar'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
                onError: () => toast.error('Kalender gagal dimuat. Coba lagi.'),
            },
        );

    const select = (date: string) => {
        setSelected(date);

        if (date < props.from || date > props.to) {
            load(monthKey(date));
        }
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

        const index = props.year * 12 + (props.month - 1) + direction;
        const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
        setSelected(monthKey(today) === month ? today : `${month}-01`);
        load(month);
    };

    const toggle = (layer: CalendarLayer) =>
        setLayers((current) => {
            const next = toggleLayer(current, layer);

            try {
                window.localStorage.setItem(LAYERS_KEY, JSON.stringify(next));
            } catch {
                // Storage blocked: the choice only lasts for this visit.
            }

            return next;
        });

    const entries = props.entries;

    return {
        now,
        today,
        view,
        setView,
        selected,
        select,
        month: { year: props.year, month: props.month },
        shift,
        goToday: () => select(today),
        weeks: monthGrid(props.year, props.month),
        week: weekDates(selected, 7),
        layers,
        toggle,
        entries,
        loading,
        on: (date: string) => entriesOn(entries, date, layers),
        countFor: (layer: CalendarLayer) =>
            entries.filter((entry) => entry.layer === layer).length,
    };
}

export type CalendarData = ReturnType<typeof useCalendar>;
