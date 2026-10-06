import { Link, usePage } from '@inertiajs/react';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { cn, focusRing } from '@/lib/utils';

export type PreviewState = 'normal' | 'memuat' | 'kosong' | 'galat';

const STATES: { value: PreviewState; label: string }[] = [
    { value: 'normal', label: 'Normal' },
    { value: 'memuat', label: 'Memuat' },
    { value: 'kosong', label: 'Kosong' },
    { value: 'galat', label: 'Galat' },
];

/** `?keadaan=memuat|kosong|galat` (read on the client). */
export function parsePreviewState(url: string): PreviewState {
    const query = url.includes('?') ? url.slice(url.indexOf('?')) : '';
    const value = new URLSearchParams(query).get('keadaan');

    return STATES.some((state) => state.value === value)
        ? (value as PreviewState)
        : 'normal';
}

export function usePreviewState(): PreviewState {
    return parsePreviewState(usePage().url);
}

/**
 * Prototype banner + a small switch to preview the loading, empty and error
 * states of the screen (sample data only).
 */
export function PreviewBar({
    phase = 'Fase 2',
    className,
}: {
    phase?: 'Fase 2' | 'Fase 3';
    className?: string;
}) {
    const page = usePage();
    const current = parsePreviewState(page.url);
    const path = page.url.split('?')[0];

    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-2',
                className,
            )}
        >
            <PrototypeBanner phase={phase} />
            <nav
                aria-label="Keadaan pratinjau"
                className="flex items-center gap-0.5 text-[14px] text-text-muted"
            >
                <span className="mr-1 hidden sm:inline">Lihat keadaan:</span>
                {STATES.map((state) => (
                    <Link
                        key={state.value}
                        href={
                            state.value === 'normal'
                                ? path
                                : `${path}?keadaan=${state.value}`
                        }
                        preserveScroll
                        aria-current={
                            current === state.value ? 'true' : undefined
                        }
                        className={cn(
                            'inline-flex min-h-11 items-center rounded-full px-2.5 font-semibold transition-colors duration-120 ease-brand md:min-h-8',
                            current === state.value
                                ? 'bg-surface-2 text-text'
                                : 'hover:text-text',
                            focusRing,
                        )}
                    >
                        {state.label}
                    </Link>
                ))}
            </nav>
        </div>
    );
}
