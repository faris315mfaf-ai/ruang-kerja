import { Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CheckFlowMobile } from './check-flow.mobile';
import { CheckInCard } from './check-in-card';
import { ConsentFooter } from './consent-footer';
import { HistoryList } from './history';
import { LocationCard } from './location-card';
import { MethodSwitch } from './method-switch';
import { RecentDays } from './recent-days';
import type { AttendancePageProps } from './use-attendance-page';
import { useAttendancePage } from './use-attendance-page';

/** Mobile Absensi (mockup Absensi): phone-first check-in. */
export function AttendanceMobile(props: AttendancePageProps) {
    const { today, consent, history } = props;
    const { now, flow, action } = useAttendancePage(props);

    return (
        <div className="space-y-4">
            <CheckInCard today={today} now={now} />
            <LocationCard
                locations={today.locations}
                schedule={today.schedule}
                position={flow.geo.position}
                geoState={flow.geo.state}
                geoError={flow.geo.error}
                match={flow.match}
                onRefresh={() => void flow.geo.request()}
            />
            <MethodSwitch />
            <div className="space-y-3">
                <Button
                    type="button"
                    disabled={action.disabled}
                    onClick={() => action.type && flow.start(action.type)}
                    className="h-[52px] w-full rounded-xl text-[17px]"
                >
                    {!action.disabled && (
                        <Camera
                            className="size-6"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    )}
                    {action.label}
                </Button>
                <p className="text-center text-sm text-text-muted">
                    Lokasi dan foto hanya direkam saat check-in dan check-out.
                </p>
            </div>
            <RecentDays history={history} today={today.schedule.workDate} />
            <section
                id="riwayat"
                aria-labelledby="history-title"
                className="scroll-mt-20 space-y-2"
            >
                <h2
                    id="history-title"
                    className="px-1 text-[15px] font-semibold text-text"
                >
                    Riwayat 30 hari
                </h2>
                <HistoryList history={history} />
            </section>
            <ConsentFooter consent={consent} />
            <CheckFlowMobile
                flow={flow}
                today={today}
                consent={consent}
                now={now}
            />
        </div>
    );
}
