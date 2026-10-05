import { useEffect, useRef } from 'react';
import { useServerClock } from '@/hooks/use-server-clock';
import type {
    AttendanceConsentState,
    AttendanceDayData,
    TodayAttendance,
} from '@/types/attendance';
import { primaryAction } from './primary-action';
import { useCheckFlow } from './use-check-flow';

export type AttendancePageProps = {
    today: TodayAttendance;
    consent: AttendanceConsentState;
    serverTime: string;
    /** Deferred prop: undefined while loading. */
    history?: AttendanceDayData[];
};

/** Query parameter set by the topbar "Check-in" button to open the flow directly. */
export const START_PARAM = 'mulai';

async function locationPermissionGranted(): Promise<boolean> {
    try {
        const status = await navigator.permissions?.query({
            name: 'geolocation',
        });

        return status?.state === 'granted';
    } catch {
        return false;
    }
}

/**
 * Data + behaviour shared by the mobile and desktop Absensi layouts
 * (docs/PLATFORM.md §5 rule 2).
 */
export function useAttendancePage({
    today,
    consent,
    serverTime,
}: AttendancePageProps) {
    const now = useServerClock(serverTime);
    const flow = useCheckFlow(today, consent);
    const action = primaryAction(today, now, flow.method);
    const started = useRef(false);
    const { request } = flow.geo;
    const { start } = flow;

    // Preview the distance on open only when the employee already consented and
    // the browser already allows location (no surprise permission prompt).
    useEffect(() => {
        if (!consent.granted) {
            return;
        }

        void locationPermissionGranted().then((granted) => {
            if (granted) {
                void request();
            }
        });
    }, [consent.granted, request]);

    useEffect(() => {
        if (started.current || typeof window === 'undefined') {
            return;
        }

        const url = new URL(window.location.href);

        if (!url.searchParams.has(START_PARAM)) {
            return;
        }

        started.current = true;
        url.searchParams.delete(START_PARAM);
        window.history.replaceState(window.history.state, '', url.toString());

        if (action.type && !action.disabled) {
            start(action.type);
        }
    }, [action.disabled, action.type, start]);

    return { now, flow, action };
}
