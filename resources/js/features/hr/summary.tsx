import { Link, router } from '@inertiajs/react';
import {
    CalendarDays,
    CheckCheck,
    FileText,
    ListTodo,
    Megaphone,
    Plus,
    UsersRound,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel, PanelLink } from '@/components/ui/panel';
import { BriefingCard } from '@/features/briefings/briefing-card';
import { LiveBadge } from '@/features/dashboard/live-badge';
import { formatNumber, formatRelative } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { HubShell } from './hub-shell';
import { EVENT_KINDS, EVENT_KIND_ORDER } from './lib';
import {
    ActionRow,
    AgendaRow,
    AssignmentStatusBadge,
    DivisionAttendance,
    SplitBar,
    assignmentMeta,
} from './parts';
import type { HrEvent, HrSummaryData, HrSummaryProps } from './types';

const ASSIGN_HREF = '/hr/penugasan?baru=1';

/** "2 rapat · 1 wawancara · 1 cuti". */
export function agendaBreakdown(agenda: HrEvent[]): string {
    const parts = EVENT_KIND_ORDER.map((kind) => {
        const count = agenda.filter((event) => event.kind === kind).length;

        return count > 0
            ? `${count} ${EVENT_KINDS[kind].label.toLowerCase()}`
            : null;
    }).filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : 'Tidak ada agenda';
}

/** KPI card that is one link (keyboard focusable). */
function KpiLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            prefetch
            className={cn(
                'block min-w-0 rounded-card transition-transform duration-120 ease-brand active:scale-[0.98] motion-reduce:active:scale-100',
                focusRing,
            )}
        >
            {children}
        </Link>
    );
}

function Kpis({
    summary,
    mobile,
}: {
    summary: HrSummaryData;
    mobile: boolean;
}) {
    const { kpis } = summary;
    const missingReports = Math.max(
        0,
        kpis.reports_scheduled - kpis.reports_submitted,
    );
    const compact = mobile ? 'px-4 py-3.5' : undefined;

    return (
        <section
            aria-label="Angka hari ini"
            className={cn(
                'grid gap-3 md:gap-4',
                mobile
                    ? 'grid-cols-2'
                    : 'grid-cols-[repeat(auto-fit,minmax(200px,1fr))]',
            )}
        >
            <KpiLink href="/hr/absensi">
                <KpiCard
                    tone="highlight"
                    className={cn('h-full', compact)}
                    label="Hadir hari ini"
                    value={formatNumber(kpis.present)}
                    suffix={`/ ${formatNumber(kpis.total_scheduled)}`}
                    note={
                        mobile
                            ? `${kpis.late} terlambat`
                            : `${kpis.late} terlambat · ${kpis.not_checked_in} belum check-in`
                    }
                />
            </KpiLink>
            <KpiLink href="/persetujuan">
                <KpiCard
                    className={cn('h-full', compact)}
                    label={
                        mobile ? 'Pengajuan menunggu' : 'Pengajuan menunggu HR'
                    }
                    value={formatNumber(kpis.pending_requests)}
                    valueClassName={
                        kpis.pending_requests > 0 ? 'text-warning' : undefined
                    }
                    note={
                        kpis.pending_requests_overdue > 0
                            ? `${kpis.pending_requests_overdue} lebih dari 24 jam`
                            : mobile
                              ? undefined
                              : 'Tidak ada yang lewat 24 jam'
                    }
                />
            </KpiLink>
            <KpiLink href="/hr/monitoring">
                <KpiCard
                    className={cn('h-full', compact)}
                    label={mobile ? 'Belum lapor' : 'Belum kirim laporan'}
                    value={formatNumber(missingReports)}
                    note={
                        mobile
                            ? undefined
                            : `dari ${kpis.reports_scheduled} terjadwal · tenggat 23.59`
                    }
                />
            </KpiLink>
            <KpiLink href="/hr/penugasan?status=overdue">
                <KpiCard
                    className={cn('h-full', compact)}
                    label="Penugasan terlambat"
                    value={formatNumber(kpis.assignments_overdue)}
                    valueClassName={
                        kpis.assignments_overdue > 0 ? 'text-danger' : undefined
                    }
                    note={
                        mobile
                            ? undefined
                            : `dari ${kpis.assignments_open} penugasan berjalan`
                    }
                />
            </KpiLink>
            {!mobile && (
                <KpiLink href="/hr/jadwal">
                    <KpiCard
                        className="h-full"
                        label="Agenda hari ini"
                        value={formatNumber(kpis.agenda_count)}
                        note={agendaBreakdown(summary.agenda)}
                    />
                </KpiLink>
            )}
        </section>
    );
}

