import { Link, usePage } from '@inertiajs/react';
import { Check, Settings2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { TONE_CLASSES } from '@/lib/attendance';
import { formatTime } from '@/lib/format';
import { hasAnyRole } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { policy } from '@/routes/attendance';
import { CheckFlowDesktop } from './check-flow.desktop';
import {
    DayTiles,
    scheduleLine,
    statusPill,
    timingHint,
} from './check-in-card';
import { ConsentFooter } from './consent-footer';
import { HistoryTable } from './history';
import { LocationRow } from './location-card';
import { MethodSwitch } from './method-switch';
import { HistoryStats, MonthGlance } from './month-glance';
import type { AttendancePageProps } from './use-attendance-page';
import { useAttendancePage } from './use-attendance-page';

/** "SENIN, 5 OKTOBER 2026" overline of the page header. */
function longDate(now: Date): string {
    return new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    }).format(now);
}

/** Desktop/tablet Absensi (DAbsensi): check-in card, month, 7-day history. */
export function AttendanceDesktop(props: AttendancePageProps) {
    const { today, consent, history } = props;
    const { now, flow, action } = useAttendancePage(props);
    const { auth } = usePage().props;
    const canManage = hasAnyRole(auth.roles, 'hr', 'super_admin');
    const pill = statusPill(today);
    const hint = timingHint(today, now);

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-2">
                    <p className="text-overline text-link">{longDate(now)}</p>
                    <h1 className="text-display text-text">Absensi</h1>
                    <p className="text-body-lg text-text-muted">
                        {scheduleLine(today)}
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    {canManage && (
                        <Button asChild variant="outline">
                            <Link href="/admin/absensi" prefetch>
                                <Settings2 aria-hidden />
                                Lokasi, shift &amp; hari libur
                            </Link>
                        </Button>
                    )}
                    <Button asChild variant="outline">
                        <Link href="/pengajuan/baru?kategori=koreksi">
                            Ajukan koreksi
                        </Link>
                    </Button>
                    <Button asChild variant="outline">
                        <Link href="/pengajuan/baru?kategori=izin">
                            Ajukan izin
                        </Link>
                    </Button>
                </div>
            </header>

            <div className="flex flex-wrap items-start gap-5">
                <section
                    aria-label="Absensi hari ini"
                    className="min-w-0 flex-[3_1_560px] rounded-[28px] bg-grad-merek p-[2px] shadow-glow"
                >
                    <div className="flex flex-col gap-6 rounded-[26px] bg-surface p-6 lg:p-8">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Badge
                                    variant="status"
                                    tone={pill.tone}
                                    dot
                                    className="h-[34px] px-3.5"
                                >
                                    {pill.label}
                                </Badge>
                                <p className="text-[64px] leading-[72px] font-extrabold tracking-[-0.04em] text-text tnum lg:text-[72px] lg:leading-[80px]">
                                    <time dateTime={now.toISOString()}>
                                        {formatTime(now)}
                                    </time>
                                </p>
                                <p className="text-[17px] text-text-muted">
                                    Waktu server · WIB
                                    {hint && (
                                        <span
                                            className={cn(
                                                'block font-semibold',
                                                hint.tone === 'neutral'
                                                    ? 'text-text-muted'
                                                    : TONE_CLASSES[hint.tone]
                                                          .text,
                                            )}
                                        >
                                            {hint.text}
                                        </span>
                                    )}
                                </p>
                            </div>
                            {action.type && (
                                <MethodSwitch
                                    value={flow.method}
                                    onChange={flow.setMethod}
                                />
                            )}
                        </div>

                        <DayTiles today={today} now={now} />

                        <div className="flex flex-wrap items-center gap-4">
                            <LocationRow
                                className="flex-[1_1_260px]"
                                locations={today.locations}
                                schedule={today.schedule}
                                position={flow.geo.position}
                                geoState={flow.geo.state}
                                geoError={flow.geo.error}
                                match={flow.match}
                                onRefresh={() => void flow.geo.request()}
                            />
                            {today.action === 'done' ? (
                                <span className="inline-flex h-14 items-center gap-2.5 rounded-lg bg-success-soft px-6 text-[17px] font-bold text-success">
                                    <Check
                                        className="size-[22px]"
                                        strokeWidth={2.6}
                                        aria-hidden
                                    />
                                    Check-out tercatat
                                </span>
                            ) : (
                                <Button
                                    type="button"
                                    size="xl"
                                    disabled={action.disabled}
                                    onClick={() =>
                                        action.type && flow.start(action.type)
                                    }
                                    className="max-w-full shrink-0 whitespace-normal"
                                >
                                    {action.label}
                                </Button>
                            )}
                        </div>
                        <p className="text-[15px] leading-[22px] text-text-muted">
                            Lokasi dan selfie hanya direkam saat check-in dan
                            check-out.{' '}
                            <Link
                                href={policy()}
                                className="font-semibold text-link hover:underline"
                            >
                                Kebijakan privasi
                            </Link>
                        </p>
                    </div>
                </section>

                <div className="flex min-w-0 flex-[2_1_380px] flex-col gap-5">
                    <MonthGlance
                        history={history}
                        today={today.schedule.workDate}
                    />
                    <HistoryStats history={history} />
                </div>
            </div>

            <Panel
                title="Riwayat 7 hari kerja"
                action={
                    <PanelLink href="/absensi/riwayat">Semua riwayat</PanelLink>
                }
                flush
                className="pb-2"
            >
                <div className="overflow-x-auto">
                    <HistoryTable
                        history={history}
                        limit={7}
                        today={today.schedule.workDate}
                    />
                </div>
            </Panel>

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
