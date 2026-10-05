import type { KeyboardEvent } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { nextTabIndex, PERIOD_LABELS } from './lib';
import { FOCUS_RING } from './panel';
import type { PeriodKey } from './types';
import { PERIOD_KEYS } from './types';

export const tabId = (key: PeriodKey) => `periode-tab-${key}`;
export const PANEL_ID = 'periode-panel';

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
    const refs = useRef<(HTMLButtonElement | null)[]>([]);

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
        const index = PERIOD_KEYS.indexOf(value);
        const next = nextTabIndex(index, event.key, PERIOD_KEYS.length);

        if (next === null) {
            return;
        }

        event.preventDefault();
        onChange(PERIOD_KEYS[next]);
        refs.current[next]?.focus();
    };

    return (
        <div
            role="tablist"
            aria-label="Periode"
            className={cn(
                'flex gap-1 rounded-2xl border border-arus-border bg-arus-surface p-1',
                className,
            )}
        >
            {PERIOD_KEYS.map((key, index) => {
                const selected = key === value;

                return (
                    <button
                        key={key}
                        ref={(element) => {
                            refs.current[index] = element;
                        }}
                        id={tabId(key)}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        aria-controls={PANEL_ID}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => onChange(key)}
                        onKeyDown={onKeyDown}
                        className={cn(
                            'h-arus-control flex-1 rounded-arus-control px-5 text-[16px] font-bold whitespace-nowrap transition-colors duration-120 ease-brand',
                            FOCUS_RING,
                            selected
                                ? 'bg-arus-action text-arus-on-gradient'
                                : 'text-arus-text-2 hover:bg-arus-surface-2 hover:text-arus-text',
                        )}
                    >
                        {PERIOD_LABELS[key]}
                    </button>
                );
            })}
        </div>
    );
}