function ActionsPanel({
    actions,
    mobile,
}: {
    actions: HrSummaryData['actions'];
    mobile: boolean;
}) {
    const now = new Date();
    const items = mobile ? actions.items.slice(0, 5) : actions.items;
    const rest = actions.total - items.length;

    return (
        <Panel
            title={
                <>
                    Perlu tindakan
                    {actions.total > 0 && (
                        <Badge
                            variant="count"
                            aria-label={`${actions.total} menunggu`}
                        >
                            {actions.total}
                        </Badge>
                    )}
                </>
            }
        >
            {items.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={CheckCheck}
                    title="Tidak ada yang menunggu"
                    description="Pengajuan, reset sandi, koreksi absensi, dan kandidat baru tampil di sini."
                />
            ) : (
                <>
                    <ul className="flex flex-col">
                        {items.map((item) => (
                            <ActionRow
                                key={`${item.kind}-${item.href}-${item.title}`}
                                item={item}
                                now={now}
                                compact={mobile}
                            />
                        ))}
                    </ul>
                    {rest > 0 && (
                        <p className="mt-2 text-meta text-text-muted">
                            {rest} lainnya menunggu ·{' '}
                            <Link
                                href="/persetujuan"
                                className={cn(
                                    'font-semibold text-link',
                                    focusRing,
                                )}
                            >
                                Buka Persetujuan
                            </Link>
                        </p>
                    )}
                </>
            )}
        </Panel>
    );
}

function AgendaPanel({ agenda }: { agenda: HrEvent[] }) {
    return (
        <Panel
            title="Agenda hari ini"
            action={<PanelLink href="/hr/jadwal">Kalender</PanelLink>}
        >
            {agenda.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={CalendarDays}
                    title="Tidak ada agenda hari ini"
                    description="Rapat, wawancara, cuti pegawai, dan hari libur tampil di sini."
                />
            ) : (
                <ol className="flex flex-col">
                    {agenda.map((event) => (
                        <AgendaRow key={event.id} event={event} />
                    ))}
                </ol>
            )}
        </Panel>
    );
}

function DivisionsPanel({
    divisions,
    live,
}: {
    divisions: HrSummaryData['divisions'];
    live: boolean;
}) {
    return (
        <Panel
            title="Kehadiran per divisi"
            action={
                <PanelLink href="/absensi/pegawai">Absen pegawai</PanelLink>
            }
        >
            <div className="mb-3">
                <LiveBadge live={live} />
            </div>
            {divisions.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={UsersRound}
                    title="Belum ada jadwal hari ini"
                />
            ) : (
                <DivisionAttendance divisions={divisions} />
            )}
        </Panel>
    );
}

