import { SegmentedTabs } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { CheckMethod } from '@/types/attendance';

const OPTIONS: { value: CheckMethod; label: string }[] = [
    { value: 'gps', label: 'GPS + selfie' },
    { value: 'qr', label: 'Pindai QR' },
];

/**
 * Method switch of the check-in card (DAbsensi / MAbsen "Metode"): GPS +
 * selfie or scanning the lobby kiosk QR. Soft segmented tabs; `fill`
 * stretches the options over the full width (phone sheet).
 */
export function MethodSwitch({
    value,
    onChange,
    fill = false,
    className,
}: {
    value: CheckMethod;
    onChange: (method: CheckMethod) => void;
    fill?: boolean;
    className?: string;
}) {
    return (
        <SegmentedTabs
            label="Metode absensi"
            value={value}
            onValueChange={onChange}
            options={OPTIONS}
            variant="soft"
            className={cn(
                fill &&
                    'flex w-full rounded-lg [&>button]:h-11 [&>button]:flex-1 [&>button]:rounded-control [&>button]:text-[16px] [&>button]:font-bold',
                className,
            )}
        />
    );
}
