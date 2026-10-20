import { router } from '@inertiajs/react';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { TabNav } from '@/components/ui/tabs';
import { HUB_TABS } from './lib';
import type { HubTab } from './types';

/**
 * The six sections of Ruang HR: underlined TabNav on desktop/tablet,
 * scrolling chips on phones (MRuangHR).
 */
export function HubTabs({
    active,
    mobile = false,
    className,
}: {
    active: HubTab;
    mobile?: boolean;
    className?: string;
}) {
    if (mobile) {
        return (
            <ChipScroller
                label="Bagian Ruang HR"
                chips={HUB_TABS.map((tab) => ({
                    value: tab.key,
                    label: tab.label,
                }))}
                value={active}
                onChange={(value) => {
                    const tab = HUB_TABS.find((item) => item.key === value);

                    if (tab && value !== active) {
                        router.visit(tab.href);
                    }
                }}
                className={className}
            />
        );
    }

    return (
        <TabNav
            label="Bagian Ruang HR"
            className={className}
            items={HUB_TABS.map((tab) => ({
                href: tab.href,
                label: tab.label,
                active: tab.key === active,
            }))}
        />
    );
}
