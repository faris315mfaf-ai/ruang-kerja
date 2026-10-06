import { FlaskConical } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Marks a Fase 2/3 preview page: sample data, nothing is saved. Put it once
 * near the top of every preview screen (desktop and mobile).
 */
export function PrototypeBanner({
    phase,
    className,
}: {
    /** "Fase 2" or "Fase 3". */
    phase: 'Fase 2' | 'Fase 3';
    className?: string;
}) {
    return (
        <p
            role="note"
            className={cn(
                'flex w-fit items-center gap-2 rounded-full border border-border bg-info-soft px-3 py-1.5 text-[14px] leading-5 font-semibold text-info',
                className,
            )}
        >
            <FlaskConical aria-hidden className="size-4" strokeWidth={2} />
            <span>
                Pratinjau {phase} · data contoh, perubahan tidak disimpan
            </span>
        </p>
    );
}
