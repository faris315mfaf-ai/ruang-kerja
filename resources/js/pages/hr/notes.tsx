import { HrNotes } from '@/features/hr/notes';
import { HubSkeleton } from '@/features/hr/page-skeleton';
import type { HrNotesProps } from '@/features/hr/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/** Ruang HR › Catatan (keputusan pemilik 20 Okt 2026). */
export default function HrNotesPage(props: HrNotesProps) {
    const breakpoint = useBreakpoint();

    if (breakpoint === null) {
        return <HubSkeleton />;
    }

    return <HrNotes props={props} mobile={breakpoint === 'mobile'} />;
}

HrNotesPage.layout = {
    breadcrumbs: [
        { title: 'Ruang HR', href: '/hr' },
        { title: 'Catatan', href: '/hr/catatan' },
    ],
    title: 'Catatan',
    back: '/hr',
    width: 'wide',
};
