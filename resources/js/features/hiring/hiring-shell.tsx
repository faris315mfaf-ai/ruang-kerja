import { BriefcaseBusiness } from 'lucide-react';
import type { ReactNode } from 'react';
import { TabNav } from '@/components/ui/tabs';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { hiringUrls } from './lib';
import type { HiringOverview } from './types';

export type HiringTab = 'candidates' | 'positions' | 'settings';

/** "2 lowongan dibuka · 3 kandidat baru · 1 menunggu keputusan". */
export function overviewLine(overview: HiringOverview): string {
    const { counts } = overview;

    return [
        `${formatNumber(counts.open_positions)} lowongan dibuka`,
        `${formatNumber(counts.new_candidates)} kandidat baru`,
        `${formatNumber(counts.awaiting_decision)} menunggu keputusan`,
    ].join(' · ');
}

/** 64px gradient tile of the Hiring space (workspace-like identity). */
export function HiringTile({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-16 shrink-0 items-center justify-center rounded-[18px] bg-grad-indigo text-on-brand shadow-glow',
                className,
            )}
        >
            <BriefcaseBusiness className="size-[45%]" strokeWidth={2} />
        </span>
    );
}

/**
 * Header + tabs of the Hiring space, styled like a workspace (DProyek):
 * gradient tile, "Hiring", counts line, underlined tabs Kandidat · Lowongan ·
 * Pengaturan (HR only). On phones the app bar carries the title.
 */
export function HiringShell({
    overview,
    tab,
    actions,
    children,
}: {
    overview: HiringOverview;
    tab: HiringTab | null;
    /** Right side of the header (desktop) / below the meta line (phone). */
    actions?: ReactNode;
    children: ReactNode;
}) {
    const items = [
        { tab: 'candidates', label: 'Kandidat', href: hiringUrls.index() },
        { tab: 'positions', label: 'Lowongan', href: hiringUrls.positions },
        ...(overview.can_manage
            ? [
                  {
                      tab: 'settings',
                      label: 'Pengaturan',
                      href: hiringUrls.settings,
                  },
              ]
            : []),
    ].map((item) => ({
        href: item.href,
        label: item.label,
        active: item.tab === tab,
    }));

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-4">
                    <HiringTile className="hidden md:flex" />
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className="sr-only text-h1 md:not-sr-only">
                            Hiring
                        </h1>
                        <p className="text-meta text-text-muted md:text-body">
                            {overviewLine(overview)}
                        </p>
                    </div>
                </div>
                {actions && (
                    <div className="flex w-full flex-wrap gap-2 md:w-auto">
                        {actions}
                    </div>
                )}
            </header>
            <TabNav label="Bagian hiring" items={items} />
            {children}
        </div>
    );
}
