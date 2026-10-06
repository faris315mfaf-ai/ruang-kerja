import { Link } from '@inertiajs/react';
import {
    BriefcaseBusiness,
    CalendarCheck,
    ChevronRight,
    Clock,
    ShieldAlert,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Panel, PanelLink } from '@/components/ui/panel';
import { cn, focusRing } from '@/lib/utils';
import { HrTodayKpis } from './hr-parts';
import type { HrProps } from './hr-types';
import { RequestRows } from './request-rows';

/** One shortcut row into Absensi (count + label + chevron). */
function ShortcutRow({
    href,
    icon,
    label,
    detail,
    count,
    tone,
}: {
    href: string;
    icon: ReactNode;
    label: string;
    detail: string;
    count?: number;
    tone: 'warning' | 'danger' | 'info';
}) {
    return (
        <Link
            href={href}
            prefetch
            className={cn(
                'flex min-h-[64px] items-center gap-3.5 rounded-lg px-1 py-2.5 transition-colors duration-120 ease-brand hover:bg-surface-2/60',
                focusRing,
            )}
        >
            <span
                aria-hidden
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-control',
                    tone === 'warning' && 'bg-warning-soft text-warning',
                    tone === 'danger' && 'bg-danger-soft text-danger',
                    tone === 'info' && 'bg-info-soft text-info',
                )}
            >
                {icon}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[16px] font-semibold">{label}</span>
                <span className="truncate text-meta text-text-muted">
                    {detail}
                </span>
            </span>
            {count !== undefined && (
                <Badge
                    variant="status"
                    tone={count > 0 ? tone : 'neutral'}
                    className="h-7 tnum"
                >
                    {count}
                </Badge>
            )}
            <ChevronRight
                aria-hidden
                className="size-5 shrink-0 text-text-subtle"
            />
        </Link>
    );
}

/**
 * "Absensi hari ini" on the HR dashboard (keputusan pemilik 6 Okt 2026):
 * today's numbers and links into Absensi — the lists of people, the review
 * queue and missing check-outs live there.
 */
export function AttendanceSummaryPanel({
    attendance,
    live,
    compact = false,
}: {
    attendance: HrProps['attendance'];
    live: ReactNode;
    compact?: boolean;
}) {
    return (
        <Panel
            title={
                <>
                    Absensi hari ini
                    {live}
                </>
            }
            action={
                compact ? undefined : (
                    <PanelLink href="/absensi/hari-ini">Buka Absensi</PanelLink>
                )
            }
            className={cn(compact && 'py-5')}
            bodyClassName="gap-4"
        >
            <div
                className={cn(
                    compact
                        ? 'grid grid-cols-2 gap-2.5'
                        : 'flex flex-wrap gap-4',
                )}
            >
                <HrTodayKpis attendance={attendance} compact={compact} />
            </div>
            <div className="flex flex-col divide-y divide-divider">
                <ShortcutRow
                    href="/absensi/hari-ini"
                    icon={<ShieldAlert className="size-5" />}
                    label="Perlu ditinjau"
                    detail="Absensi tidak biasa 7 hari terakhir"
                    count={attendance.review_count}
                    tone="danger"
                />
                <ShortcutRow
                    href="/absensi/hari-ini"
                    icon={<Clock className="size-5" />}
                    label="Lupa check-out kemarin"
                    detail="Lengkapi lewat koreksi absensi"
                    count={attendance.missing_check_out_count}
                    tone="warning"
                />
                <ShortcutRow
                    href="/absensi/kedisiplinan"
                    icon={<CalendarCheck className="size-5" />}
                    label="Kedisiplinan & rekap"
                    detail="Kedisiplinan hadir, keterlambatan, alpha, penyelesaian"
                    tone="info"
                />
            </div>
        </Panel>
    );
}

export function PendingHrPanel({
    pending,
    compact = false,
}: {
    pending: HrProps['pending'];
    compact?: boolean;
}) {
    return (
        <Panel
            title={
                <>
                    Pengajuan menunggu HR
                    <Badge className="h-7 px-2.5 text-[15px]">
                        {pending.count}
                    </Badge>
                </>
            }
            flush
            className={cn(compact ? 'py-5' : 'pb-3')}
        >
            <RequestRows
                items={pending.items}
                showUser
                hrefBase="/persetujuan"
                empty="Tidak ada pengajuan yang menunggu HR."
            />
            <div className="border-t border-divider px-6 pt-3 md:px-7">
                <PanelLink href="/persetujuan">
                    Buka antrean ({pending.count})
                </PanelLink>
            </div>
        </Panel>
    );
}

/** Hiring card: a link once the Hiring module exists, else a quiet note. */
export function HiringCard({ href }: { href: string | null }) {
    return (
        <Panel title="Hiring" bodyClassName="gap-3">
            <p className="flex items-start gap-3 text-body text-text-muted">
                <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-control bg-link-soft text-link"
                >
                    <BriefcaseBusiness className="size-5" />
                </span>
                {href
                    ? 'Lowongan, kandidat, dan jadwal wawancara.'
                    : 'Modul hiring belum aktif. Kartu ini menaut ke modul hiring setelah tersedia.'}
            </p>
            {href && <PanelLink href={href}>Buka hiring</PanelLink>}
        </Panel>
    );
}
