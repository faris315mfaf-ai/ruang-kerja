import type { ReactNode } from 'react';
import { AppShellSkeleton } from '@/components/shell/app-shell-skeleton';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import AppLayout from '@/layouts/app-layout';

/**
 * /cari: full-screen on mobile (no app bar / tab bar, mockup MCari);
 * regular shell on tablet & desktop.
 */
export function SearchLayout({ children }: { children: ReactNode }) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <AppShellSkeleton />;
    }

    if (breakpoint === 'mobile') {
        return <main className="min-h-svh px-4">{children}</main>;
    }

    return (
        <AppLayout breadcrumbs={[{ title: 'Cari', href: '/cari' }]}>
            {children}
        </AppLayout>
    );
}
