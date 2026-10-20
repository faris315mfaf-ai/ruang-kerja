import type { ReactNode } from 'react';
import { PageHeader } from '@/features/dashboard/dashboard-ui';
import type { Hub } from './types';

/**
 * Header of Ruang HR on desktop & tablet (Main.dc.html): office date as
 * overline, "Ruang HR", an optional subtitle and the tab's actions.
 */
export function HubHeader({
    hub,
    subtitle,
    actions,
}: {
    hub: Hub;
    subtitle?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <PageHeader
            overline={hub.today_label}
            title="Ruang HR"
            subtitle={subtitle}
        >
            {actions}
        </PageHeader>
    );
}
