import { Head } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { HubHeader } from './hub-header';
import { HubTabs } from './hub-tabs';
import type { Hub } from './types';

/**
 * Page frame of every Ruang HR tab. Desktop/tablet: header + TabNav above
 * the content. Phones: Ringkasan shows the date and the section chips;
 * the other tabs are child screens (back to /hr in the app bar, MPenugasan).
 */
export function HubShell({
    hub,
    title,
    mobile,
    subtitle,
    actions,
    children,
}: {
    hub: Hub;
    /** Document title. */
    title: string;
    mobile: boolean;
    subtitle?: ReactNode;
    /** Header actions (desktop/tablet). */
    actions?: ReactNode;
    children: ReactNode;
}) {
    return (
        <>
            <Head title={title} />
            {mobile ? (
                <div className="flex flex-col gap-4 pb-4">
                    {hub.tab === 'ringkasan' && (
                        <>
                            <p className="-mt-1 px-1 text-overline text-link">
                                {hub.today_label}
                            </p>
                            <HubTabs active={hub.tab} mobile />
                        </>
                    )}
                    {children}
                </div>
            ) : (
                <div className="flex flex-col gap-6 pb-6">
                    <div className="flex flex-col gap-6">
                        <HubHeader
                            hub={hub}
                            subtitle={subtitle}
                            actions={actions}
                        />
                        <HubTabs active={hub.tab} />
                    </div>
                    {children}
                </div>
            )}
        </>
    );
}
