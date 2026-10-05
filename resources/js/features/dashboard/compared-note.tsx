import type { ComparedPeriods } from '@/types/dashboard';

/**
 * Which days the numbers cover and what the deltas compare with: a running
 * period is counted up to today and compared with the same number of days
 * at the start of the previous period.
 */
export function ComparedNote({ compared }: { compared: ComparedPeriods }) {
    return (
        <p className="text-[13px] text-text-muted">
            Dihitung {compared.current.label}; selisih dibandingkan dengan{' '}
            {compared.previous.label} (jumlah hari yang sama).
        </p>
    );
}
