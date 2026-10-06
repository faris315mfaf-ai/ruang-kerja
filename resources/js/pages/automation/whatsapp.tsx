import { Head } from '@inertiajs/react';
import { Skeleton } from '@/components/ui/skeleton';
import { WHATSAPP } from '@/features/automation/fixtures';
import { usePreviewState } from '@/features/automation/preview-state';
import type { WhatsappSettings } from '@/features/automation/types';
import { WhatsappScreen } from '@/features/automation/whatsapp/whatsapp-screen';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /pengaturan/whatsapp — WhatsApp notification channel (Fase 2 · F2-4,
 * preview). Props default to fixtures; a controller can pass `settings`
 * with the same shape later.
 */
export default function AutomationWhatsappPage({
    whatsapp: settings = WHATSAPP,
}: {
    whatsapp?: WhatsappSettings;
}) {
    const breakpoint = useBreakpoint();
    const { state } = usePreviewState();
    const data: WhatsappSettings =
        state === 'empty'
            ? { ...settings, events: [], templates: [] }
            : settings;

    return (
        <>
            <Head title="WhatsApp" />
            {breakpoint === null ? (
                <div className="flex flex-col gap-4" aria-busy>
                    <Skeleton className="h-28 w-full rounded-panel" />
                    <Skeleton className="h-80 w-full rounded-panel" />
                </div>
            ) : (
                <WhatsappScreen
                    key={state}
                    settings={data}
                    state={state}
                    mobile={breakpoint === 'mobile'}
                />
            )}
        </>
    );
}

AutomationWhatsappPage.layout = {
    breadcrumbs: [
        { title: 'Pengaturan', href: '/settings/profile' },
        { title: 'WhatsApp', href: '/pengaturan/whatsapp' },
    ],
    title: 'WhatsApp',
    back: '/menu',
};
