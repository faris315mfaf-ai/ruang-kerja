import { Link } from '@inertiajs/react';
import { Camera, CircleCheck, Info, QrCode } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel, PanelLink } from '@/components/ui/panel';
import { TONE_CLASSES } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import { policy } from '@/routes/attendance';
import type { TodayAttendance } from '@/types/attendance';
import { CheckFlowMobile } from './check-flow.mobile';
import { DayTiles, statusPill, timingHint } from './check-in-card';
import { ConsentFooter } from './consent-footer';
import { HistoryList } from './history';
import { LeaveShortcutPanel } from './leave-shortcut-panel';
import { LocationMap, locationStatus } from './location-card';
import type { LocationProps } from './location-card';
import { MethodSwitch } from './method-switch';
import { WindowNotice, WindowsLine } from './window-notice';
import type { AttendancePageProps } from './use-attendance-page';
import { useAttendancePage } from './use-attendance-page';

type Hint = { icon: LucideIcon; title: string; sub: string };

/** Instruction tile above the main button (MAbsen "Ambil selfie"). */
function hintFor(today: TodayAttendance, method: 'gps' | 'qr'): Hint {
    if (today.action === 'done') {
        return {
            icon: CircleCheck,
            title: 'Absensi hari ini selesai',
            sub: 'Check-in dan check-out sudah tercatat. Sampai besok!',
        };
    }

    if (today.action === 'unavailable') {
        return {
            icon: Info,
            title: `Hari ini tercatat ${today.day?.statusLabel ?? 'dari pengajuan'}`,
            sub: 'Tidak perlu check-in untuk hari ini.',
        };
    }

    return method === 'qr'
        ? {
              icon: QrCode,
              title: 'Pindai QR di lobi',
              sub: 'Arahkan kamera ke layar kiosk. Kode berganti tiap 30 detik.',
          }
        : {
              icon: Camera,
              title: 'Ambil selfie',
              sub: 'Kamera depan terbuka setelah Anda menekan tombol.',
          };
}

function sheetTitle(today: TodayAttendance): string {
    switch (today.action) {
        case 'check_in':
            return 'Check-in';
        case 'check_out':
            return 'Check-out';
        default:
            return 'Absensi hari ini';
    }
}

/** Phone Absensi (MAbsen): map header, check-in sheet, today, last 7 days. */
export function AttendanceMobile(props: AttendancePageProps) {
    const { today, consent, history } = props;
    const { now, flow, action } = useAttendancePage(props);
    const pill = statusPill(today);
    const hint = timingHint(today, now);
    const tip = hintFor(today, flow.method);
    const TipIcon = tip.icon;
    const location: LocationProps = {
        locations: today.locations,
        schedule: today.schedule,
        position: flow.geo.position,
        geoState: flow.geo.state,
        geoError: flow.geo.error,
        match: flow.match,
        onRefresh: () => void flow.geo.request(),
    };
    const place = locationStatus(location);

    return (
        <div className="flex flex-col gap-5">
            <section
                aria-label="Absensi hari ini"
                className="overflow-hidden rounded-panel border border-border bg-surface shadow-card"
            >
                <LocationMap {...location} height={200} />
                <div className="relative -mt-7 flex flex-col gap-4 rounded-t-sheet bg-surface px-4 pt-5 pb-5">
                    <div className="flex flex-col gap-1.5">
                        <Badge variant="status" tone={pill.tone} dot>
                            {pill.label}
                        </Badge>
                        <h2 className="text-[28px] leading-9 font-extrabold tracking-[-0.02em] text-text">
                            {sheetTitle(today)}
                        </h2>
                        <p
                            aria-live="polite"
                            className={cn(
                                'text-body',
                                place.tone === 'danger' || place.tone === 'info'
                                    ? TONE_CLASSES[place.tone].text
                                    : 'text-text-muted',
                            )}
                        >
                            {place.title} · {place.detail}
                        </p>
                        {hint && (
                            <p
                                className={cn(
                                    'text-[15px] font-semibold',
                                    hint.tone === 'neutral'
                                        ? 'text-text-muted'
                                        : TONE_CLASSES[hint.tone].text,
                                )}
                            >
                                {hint.text}
                            </p>
                        )}
                    </div>
                    {action.type && (
                        <MethodSwitch
                            fill
                            value={flow.method}
                            onChange={flow.setMethod}
                        />
                    )}
                    {action.notice ? (
                        <WindowNotice notice={action.notice} />
                    ) : (
                        <div className="flex items-center gap-3.5 rounded-[18px] border border-border p-3.5">
                            <span
                                aria-hidden
                                className="flex size-16 shrink-0 items-center justify-center rounded-[18px] bg-grad-soft text-link"
                            >
                                <TipIcon className="size-7" strokeWidth={1.9} />
                            </span>
                            <span className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-[17px] leading-6 font-bold text-text">
                                    {tip.title}
                                </span>
                                <span className="text-[15px] leading-[21px] text-text-muted">
                                    {tip.sub}
                                </span>
                            </span>
                        </div>
                    )}
                    {today.action !== 'done' && (
                        <Button
                            type="button"
                            size="xl"
                            disabled={action.disabled}
                            onClick={() =>
                                action.type && flow.start(action.type)
                            }
                            className="h-[58px] w-full rounded-[18px] text-[19px] font-extrabold whitespace-normal"
                        >
                            {action.label}
                        </Button>
                    )}
                    <LeaveShortcutPanel
                        shortcut={today.leaveShortcut}
                        now={now}
                    />
                    <WindowsLine today={today} className="text-center" />
                    <p className="text-center text-[14px] leading-5 text-text-muted">
                        Lokasi dan foto hanya direkam saat check-in dan
                        check-out.{' '}
                        <Link
                            href={policy()}
                            className="font-bold text-link hover:underline"
                        >
                            Privasi
                        </Link>
                    </p>
                </div>
            </section>

            <DayTiles
                today={today}
                now={now}
                tileClassName="border border-border bg-surface shadow-card"
            />

            <Panel
                title="Riwayat 7 hari"
                action={<PanelLink href="/absensi/riwayat">Semua</PanelLink>}
                flush
                className="pb-2"
            >
                <HistoryList
                    history={history}
                    limit={7}
                    today={today.schedule.workDate}
                />
            </Panel>

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
