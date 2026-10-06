import { Link } from '@inertiajs/react';
import { ChevronRight } from 'lucide-react';
import { useInitials } from '@/hooks/use-initials';
import { cn, focusRing } from '@/lib/utils';
import { TEXT_CLASSES } from './lib';
import { PanelEmpty, PlaceChip, RoleListRow } from './parts';
import type { RoleDashboard } from './types';

/** Phone home of one SPKD role (RolePhone / PeranM*). */
export function RoleDashboardMobile({
    config,
    onOpenFlow,
    onSecondary,
}: {
    config: RoleDashboard;
    onOpenFlow: () => void;
    onSecondary: () => void;
}) {
    const getInitials = useInitials();
    const phone = config.phone;
    const [primaryLabel, secondaryLabel] = phone.actions;

    return (
        <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[14px] font-extrabold text-link">
                        SPKD · {config.unit}
                    </span>
                    <span className="text-[26px] leading-8 font-extrabold tracking-[-0.02em]">
                        {config.greetingShort}
                    </span>
                </span>
                <span
                    aria-hidden
                    className="flex size-12 shrink-0 items-center justify-center rounded-full bg-grad-merek text-[16px] font-extrabold text-on-brand"
                >
                    {getInitials(config.person)}
                </span>
            </div>

            <section
                aria-label={phone.hero.label}
                className="flex flex-col gap-1.5 rounded-panel bg-primary bg-grad-highlight p-[18px] text-on-brand shadow-glow"
            >
                <span className="text-[15px] font-bold">
                    {phone.hero.label}
                </span>
                <span className="text-[40px] leading-[46px] font-extrabold tracking-[-0.02em] tnum">
                    {phone.hero.value}
                </span>
                <span className="text-[15px] leading-[21px]">
                    {phone.hero.note}
                </span>
            </section>

            <div className="grid grid-cols-2 gap-2.5">
                {phone.tiles.map((tile) => (
                    <section
                        key={tile.label}
                        aria-label={tile.label}
                        className="flex flex-col gap-0.5 rounded-card border border-border bg-surface p-3.5"
                    >
                        <span className="text-[14px] font-semibold text-text-muted">
                            {tile.label}
                        </span>
                        <span
                            className={cn(
                                'text-[28px] leading-[34px] font-extrabold tnum',
                                TEXT_CLASSES[tile.tone],
                            )}
                        >
                            {tile.value}
                        </span>
                        <span className="text-[13px] text-text-muted">
                            {tile.note}
                        </span>
                    </section>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
                <button
                    type="button"
                    onClick={onOpenFlow}
                    className={cn(
                        'flex min-h-12 items-center justify-center rounded-[14px] bg-inverse px-2 text-center text-[15px] leading-[18px] font-extrabold text-on-inverse transition-transform duration-120 ease-brand active:scale-[0.98] motion-reduce:active:scale-100',
                        focusRing,
                    )}
                >
                    {primaryLabel}
                </button>
                <button
                    type="button"
                    onClick={onSecondary}
                    className={cn(
                        'flex min-h-12 items-center justify-center rounded-[14px] border border-border-strong bg-surface px-2 text-center text-[15px] leading-[18px] font-extrabold text-text transition-transform duration-120 ease-brand active:scale-[0.98] motion-reduce:active:scale-100',
                        focusRing,
                    )}
                >
                    {secondaryLabel}
                </button>
            </div>

            <Link
                href="/rapat"
                prefetch
                className={cn(
                    'flex items-center gap-3 rounded-card border border-border bg-surface px-3.5 py-3 text-text',
                    focusRing,
                )}
            >
                <span className="flex w-[52px] shrink-0 flex-col">
                    <span className="text-[18px] font-extrabold tnum">
                        {phone.next.time}
                    </span>
                    <span className="text-[12px] font-bold text-text-muted">
                        {phone.next.day}
                    </span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[16px] font-bold">
                        {phone.next.title}
                    </span>
                    <span className="flex items-center gap-1.5 text-[13px] text-text-muted">
                        <PlaceChip place={phone.next.place} />
                        jadwal terdekat
                    </span>
                </span>
                <ChevronRight
                    aria-hidden
                    className="size-[18px] shrink-0 text-text-subtle"
                    strokeWidth={2.4}
                />
            </Link>

            <section
                aria-label={phone.listTitle}
                className="rounded-[22px] border border-border bg-surface px-4 pt-3.5 pb-0.5"
            >
                <div className="flex items-baseline justify-between pb-1.5">
                    <h2 className="text-[17px] font-extrabold">
                        {phone.listTitle}
                    </h2>
                    <span className="text-[14px] font-semibold text-text-muted">
                        {phone.rows.length} item
                    </span>
                </div>
                {phone.rows.length === 0 ? (
                    <div className="pb-4">
                        <PanelEmpty title="Tidak ada yang menunggu" />
                    </div>
                ) : (
                    <ul className="divide-y divide-divider border-t border-divider">
                        {phone.rows.map((row, index) => (
                            <li key={`${row.tag}-${row.title}`}>
                                <RoleListRow
                                    row={row}
                                    compact
                                    onOpen={
                                        index === 0 &&
                                        config.flowRow !== undefined
                                            ? onOpenFlow
                                            : undefined
                                    }
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}
