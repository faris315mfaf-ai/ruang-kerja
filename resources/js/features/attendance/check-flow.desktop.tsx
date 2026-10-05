import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatTime } from '@/lib/format';
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

/** Desktop/tablet: the same steps in a dialog (check-in is a topbar action on desktop). */
export function CheckFlowDesktop({ flow, today, consent, now }: Props) {
    const open = flow.step !== 'idle';
    const scanning =
        flow.method === 'qr' &&
        (flow.step === 'scan' || flow.step === 'submitting');
    const camera =
        !scanning &&
        (flow.step === 'capture' ||
            flow.step === 'review' ||
            flow.step === 'submitting');
    const verb = flow.type === 'in' ? 'Check-in' : 'Check-out';

    const titles: Record<string, { title: string; description: string }> = {
        consent: {
            title: 'Persetujuan data absensi',
            description: `Langkah 1 dari 2 · kebijakan versi ${consent.version}`,
        },
        capture: {
            title: `Selfie ${verb.toLowerCase()}`,
            description: today.schedule.hours
                ? `Shift ${today.schedule.shiftName} · ${today.schedule.hours}`
                : 'Tidak ada jadwal hari ini',
        },
        review: {
            title: `Kirim ${verb.toLowerCase()}`,
            description: `Pukul ${formatTime(now)}`,
        },
        scan: {
            title: `Pindai QR ${verb.toLowerCase()}`,
            description: 'Arahkan kamera ke layar kiosk',
        },
        submitting: {
            title: `Kirim ${verb.toLowerCase()}`,
            description: 'Mengirim data…',
        },
        success: {
            title: `${verb} berhasil`,
            description: 'Data absensi tersimpan.',
        },
        failure: {
            title: `${verb} belum bisa`,
            description: 'Lihat pilihan di bawah.',
        },
    };
    const heading = titles[flow.step] ?? titles.capture;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) =>
                !next && flow.step !== 'submitting' && flow.close()
            }
        >
            <DialogContent
                className={cn(
                    'max-h-[92vh] overflow-y-auto sm:max-w-[520px]',
                    (camera || scanning) && 'dark bg-background text-text',
                )}
            >
                <DialogHeader
                    className={cn(flow.step === 'success' && 'sr-only')}
                >
                    <DialogTitle className="text-[17px] text-text">
                        {heading.title}
                    </DialogTitle>
                    <DialogDescription className="text-text-muted">
                        {heading.description}
                    </DialogDescription>
                </DialogHeader>

                {flow.step === 'consent' && (
                    <ConsentContent
                        version={consent.version}
                        retentionMonths={consent.retentionMonths}
                        processing={flow.consenting}
                        onAccept={flow.acceptConsent}
                    />
                )}

                {camera && (
                    <div className="flex h-[min(68vh,620px)] flex-col">
                        {flow.step === 'capture' ? (
                            <SelfieCapture flow={flow} />
                        ) : (
                            <SelfieReview flow={flow} />
                        )}
                    </div>
                )}

                {scanning && (
                    <div className="flex h-[min(68vh,620px)] flex-col">
                        <QrScan flow={flow} />
                    </div>
                )}

                {flow.step === 'success' && flow.result && (
                    <CheckSuccess result={flow.result} onDone={flow.close} />
                )}

                {flow.step === 'failure' && flow.rejection && (
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
                )}
            </DialogContent>
        </Dialog>
    );
}
