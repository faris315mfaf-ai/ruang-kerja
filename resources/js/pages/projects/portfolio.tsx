import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { PortfolioDesktop } from '@/features/portfolio/portfolio.desktop';
import { PortfolioMobile } from '@/features/portfolio/portfolio.mobile';
import type { PortfolioProps } from '@/features/portfolio/types';
import { usePortfolio } from '@/features/portfolio/use-portfolio';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** /portofolio — Dashboard Direksi = portofolio proyek (Sprint 9, PRD M10). */
export default function Portfolio(props: PortfolioProps) {
    const breakpoint = useBreakpoint();
    const actions = usePortfolio(props.filters);

    return (
        <>
            <Head title="Portofolio proyek" />
            {breakpoint === null ? (
                <div className="space-y-4" aria-busy>
                    <Skeleton className="h-8 w-56" />
                    <Skeleton className="h-32 w-full" />
                    <Skeleton className="h-80 w-full" />
                </div>
            ) : breakpoint === 'mobile' ? (
                <PortfolioMobile props={props} actions={actions} />
            ) : (
                <PortfolioDesktop props={props} actions={actions} />
            )}
        </>
    );
}

Portfolio.layout = {
    breadcrumbs: [
        { title: 'Dashboard', href: '/dashboard' },
        { title: 'Portofolio proyek', href: '/portofolio' },
    ],
    title: 'Portofolio proyek',
};
