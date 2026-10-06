import { Eye, ScanFace, UserRound } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { LIVENESS_STEPS, livenessProgress } from './logic';
import type { LivenessProgress } from './logic';

/** Oval guide starting at 12 o'clock, so the progress stroke grows clockwise from the top. */
const OVAL = 'M120 32 a92 118 0 1 1 0 236 a92 118 0 1 1 0 -236';

/**
 * Simulated liveness run: advances through `steps` every `stepMs` while
 * `running`, then calls `onDone` once.
 */
export function useLiveness(
    running: boolean,
    stepMs: number,
    steps: number,
    onDone: () => void,
): LivenessProgress {
    const [elapsed, setElapsed] = useState(0);
    const done = useRef(onDone);

    useEffect(() => {
        done.current = onDone;
    }, [onDone]);

    useEffect(() => {
        if (!running) {
            return;
        }

        const start = performance.now();
        let finished = false;
        const tick = window.setInterval(() => {
            const now = performance.now() - start;

            setElapsed(now);

            if (!finished && now >= stepMs * steps) {
                finished = true;
                window.clearInterval(tick);
                done.current();
            }
        }, 80);

        return () => window.clearInterval(tick);
    }, [running, stepMs, steps]);

    return livenessProgress(running ? elapsed : 0, stepMs, steps);
}

/**
 * Camera area of the face flow: live front camera when allowed, otherwise
 * an illustration; oval guide with a progress stroke, dimmed outside.
 */
export function FaceViewport({
    attachVideo,
    live,
    progress,
    hint,
    tone = 'brand',
    className,
}: {
    attachVideo: (element: HTMLVideoElement | null) => void;
    live: boolean;
    /** 0–100 around the oval. */
    progress: number;
    /** Instruction chip at the bottom ("Kedipkan mata"). */
    hint?: string | null;
    tone?: 'brand' | 'danger' | 'success';
    className?: string;
}) {
    return (
        <div
            className={cn(
                'relative mx-auto aspect-[3/4] w-full max-w-[300px] overflow-hidden rounded-[28px] bg-grad-slate',
                className,
            )}
        >
            {live ? (
                <video
                    ref={attachVideo}
                    playsInline
                    muted
                    aria-label="Kamera depan"
                    className="absolute inset-0 h-full w-full -scale-x-100 object-cover"
                />
            ) : (
                <UserRound
                    aria-hidden
                    strokeWidth={1.2}
                    className="absolute top-[14%] left-1/2 size-[62%] -translate-x-1/2 text-on-brand/35"
                />
            )}
            <svg
                aria-hidden
                viewBox="0 0 240 320"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full"
            >
                <path
                    fillRule="evenodd"
                    className="text-preview-dark/55"
                    fill="currentColor"
                    d="M0 0h240v320H0z M28 150 a92 118 0 1 0 184 0 a92 118 0 1 0 -184 0z"
                />
                <ellipse
                    cx="120"
                    cy="150"
                    rx="92"
                    ry="118"
                    fill="none"
                    strokeWidth="3"
                    strokeDasharray="6 6"
                    className="text-on-brand/60"
                    stroke="currentColor"
                />
                <path
                    d={OVAL}
                    fill="none"
                    strokeWidth="6"
                    strokeLinecap="round"
                    pathLength={100}
                    strokeDasharray={`${progress} 100`}
                    stroke="currentColor"
                    className={cn(
                        'transition-[stroke-dasharray] duration-180 ease-brand',
                        tone === 'danger'
                            ? 'text-fill-danger'
                            : tone === 'success'
                              ? 'text-success'
                              : 'text-brand-300',
                    )}
                />
            </svg>
            {hint && (
                <span
                    role="status"
                    aria-live="polite"
                    className="absolute inset-x-4 bottom-4 flex min-h-11 items-center justify-center gap-2 rounded-full bg-preview-dark/70 px-4 text-center text-[15px] font-bold text-on-brand backdrop-blur-md"
                >
                    {hint.startsWith('Kedip') ? (
                        <Eye aria-hidden className="size-5 shrink-0" />
                    ) : (
                        <ScanFace aria-hidden className="size-5 shrink-0" />
                    )}
                    {hint}
                </span>
            )}
        </div>
    );
}

/** Pills under the viewport: which liveness steps are done. */
export function LivenessSteps({ step }: { step: number }) {
    return (
        <ol className="flex flex-wrap justify-center gap-2">
            {LIVENESS_STEPS.map((item, index) => (
                <li
                    key={item.key}
                    aria-current={index === step ? 'step' : undefined}
                    className={cn(
                        'flex min-h-8 items-center rounded-full px-3 text-[14px] font-bold',
                        index < step
                            ? 'bg-success-soft text-success'
                            : index === step
                              ? 'bg-link-soft text-link'
                              : 'bg-surface-2 text-text-muted',
                    )}
                >
                    {index < step ? '✓ ' : ''}
                    {item.short}
                </li>
            ))}
        </ol>
    );
}
