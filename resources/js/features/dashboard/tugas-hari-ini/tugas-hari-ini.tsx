import { Link, usePage } from '@inertiajs/react';
import { ClipboardCheck } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { SegmentedTabs } from '@/components/ui/tabs';
import { Panel, PanelLink } from '@/components/ui/panel';
import { StatusPill } from '@/features/tasks/status-pill';
import { cn, focusRing } from '@/lib/utils';
import { MobileCard, SectionHeader } from '../dashboard-ui';
import type {
    TugasHariIniItem,
    TugasHariIniPayload,
    TugasSegment,
} from './types';

/** Label segmen + teks keadaan kosongnya (keputusan pemilik 9 Okt 2026). */
const SEGMENTS: Record<
    TugasSegment,
    { label: string; empty: string; emptyHint: string }
> = {
    pribadi: {
        label: 'Pribadi',
        empty: 'Belum ada tugas pribadi hari ini',
        emptyHint: 'Tugas di workspace pribadi yang jatuh tempo hari ini.',
    },
    tim: {
        label: 'Tim',
        empty: 'Belum ada tugas tim hari ini',
        emptyHint: 'Tugas workspace tim, divisi, dan proyek Anda hari ini.',
    },
    semua: {
        label: 'Semua',
        empty: 'Belum ada tugas hari ini',
        emptyHint: 'Tugas pribadi dan tim yang jatuh tempo hari ini.',
    },
};

const SEGMENT_ORDER: readonly TugasSegment[] = ['pribadi', 'tim', 'semua'];

/** Warna pil prioritas; "Tanpa" tidak ditampilkan. */
function priorityTone(priority: string) {
    if (priority === 'Urgent') {
        return 'danger' as const;
    }

    if (priority === 'Tinggi') {
        return 'warning' as const;
    }

    return 'neutral' as const;
}

/**
 * Penanda asal tugas: "dari absen" untuk tugas yang dibuat dari rencana kerja
 * saat absen masuk (source `attendance`), "penugasan atasan" untuk tugas tim
 * yang ditugaskan ke pengguna.
 */
function sourceMarker(
    item: TugasHariIniItem,
    inTim: boolean,
    viewerName: string | undefined,
): { label: string; tone: 'info' } | null {
    if (item.source === 'attendance') {
        return { label: 'dari absen', tone: 'info' };
    }

    if (
        inTim &&
        viewerName !== undefined &&
        item.assignees.includes(viewerName)
    ) {
        return { label: 'penugasan atasan', tone: 'info' };
    }

    return null;
}

function MetaChips({
    item,
    inTim,
}: {
    item: TugasHariIniItem;
    inTim: boolean;
}) {
    const viewerName = usePage().props.auth.user?.name;
    const marker = sourceMarker(item, inTim, viewerName);
    const priority = item.priority === 'Tanpa' ? null : item.priority;

    return (
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="truncate">
                {item.key} · {item.workspace.name}
            </span>
            {marker && (
                <Badge
                    variant="label"
                    tone={marker.tone}
                    className="h-[22px] px-2 text-[12px] font-semibold"
                >
                    {marker.label}
                </Badge>
            )}
            {priority && (
                <Badge
                    variant="label"
                    tone={priorityTone(priority)}
                    className="h-[22px] px-2 text-[12px] font-semibold"
                >
                    {priority}
                </Badge>
            )}
        </span>
    );
}

function TugasRow({
    item,
    inTim,
    compact,
}: {
    item: TugasHariIniItem;
    inTim: boolean;
    compact: boolean;
}) {
    return (
        <Link
            href={item.url}
            prefetch
            aria-label={`${item.key}: ${item.title}, buka tugas`}
            className={cn(
                'flex items-center gap-3 py-2 transition-colors duration-120 ease-brand hover:bg-surface-2/70 focus-visible:bg-surface-2',
                compact ? 'min-h-[60px] px-4' : 'min-h-11 px-6 md:px-7',
                focusRing,
                'focus-visible:ring-inset',
            )}
        >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                    className={cn(
                        compact
                            ? 'text-[17px] leading-[22px] font-semibold'
                            : 'text-[16px] leading-[22px] font-semibold',
                        item.status.is_done
                            ? 'text-text-muted line-through'
                            : 'text-text',
                    )}
                >
                    {item.title}
                </span>
                <MetaChips item={item} inTim={inTim} />
            </span>
            <StatusPill
                name={item.status.name}
                category={item.status.category}
                className="h-7 shrink-0 px-2.5 text-[13px]"
            />
        </Link>
    );
}

/**
 * Kartu "Tugas hari ini" (keputusan pemilik 9 Okt 2026): tugas yang jatuh
 * tempo hari ini dalam segmen Pribadi · Tim · Semua — satu daftar ringkas
 * (kunci, workspace, status, prioritas, asal tugas); menambah atau mengubah
 * tugas tetap lewat fitur tugas ("Kelola tugas").
 */
export function TugasHariIniCard({
    tugas,
    variant,
}: {
    tugas: TugasHariIniPayload;
    variant: 'desktop' | 'mobile';
}) {
    const [segment, setSegment] = useState<TugasSegment>('pribadi');
    const timIds = new Set(tugas.tim.map((item) => item.id));
    const items = tugas[segment];
    const compact = variant === 'mobile';

    const tabs = (
        <SegmentedTabs
            label="Segmen tugas hari ini"
            value={segment}
            onValueChange={setSegment}
            options={SEGMENT_ORDER.map((value) => ({
                value,
                id: `tugas-hari-ini-tab-${value}`,
                controls: 'tugas-hari-ini-panel',
                label: (
                    <>
                        {SEGMENTS[value].label}{' '}
                        <span className="tnum opacity-70">
                            {tugas.counts[value]}
                        </span>
                    </>
                ),
            }))}
            className={
                compact
                    ? 'flex w-full [&>button]:h-11 [&>button]:flex-1 [&>button]:px-2'
                    : undefined
            }
        />
    );

    const list =
        items.length === 0 ? (
            <EmptyState
                icon={ClipboardCheck}
                size="sm"
                title={SEGMENTS[segment].empty}
                description={SEGMENTS[segment].emptyHint}
                className={compact ? 'm-4' : 'm-5'}
            />
        ) : (
            <ul className="divide-y divide-divider">
                {items.map((item) => (
                    <li key={item.id}>
                        <TugasRow
                            item={item}
                            inTim={timIds.has(item.id)}
                            compact={compact}
                        />
                    </li>
                ))}
            </ul>
        );

    return variant === 'mobile' ? (
        <section
            aria-labelledby="tugas-hari-ini-heading"
            className="flex scroll-mt-20 flex-col gap-2.5"
        >
            <SectionHeader
                id="tugas-hari-ini-heading"
                title="Tugas hari ini"
                href="/tugas"
                link="Kelola tugas"
                linkLabel="Kelola tugas saya"
            />
            {tabs}
            <MobileCard
                id="tugas-hari-ini-panel"
                role="tabpanel"
                aria-labelledby={`tugas-hari-ini-tab-${segment}`}
            >
                {list}
            </MobileCard>
        </section>
    ) : (
        <Panel
            title="Tugas hari ini"
            action={<PanelLink href="/tugas">Kelola tugas</PanelLink>}
            flush
        >
            <div className="px-5 pb-3 md:px-6">{tabs}</div>
            <div
                id="tugas-hari-ini-panel"
                role="tabpanel"
                aria-labelledby={`tugas-hari-ini-tab-${segment}`}
            >
                {list}
            </div>
        </Panel>
    );
}
