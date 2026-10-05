import { AlertCircle, Camera, Loader2, QrCode, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRef } from 'react';
import { cn, focusRing } from '@/lib/utils';
import type { CheckFlow } from '../use-check-flow';
import { LocationChip } from './location-chip';

const control = cn(
    'flex size-14 items-center justify-center rounded-full border border-border bg-surface-2 text-text transition-colors duration-120 ease-brand hover:bg-surface disabled:opacity-50',
    focusRing,
);

/** Live front camera with the face oval (mockup CheckinSelfie). */
export function SelfieCapture({
    flow,
    className,
}: {
    flow: CheckFlow;
    className?: string;
}) {
    const { camera } = flow;
    const fileInput = useRef<HTMLInputElement>(null);
    const live = camera.state === 'live';
    const failed = camera.error !== null;

    return (
        <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface">
                <video
                    ref={camera.attachVideo}
                    playsInline
                    muted
                    autoPlay
                    aria-label="Pratinjau kamera"
                    className={cn(
                        'absolute inset-0 size-full object-cover',
                        camera.facing === 'user' && '-scale-x-100',
                        !live && 'opacity-0',
                    )}
                />
                <svg
                    aria-hidden
                    viewBox="0 0 100 133"
                    className="pointer-events-none absolute inset-0 size-full"
                    preserveAspectRatio="xMidYMid meet"
                >
                    <ellipse
                        cx="50"
                        cy="58"
                        rx="30"
                        ry="39"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="0.6"
                        strokeDasharray="2.2 1.6"
                        className="text-text/80"
                    />
                </svg>
                <div className="absolute inset-x-0 top-4 flex justify-center px-4">
                    <LocationChip flow={flow} />
                </div>
                {camera.state === 'starting' && (
                    <div className="absolute inset-0 flex items-center justify-center text-text-muted">
                        <Loader2
                            className="size-8 animate-spin"
                            aria-label="Membuka kamera"
                        />
                    </div>
                )}
                {failed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                        <AlertCircle
                            className="size-8 text-warning"
                            aria-hidden
                        />
                        <p className="max-w-xs text-[15px] text-text">
                            {camera.error}
                        </p>
                        <Button
                            type="button"
                            onClick={() => fileInput.current?.click()}
                        >
                            <Camera className="size-5" aria-hidden />
                            Ambil foto
                        </Button>
                    </div>
                )}
                <div className="glass-strong absolute inset-x-3 bottom-3 flex items-start gap-3 rounded-lg px-4 py-3 text-[15px] leading-6 text-text">
                    <AlertCircle
                        className="mt-0.5 size-5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    {flow.captureError ??
                        'Pastikan wajah terlihat jelas dan tidak memakai masker.'}
                </div>
            </div>

            <input
                ref={fileInput}
                type="file"
                accept="image/*"
                capture="user"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(event) => {
                    const file = event.target.files?.[0];

                    if (file) {
                        void flow.captureFile(file);
                    }

                    event.target.value = '';
                }}
            />

            <div className="grid grid-cols-3 items-center pb-[calc(env(safe-area-inset-bottom)+8px)]">
                <div className="flex flex-col items-center gap-1.5 text-meta font-semibold text-text-muted">
                    <button
                        type="button"
                        className={control}
                        onClick={() => flow.start(flow.type, 'qr')}
                        aria-label="Pindai QR kiosk"
                    >
                        <QrCode
                            className="size-6"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    </button>
                    Pindai QR
                </div>
                <div className="flex justify-center">
                    <button
                        type="button"
                        onClick={() =>
                            live
                                ? void flow.capture()
                                : fileInput.current?.click()
                        }
                        disabled={camera.state === 'starting'}
                        aria-label={live ? 'Ambil selfie' : 'Ambil foto'}
                        className="flex size-[76px] items-center justify-center rounded-full border-4 border-text bg-transparent p-1 transition-transform duration-120 ease-brand outline-none focus-visible:ring-4 focus-visible:ring-ring active:scale-95 disabled:opacity-50 motion-reduce:active:scale-100"
                    >
                        <span className="size-full rounded-full bg-text" />
                    </button>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-meta font-semibold text-text-muted">
                    <button
                        type="button"
                        className={control}
                        onClick={camera.switchCamera}
                        disabled={!live}
                        aria-label="Ganti kamera"
                    >
                        <RefreshCw
                            className="size-6"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                    </button>
                    Ganti kamera
                </div>
            </div>
        </div>
    );
}