function AssignmentsPanel({ rows }: { rows: HrSummaryData['assignments'] }) {
    return (
        <Panel
            title="Penugasan berjalan"
            action={<PanelLink href="/hr/penugasan">Semua penugasan</PanelLink>}
        >
            {rows.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={ListTodo}
                    title="Belum ada penugasan berjalan"
                    action={
                        <Button asChild variant="tonal" size="sm">
                            <Link href={ASSIGN_HREF}>Tugaskan pegawai</Link>
                        </Button>
                    }
                />
            ) : (
                <ul className="flex flex-col">
                    {rows.map((row) => (
                        <li
                            key={row.id}
                            className="border-t border-divider first:border-t-0"
                        >
                            <Link
                                href={row.url}
                                className={cn(
                                    'flex min-h-15 items-center gap-3 rounded-lg py-2',
                                    focusRing,
                                )}
                            >
                                <span className="w-16 shrink-0 font-mono text-[13px] font-semibold text-text-muted">
                                    {row.key}
                                </span>
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] leading-6 font-semibold">
                                        {row.title}
                                    </span>
                                    <span className="truncate text-meta text-text-muted">
                                        {assignmentMeta(row)}
                                    </span>
                                </span>
                                <AssignmentStatusBadge row={row} />
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

function ReportsPanel({ kpis }: { kpis: HrSummaryData['kpis'] }) {
    const notStarted = Math.max(
        0,
        kpis.reports_scheduled - kpis.reports_submitted - kpis.reports_draft,
    );
    const total = Math.max(kpis.reports_scheduled, kpis.reports_submitted);

    return (
        <Panel
            title="Laporan harian"
            action={<PanelLink href="/hr/monitoring">Monitoring</PanelLink>}
        >
            <p className="text-kpi tnum">
                {formatNumber(kpis.reports_submitted)}
                <span className="text-[18px] font-semibold text-text-muted">
                    {' '}
                    / {formatNumber(kpis.reports_scheduled)} sudah lapor
                </span>
            </p>
            <SplitBar
                className="mt-2.5 h-2.5"
                total={total}
                label={`${kpis.reports_submitted} terkirim, ${kpis.reports_draft} draf dari ${kpis.reports_scheduled} terjadwal`}
                parts={[
                    {
                        value: kpis.reports_submitted,
                        className: 'bg-fill-teal',
                    },
                    { value: kpis.reports_draft, className: 'bg-accent-blue' },
                ]}
            />
            <p className="mt-2 text-meta text-text-muted">
                {kpis.reports_draft} draf · {notStarted} belum mulai · pengingat
                otomatis 16.30
            </p>
        </Panel>
    );
}

function NotesPanel({ notes }: { notes: HrSummaryData['notes'] }) {
    return (
        <Panel
            title="Catatan tim HR"
            action={<PanelLink href="/hr/catatan">Semua catatan</PanelLink>}
        >
            {notes.length === 0 ? (
                <EmptyState
                    size="sm"
                    icon={FileText}
                    title="Belum ada catatan tim HR"
                    description="SOP, notulen wawancara, dan rapat tim tersimpan di Catatan."
                />
            ) : (
                <ul className="flex flex-col">
                    {notes.map((note) => (
                        <li
                            key={note.id}
                            className="border-t border-divider first:border-t-0"
                        >
                            <Link
                                href={`/catatan/${note.id}`}
                                className={cn(
                                    'flex min-h-15 items-center gap-3 rounded-lg py-2',
                                    focusRing,
                                )}
                            >
                                <FileText
                                    aria-hidden
                                    className="size-5 shrink-0 text-text-muted"
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-[16px] leading-6 font-semibold">
                                        {note.title}
                                    </span>
                                    <span className="truncate text-meta text-text-muted">
                                        {[
                                            note.updated_by,
                                            formatRelative(note.updated_at),
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </Panel>
    );
}

/** Ruang HR › Ringkasan (Main.dc.html desktop, MRuangHR phone). */
export function HrSummary({
    props,
    mobile,
    live,
}: {
    props: HrSummaryProps;
    mobile: boolean;
    live: boolean;
}) {
    const { hub, summary } = props;

    return (
        <HubShell
            hub={hub}
            title="Ruang HR"
            mobile={mobile}
            subtitle="Absensi, laporan, penugasan, jadwal, dan catatan tim HR dalam satu tempat."
            actions={
                <>
                    <Button asChild variant="outline">
                        <Link href="/pengumuman">
                            <Megaphone aria-hidden />
                            Pengumuman
                        </Link>
                    </Button>
                    <Button asChild>
                        <Link href={ASSIGN_HREF}>
                            <Plus aria-hidden />
                            Tugaskan pegawai
                        </Link>
                    </Button>
                </>
            }
        >
            <Kpis summary={summary} mobile={mobile} />
            {/* Kartu "Catat briefing" (keputusan pemilik 9 Okt 2026); on
                phones it follows Perlu tindakan & Agenda (MRuangHR). */}
            {!mobile && (
                <BriefingCard briefing={props.briefing} variant="desktop" />
            )}
            <div
                className={cn(
                    'grid gap-4 md:gap-5',
                    !mobile && 'grid-cols-[repeat(auto-fit,minmax(380px,1fr))]',
                )}
            >
                <ActionsPanel actions={summary.actions} mobile={mobile} />
                <AgendaPanel agenda={summary.agenda} />
                {mobile && (
                    <BriefingCard briefing={props.briefing} variant="mobile" />
                )}
                <DivisionsPanel divisions={summary.divisions} live={live} />
                <AssignmentsPanel rows={summary.assignments} />
                <ReportsPanel kpis={summary.kpis} />
                {hub.features.notes && <NotesPanel notes={summary.notes} />}
            </div>
            {mobile && (
                <Fab
                    label="Tugaskan pegawai"
                    onClick={() => router.visit(ASSIGN_HREF)}
                />
            )}
        </HubShell>
    );
}
