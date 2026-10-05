import type { IScannerControls } from '@zxing/browser';
import { AlertCircle, Camera, Loader2, QrCode } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { isKioskPayload } from '@/lib/kiosk';
import { cn } from '@/lib/utils';
import type { CheckFlow } from '../use-check-flow';

/**
 * Rear camera + QR decoding (@zxing/browser, loaded on demand). Reads the
 * kiosk code and hands it to the flow; other QR codes are ignored with a hint.
 */
export function QrScan({
    flow,
    className,
}: {
    flow: CheckFlow;
    className?: string;
}) {
    const { camera, submitQr, step } = flow;
    const [hint, setHint] = useState<string | null>(null);
    const [decoderError, setDecoderError] = useState(false);
    const handled = useRef(false);
    const submitting = step === 'submitting';
    const live = camera.state === 'live';

    useEffect(() => {
        const video = camera.videoRef.current;

        if (!live || !video || submitting) {
            return;
        }

        handled.current = false;
        let controls: IScannerControls | null = null;
        let cancelled = false;

        void import('@zxing/browser')
            .then(({ BrowserQRCodeReader }) => {
                if (cancelled) {
                    return;
                }

                const reader = new BrowserQRCodeReader(undefined, {
                    delayBetweenScanAttempts: 150,
                });

                return reader
                    .decodeFromVideoElement(video, (result, _error, ctrl) => {
                        if (!result || handled.current) {
                            return;
                        }

                        const text = result.getText();

                        if (!isKioskPayload(text)) {
                            setHint(
                                'Ini bukan kode kiosk RuangKerja. Arahkan kamera ke kode di layar kiosk.',
                            );

                            return;
                        }

                        handled.current = true;
                        ctrl.stop();
                        void submitQr(text);
                    })
                    .then((ctrl) => {
                        controls = ctrl;

                        if (cancelled) {
                            ctrl.stop();
                        }
                    });
            })
            .catch(() => setDecoderError(true));

        return () => {
            cancelled = true;
            controls?.stop();
        };
    }, [camera.videoRef, live, submitQr, submitting]);

    const failed = camera.error !== null || decoderError;

    return (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
                <video
                    ref={camera.attachVideo}
                    playsInline
                    muted
                    autoPlay
                    aria-label="Pratinjau kamera untuk memindai QR"
                    className={cn(
                        'absolute inset-0 size-full object-cover',
                        !live && 'opacity-0',
                    )}
                />
                <div
                    aria-hidden
                    className={cn(
                        'pointer-events-none absolute inset-0 flex items-center justify-center',
                        failed && 'hidden',
                    )}
                >
                    <div className="aspect-square w-[62%] max-w-[280px] rounded-2xl border-2 border-dashed border-text/80" />
                </div>
                {(camera.state === 'starting' || submitting) && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/60 text-text">
                        <Loader2 className="size-8 animate-spin" aria-hidden />
                        <span className="text-[15px]" role="status">
                            {submitting ? 'Mengirim…' : 'Membuka kamera…'}
                        </span>
                    </div>
                )}
                {failed && !submitting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                        <AlertCircle
                            className="size-8 text-warning"
                            aria-hidden
                        />
                        <p className="max-w-xs text-[15px] text-text">
                            {decoderError
                                ? 'Pemindai QR gagal dimuat. Periksa koneksi lalu coba lagi.'
                                : camera.state === 'denied'
                                  ? 'Akses kamera ditolak. Izinkan kamera untuk situs ini agar bisa memindai QR, atau pakai GPS + selfie.'
                                  : 'Kamera tidak bisa dibuka untuk memindai QR. Coba lagi atau pakai GPS + selfie.'}
                        </p>
                        <Button
                            type="button"
                            className="h-11"
                            onClick={() => flow.start(flow.type, 'gps')}
                        >
                            <Camera aria-hidden />
                            Pakai GPS + selfie
                        </Button>
                    </div>
                )}
                <div className="glass absolute inset-x-3 bottom-3 flex items-start gap-3 rounded-xl px-4 py-3 text-[15px] leading-6 text-text">
                    <QrCode
                        className="mt-0.5 size-5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    <span aria-live="polite">
                        {hint ??
                            'Arahkan kamera ke kode QR di layar kiosk. Kode berganti tiap 30 detik.'}
                    </span>
                </div>
            </div>
            <p className="pb-[calc(env(safe-area-inset-bottom)+8px)] text-center text-sm text-text-muted">
                {flow.geo.position
                    ? 'Lokasi GPS ikut direkam.'
                    : flow.geo.error
                      ? 'Lokasi tidak terbaca; check-in QR tetap bisa.'
                      : 'Membaca lokasi…'}
            </p>
        </div>
    );
}
