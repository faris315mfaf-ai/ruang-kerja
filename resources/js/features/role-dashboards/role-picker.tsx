import { ChipScroller } from '@/components/mobile/chip-scroller';
import { SegmentedTabs } from '@/components/ui/tabs';
import { ROLE_DASHBOARDS } from './fixtures';
import type { RoleKey } from './types';
import { ROLE_KEYS } from './types';

/**
 * Switches between the 8 SPKD role dashboards (preview aid; in production
 * each person sees only their own role). Desktop/tablet: segmented control
 * that scrolls sideways when it does not fit; phone: chip scroller.
 */
export function RolePicker({
    value,
    onChange,
    mobile,
}: {
    value: RoleKey;
    onChange: (role: RoleKey) => void;
    mobile: boolean;
}) {
    if (mobile) {
        return (
            <ChipScroller
                label="Pilih peran"
                value={value}
                onChange={onChange}
                chips={ROLE_KEYS.map((key) => ({
                    value: key,
                    label: ROLE_DASHBOARDS[key].shortLabel,
                }))}
            />
        );
    }

    return (
        <div className="-mx-1 [scrollbar-width:none] overflow-x-auto px-1 py-1 [&::-webkit-scrollbar]:hidden">
            <SegmentedTabs
                label="Pilih peran"
                variant="glass"
                value={value}
                onValueChange={onChange}
                options={ROLE_KEYS.map((key) => ({
                    value: key,
                    label: ROLE_DASHBOARDS[key].label,
                }))}
            />
        </div>
    );
}
