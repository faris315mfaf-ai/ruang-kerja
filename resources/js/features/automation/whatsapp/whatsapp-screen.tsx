import {
    PreviewBar,
    PreviewError,
    PreviewSkeleton,
} from '@/features/automation/preview-state';
import type { PreviewState } from '@/features/automation/preview-state';
import type { WhatsappSettings } from '@/features/automation/types';
import { ConnectionCard } from '@/features/automation/whatsapp/connection-card';
import {
    EventOptinsList,
    EventOptinsTable,
} from '@/features/automation/whatsapp/event-optins';
import { SettingsHeader } from '@/features/automation/whatsapp/settings-header';
import {
    ProviderCard,
    QuietHoursCard,
    TemplatePreviewCard,
} from '@/features/automation/whatsapp/side-cards';
import { useWhatsapp } from '@/features/automation/whatsapp/use-whatsapp';

type Props = {
    settings: WhatsappSettings;
    state: PreviewState;
    mobile: boolean;
};

function Overline({ children }: { children: string }) {
    return (
        <h2 className="px-1 pt-1 text-overline text-text-muted">{children}</h2>
    );
}

/**
 * Pengaturan › WhatsApp (SPengaturan / MSPengaturan style). Desktop &
 * tablet: connect + opt-in matrix on the left, quiet hours, message preview
 * and provider info on the right. Phone: one column with overline sections.
 */
export function WhatsappScreen({ settings, state, mobile }: Props) {
    const wa = useWhatsapp(settings);

    const body =
        state === 'loading' ? (
            <PreviewSkeleton />
        ) : state === 'error' ? (
            <PreviewError what="Pengaturan WhatsApp" />
        ) : mobile ? (
            <div className="flex flex-col gap-4">
                <ConnectionCard wa={wa} />
                <Overline>Kirim lewat WhatsApp</Overline>
                <EventOptinsList wa={wa} />
                <QuietHoursCard wa={wa} />
                {wa.settings.templates.length > 0 && (
                    <TemplatePreviewCard templates={wa.settings.templates} />
                )}
                <ProviderCard provider={wa.settings.provider} />
            </div>
        ) : (
            <div className="flex flex-wrap items-start gap-5">
                <div className="flex min-w-0 flex-[1.4_1_560px] flex-col gap-5">
                    <ConnectionCard wa={wa} />
                    <EventOptinsTable wa={wa} />
                </div>
                <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
                    <QuietHoursCard wa={wa} />
                    {wa.settings.templates.length > 0 && (
                        <TemplatePreviewCard
                            templates={wa.settings.templates}
                        />
                    )}
                    <ProviderCard provider={wa.settings.provider} />
                </div>
            </div>
        );

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <PreviewBar />
            <h1 className="hidden md:sr-only md:block">Pengaturan WhatsApp</h1>
            <SettingsHeader />
            {body}
        </div>
    );
}
