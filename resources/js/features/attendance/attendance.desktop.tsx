import { Link, usePage } from '@inertiajs/react';
import { Camera, QrCode, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/format';
import { hasAnyRole } from '@/lib/roles';
import { CheckFlowDesktop } from './check-flow.desktop';
import { CheckInCard, scheduleLine } from './check-in-card';
import { ConsentFooter } from './consent-footer';
import { HistoryTable } from './history';
import { LocationCard } from './location-card';
import { MethodSwitch } from './method-switch';
import { RecentDays } from './recent-days';
import type { AttendancePageProps } from './use-attendance-page';
import { useAttendancePage } from './use-attendance-page';

/** Desktop/tablet Absensi: card + map side by side, 30-day history table. */
export function AttendanceDesktop(props: AttendancePageProps) {
    const { today, consent, history } = props;
    const { now, flow, action } = useAttendancePage(props);
    const MethodIcon = flow.method === 'qr' ? QrCode : Camera;
    const { auth } = usePage().props;
    const canManage = hasAnyRole(auth.roles, 'hr', 'super_admin');

    return (
        <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="text-xl leading-7 font-semibold text-text">
                        Absensi
                    </h1>
                    <p className="text-sm text-text-muted">
                        {formatDate(now)} · {scheduleLine(today)}
                    </p>
                </div>
                {canManage && (
                    <Button asChild variant="outline" size="sm">
                        <Link href="/admin/absensi" prefetch>
                            <Settings2 aria-hidden />
                            Lokasi, shift &amp; hari libur
                        </Link>
                    </Button>
                )}
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-4">
                    <CheckInCard today={today} now={now} />
                    <div className="space-y-3 rounded-xl border border-border bg-surface p-4 shadow-card">
                        <MethodSwitch
                            value={flow.method}
                            onChange={flow.setMethod}
                        />
                        <Button
                            type="button"
                            disabled={action.disabled}
                            onClick={() =>
                                action.type && flow.start(action.type)
                            }
                            className="h-11 w-full text-[15px]"
                        >
                            {!action.disabled && (
                                <MethodIcon
                                    className="size-5"
                                    strokeWidth={1.75}
                                    aria-hidden
                                />
                            )}
                            {action.label}
                        </Button>
                        <p className="text-center text-[13px] text-text-muted">
                            Lokasi dan foto hanya direkam saat check-in dan
                            check-out.
                        </p>
                    </div>
                </div>
                <div className="flex flex-col gap-4">
                    <LocationCard
                        locations={today.locations}
                        schedule={today.schedule}
                        position={flow.geo.position}
                        geoState={flow.geo.state}
                        geoError={flow.geo.error}
                        match={flow.match}
                        onRefresh={() => void flow.geo.request()}
                        mapClassName="h-56"
                    />
                    <RecentDays
                        history={history}
                        today={today.schedule.workDate}
                    />
                </div>
            </div>

            <section
                id="riwayat"
                aria-labelledby="history-title"
                className="scroll-mt-20 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
            >
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h2
                        id="history-title"
                        className="text-[15px] font-semibold text-text"
                    >
                        Riwayat 30 hari
                    </h2>
                    <span className="text-[13px] text-text-muted">
                        Hanya terlihat oleh Anda, atasan langsung, dan HR.
                    </span>
                </div>
                <HistoryTable history={history} />
            </section>

            <ConsentFooter consent={consent} />
            <CheckFlowDesktop
                flow={flow}
                today={today}
                consent={consent}
                now={now}
            />
        </div>
    );
}
