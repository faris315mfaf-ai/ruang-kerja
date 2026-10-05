import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import type {
    AttendanceConsentState,
    TodayAttendance,
} from '@/types/attendance';
import { CheckFailure } from './flow/check-failure';
import { CheckSuccess } from './flow/check-success';
import { ConsentContent } from './flow/consent-content';
import { QrScan } from './flow/qr-scan';
import { SelfieCapture } from './flow/selfie-capture';
import { SelfieReview } from './flow/selfie-review';
import type { CheckFlow } from './use-check-flow';

type Props = {
    flow: CheckFlow;
    today: TodayAttendance;
    consent: AttendanceConsentState;
    now: Date;
};

function Header({
    title,
    subtitle,
    trailing,
    onBack,
    dark = false,
}: {
    title: string;
    subtitle?: ReactNode;
    trailing?: ReactNode;
    onBack: () => void;
    dark?: boolean;
}) {
    return (
        <header className="flex items-center gap-2 px-2 pt-[calc(env(safe-area-inset-top)+8px)] pb-2">
            <button
                type="button"
                onClick={onBack}
                aria-label="Kembali"
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-full text-text transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                    dark ? 'bg-surface-2' : 'hover:bg-surface-2',
                )}
            >
                <ArrowLeft className="size-6" strokeWidth={1.75} />
            </button>
            <div className={cn('min-w-0 flex-1', dark && 'text-center')}>
                <DialogPrimitive.Title className="truncate text-[19px] leading-6 font-semibold text-text">
                    {title}
                </DialogPrimitive.Title>
                {subtitle && (
                    <p className="truncate text-[13px] text-text-muted">
                        {subtitle}
                    </p>
                )}
            </div>
            <div className="flex min-w-11 shrink-0 justify-end pr-2">
                {trailing}
            </div>
        </header>
    );
}

/**
 * Full-screen check-in screens on phones (mockups CheckinConsent,
 * CheckinSelfie, CheckinSukses, CheckinGagal). Built on Radix Dialog for focus
 * trapping and Escape.
 */
export function CheckFlowMobile({ flow, today, consent, now }: Props) {
    const open = flow.step !== 'idle';
    const scanning =
        flow.method === 'qr' &&
        (flow.step === 'scan' || flow.step === 'submitting');
    const camera =
        !scanning &&
        (flow.step === 'capture' ||
            flow.step === 'review' ||
            flow.step === 'submitting');
    const verb = flow.type === 'in' ? 'check-in' : 'check-out';
    const shiftLine =
        today.schedule.isWorkday && today.schedule.start
            ? `Shift ${today.schedule.shiftName} · ${flow.type === 'in' ? 'masuk' : 'pulang'} ${formatTime(flow.type === 'in' ? today.schedule.start : today.schedule.end)}`
            : 'Tidak ada jadwal hari ini';

    return (
        <DialogPrimitive.Root
            open={open}
            onOpenChange={(next) => !next && flow.close()}
        >
            <DialogPrimitive.Portal>
                <DialogPrimitive.Content
                    aria-describedby={undefined}
                    className={cn(
                        'fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background text-text outline-none',
                        (camera || scanning) && 'dark',
                    )}
                    onEscapeKeyDown={(event) => {
                        if (flow.step === 'submitting') {
                            event.preventDefault();
                        }
                    }}
                >
                    {flow.step === 'consent' && (
                        <>
                            <Header
                                title=""
                                onBack={flow.close}
                                trailing={
                                    <span className="text-sm whitespace-nowrap text-text-muted">
                                        Langkah 1 dari 2
                                    </span>
                                }
                            />
                            <div className="flex-1">
                                <ConsentContent
                                    version={consent.version}
                                    retentionMonths={consent.retentionMonths}
                                    processing={flow.consenting}
                                    onAccept={flow.acceptConsent}
                                    stickyFooter
                                />
                            </div>
                        </>
                    )}

                    {camera && (
                        <>
                            <Header
                                dark
                                title={`Selfie ${verb}`}
                                subtitle={shiftLine}
                                onBack={
                                    flow.step === 'review'
                                        ? flow.retake
                                        : flow.close
                                }
                                trailing={
                                    <span className="font-mono text-[15px] text-text tnum">
                                        {formatTime(now)}
                                    </span>
                                }
                            />
                            <div className="flex min-h-0 flex-1 flex-col px-3 pb-2">
                                {flow.step === 'capture' ? (
                                    <SelfieCapture flow={flow} />
                                ) : (
                                    <SelfieReview flow={flow} />
                                )}
                            </div>
                        </>
                    )}

                    {scanning && (
                        <>
                            <Header
                                dark
                                title={`Pindai QR ${verb}`}
                                subtitle="Arahkan kamera ke layar kiosk"
                                onBack={flow.close}
                                trailing={
                                    <span className="font-mono text-[15px] text-text tnum">
                                        {formatTime(now)}
                                    </span>
                                }
                            />
                            <div className="flex min-h-0 flex-1 flex-col px-3 pb-2">
                                <QrScan flow={flow} />
                            </div>
                        </>
                    )}

                    {flow.step === 'success' && flow.result && (
                        <>
                            <DialogPrimitive.Title className="sr-only">
                                {verb} berhasil
                            </DialogPrimitive.Title>
                            <div className="px-4 pt-[calc(env(safe-area-inset-top)+24px)] pb-[calc(env(safe-area-inset-bottom)+24px)]">
                                <CheckSuccess
                                    result={flow.result}
                                    onDone={flow.close}
                                />
                            </div>
                        </>
                    )}

                    {flow.step === 'failure' && flow.rejection && (
                        <>
                            <Header
                                title={`${flow.type === 'in' ? 'Check-in' : 'Check-out'} belum bisa`}
                                subtitle={
                                    <>
                                        {formatDate(now)} ·{' '}
                                        <span className="font-mono">
                                            {formatTime(now)}
                                        </span>
                                    </>
                                }
                                onBack={flow.close}
                            />
                            <div className="px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+24px)]">
                                <CheckFailure
                                    rejection={flow.rejection}
                                    locations={today.locations}
                                    position={flow.geo.position}
                                    locating={flow.geo.state === 'locating'}
                                    onRefreshLocation={() =>
                                        void flow.retryWithFreshLocation()
                                    }
                                    onRetry={() =>
                                        flow.photo
                                            ? void flow.submit()
                                            : flow.start(flow.type)
                                    }
                                    onClose={flow.close}
                                    onScanQr={() => flow.start(flow.type, 'qr')}
                                />
                            </div>
                        </>
                    )}
                </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
        </DialogPrimitive.Root>
    );
}
