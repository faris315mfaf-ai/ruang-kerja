import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PrototypeBanner } from '@/features/prototype/prototype-banner';
import { cn } from '@/lib/utils';
import type { PreviewState } from './preview';
import { parsePreviewState } from './preview';

export type { PreviewState };
export { parsePreviewState };

const LABELS: Record<PreviewState, string> = {
    normal: 'Normal',
    memuat: 'Memuat',
    kosong: 'Kosong',
    galat: 'Galat',
};

/** Current forced state of a preview page (reactive to Inertia visits). */
export function usePreviewState(): PreviewState {
    const { url } = usePage();

    return parsePreviewState(url);
}

function withState(url: string, state: PreviewState): string {
    const [path, query = ''] = url.split('?');
    const params = new URLSearchParams(query);

    if (state === 'normal') {
        params.delete('keadaan');
    } else {
        params.set('keadaan', state);
    }

    const next = params.toString();

    return next ? `${path}?${next}` : path;
}

/**
 * Prototype banner + "Keadaan" menu (normal · memuat · kosong · galat) so
 * reviewers can see the skeleton, empty and error states of a preview page.
 */
export function PreviewHeader({ className }: { className?: string }) {
    const { url } = usePage();
    const current = parsePreviewState(url);

    return (
        <div
            className={cn(
                'flex flex-wrap items-center justify-between gap-2',
                className,
            )}
        >
            <PrototypeBanner phase="Fase 3" />
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-11 text-text-muted md:h-9"
                    >
                        <Eye aria-hidden />
                        Keadaan: {LABELS[current]}
                        <ChevronDown aria-hidden />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Lihat keadaan halaman</DropdownMenuLabel>
                    {(Object.keys(LABELS) as PreviewState[]).map((state) => (
                        <DropdownMenuItem key={state} asChild>
                            <Link
                                href={withState(url, state)}
                                preserveScroll
                                aria-current={
                                    state === current ? 'true' : undefined
                                }
                                className={cn(
                                    'min-h-11 md:min-h-10',
                                    state === current && 'font-bold',
                                )}
                            >
                                {LABELS[state]}
                            </Link>
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
