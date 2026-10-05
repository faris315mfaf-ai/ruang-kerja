import { SegmentedTabs } from '@/components/ui/tabs';
import { PERIOD_LABELS } from './lib';
import type { PeriodKey } from './types';
import { PERIOD_KEYS } from './types';

export const tabId = (key: PeriodKey) => `periode-tab-${key}`;
export const PANEL_ID = 'periode-panel';

const OPTIONS = PERIOD_KEYS.map((key) => ({
    value: key,
    label: PERIOD_LABELS[key],
    id: tabId(key),
    controls: PANEL_ID,
}));

/**
 * Harian / Mingguan / Bulanan (WAI-ARIA tabs, automatic activation): the
 * data of all three periods is already on the page, so switching is instant.
 */
export function PeriodTabs({
    value,
    onChange,
    className,
}: {
    value: PeriodKey;
    onChange: (period: PeriodKey) => void;
    className?: string;
}) {
    return (
        <SegmentedTabs
            label="Periode"
            value={value}
            onValueChange={onChange}
            options={OPTIONS}
            variant="solid"
            className={className}
        />
    );
}
