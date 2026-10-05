import { Camera, QrCode } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import type { CheckMethod } from '@/types/attendance';

const OPTIONS: { value: CheckMethod; label: string; icon: LucideIcon }[] = [
    { value: 'gps', label: 'GPS + Selfie', icon: Camera },
    { value: 'qr', label: 'Pindai QR', icon: QrCode },
];

/**
 * Method segmented control (docs/DESIGN.md §6, mockup Absensi): GPS + selfie
 * or scanning the lobby kiosk QR (Sprint 3). Arrow keys move the selection.
 */
export function MethodSwitch({
    value,
    onChange,
    className,
}: {
    value: CheckMethod;
    onChange: (method: CheckMethod) => void;
    className?: string;
}) {
    const base =
        'flex h-11 flex-1 items-center justify-center gap-2 rounded-md text-[15px] font-medium transition-colors duration-120 ease-brand focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none';

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (
            !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                event.key,
            )
        ) {
            return;
        }

        event.preventDefault();
        const next = value === 'gps' ? 'qr' : 'gps';
        onChange(next);
        event.currentTarget
            .querySelector<HTMLButtonElement>(`[data-value="${next}"]`)
            ?.focus();
    };

    return (
        <div
            role="radiogroup"
            aria-label="Metode absensi"
            onKeyDown={onKeyDown}
            className={cn('flex gap-1 rounded-lg bg-surface-2 p-1', className)}
        >
            {OPTIONS.map((option) => {
                const selected = option.value === value;
                const Icon = option.icon;

                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        data-value={option.value}
                        aria-checked={selected}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            base,
                            selected
                                ? 'bg-surface text-text shadow-card'
                                : 'text-text-muted hover:text-text',
                        )}
                    >
                        <Icon
                            className="size-5"
                            strokeWidth={1.75}
                            aria-hidden
                        />
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
