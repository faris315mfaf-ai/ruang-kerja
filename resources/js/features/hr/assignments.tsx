import { Link, router } from '@inertiajs/react';
import { KanbanSquare, ListTodo } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { Fab } from '@/components/mobile/fab';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { toIsoDay } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { AssignForm } from './assign-form';
import { HubShell } from './hub-shell';
import { assigneeText, assignmentProgress, dueLabel, statusChips } from './lib';
import type { StatusFilter } from './lib';
import { AssignmentStatusBadge, AvatarStack } from './parts';
import type { AssignmentRow, HrAssignmentsProps } from './types';

/** "1/4 butir" · "Selesai 8 Okt" · "—". */
export function progressText(row: AssignmentRow): string {
    if (row.status === 'done' && row.completed_at) {
        const day = toIsoDay(row.completed_at);

        return day ? `Selesai ${dueLabel(day)}` : 'Selesai';
    }

    return row.checklist.total > 0
        ? `${row.checklist.done}/${row.checklist.total} butir`
        : 'Tanpa checklist';
}

function opensForm(): boolean {
    return (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('baru') === '1'
    );
}

function DueCell({ row }: { row: AssignmentRow }) {
    if (!row.due_date) {
        return <span className="text-text-muted">—</span>;
    }

    return (
        <span
            className={cn(
                row.status === 'overdue' && 'font-semibold text-danger',
            )}
        >
            {dueLabel(row.due_date)}
        </span>
    );
}

function AssignmentsTable({ rows }: { rows: AssignmentRow[] }) {
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead scope="col">Tugas</TableHead>
                    <TableHead scope="col">Ditugaskan ke</TableHead>
                    <TableHead scope="col">Tenggat</TableHead>
                    <TableHead scope="col">Progres</TableHead>
                    <TableHead scope="col">Status</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((row) => (
                    <TableRow key={row.id}>
                        <TableCell className="max-w-80 min-w-56 whitespace-normal">
                            <span className="font-mono text-[13px] font-semibold text-text-muted">
                                {row.key}
                            </span>
                            <Link
                                href={row.url}
                                className={cn(
                                    'line-clamp-2 rounded-sm text-[16px] font-semibold hover:text-link',
                                    focusRing,
                                )}
                            >
                                {row.title}
                            </Link>
                        </TableCell>
                        <TableCell>
                            <span className="flex items-center gap-2">
                                <AvatarStack row={row} />
                                {row.assignee_count <= 2 && (
                                    <span className="max-w-40 truncate text-meta text-text-muted">
                                        {assigneeText(row)}
                                    </span>
                                )}
                            </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                            <DueCell row={row} />
                        </TableCell>
                        <TableCell className="min-w-32">
                            <span className="text-meta text-text-muted">
                                {progressText(row)}
                            </span>
                            <Progress
                                size="sm"
                                className="mt-1.5"
                                value={assignmentProgress(row)}
                                tone={
                                    row.status === 'done' ? 'success' : 'brand'
                                }
                                label={`Progres ${row.key}: ${progressText(row)}`}
                            />
                        </TableCell>
                        <TableCell>
                            <AssignmentStatusBadge row={row} />
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function AssignmentCards({ rows }: { rows: AssignmentRow[] }) {
    return (
        <ul className="flex flex-col divide-y divide-divider">
            {rows.map((row) => (
                <li key={row.id}>
                    <Link
                        href={row.url}
                        className={cn(
                            'flex flex-col gap-1 px-4 py-3.5',
                            focusRing,
                            'focus-visible:ring-inset',
                        )}
                    >
                        <span className="flex items-center justify-between gap-3">
                            <span className="font-mono text-[13px] font-semibold text-text-muted">
                                {row.key}
                            </span>
                            <AssignmentStatusBadge row={row} />
                        </span>
                        <span className="text-[17px] leading-6 font-semibold">
                            {row.title}
                        </span>
                        <span className="text-meta text-text-muted">
                            {[
                                assigneeText(row),
                                row.due_date
                                    ? `tenggat ${dueLabel(row.due_date)}`
                                    : null,
                                row.checklist.total > 0
                                    ? progressText(row)
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                        <Progress
                            size="sm"
                            className="mt-1.5"
                            value={assignmentProgress(row)}
                            tone={row.status === 'done' ? 'success' : 'brand'}
                            label={`Progres ${row.key}: ${progressText(row)}`}
                        />
                    </Link>
                </li>
            ))}
        </ul>
    );
}

/** Ruang HR › Penugasan (Penugasan.dc.html, MPenugasan). */
export function HrAssignments({
    props,
    mobile,
}: {
    props: HrAssignmentsProps;
    mobile: boolean;
}) {
    const { hub, assignments } = props;
    const [sheet, setSheet] = useState(() => mobile && opensForm());
    const [loading, setLoading] = useState(false);
    const status: StatusFilter = assignments.status ?? 'all';
    const workspace = assignments.workspace;

    const filter = (value: StatusFilter) =>
        router.get(
            window.location.pathname,
            value === 'all' ? {} : { status: value },
            {
                only: ['assignments'],
                preserveState: true,
                preserveScroll: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );

    const chips = statusChips(assignments.counts);
    const rows = assignments.rows;
    const form = (
        <AssignForm
            pickers={props.pickers}
            limits={props.limits}
            today={hub.today}
            autoFocus={!mobile && opensForm()}
            hideActions={mobile}
            onDone={() => setSheet(false)}
            onCancel={() => setSheet(false)}
        />
    );

    const list =
        workspace === null ? (
            <EmptyState
                icon={ListTodo}
                title="Workspace Penugasan HR belum siap"
                description="Workspace dibuat otomatis begitu ada akun HR atau Super Admin yang aktif."
            />
        ) : rows.length === 0 ? (
            <EmptyState
                size={mobile ? 'md' : 'sm'}
                icon={ListTodo}
                title={
                    status === 'all'
                        ? 'Belum ada penugasan'
                        : 'Tidak ada penugasan dengan status ini'
                }
                description="Tugas dari HR untuk pegawai tampil di sini beserta progresnya."
            />
        ) : mobile ? (
            <AssignmentCards rows={rows} />
        ) : (
            <AssignmentsTable rows={rows} />
        );

    return (
        <HubShell hub={hub} title="Penugasan · Ruang HR" mobile={mobile}>
            <div className="flex flex-wrap items-center justify-between gap-3">
                <ChipScroller
                    label="Status penugasan"
                    chips={chips}
                    value={status}
                    onChange={filter}
                    className={cn(!mobile && 'mx-0 px-0')}
                />
                {workspace && !mobile && (
                    <Button asChild variant="outline">
                        <Link href={`/w/${workspace.key}`}>
                            <KanbanSquare aria-hidden />
                            Buka board
                        </Link>
                    </Button>
                )}
            </div>

            {mobile ? (
                <>
                    <section
                        aria-label="Daftar penugasan"
                        className={cn(
                            'overflow-hidden rounded-panel border border-border bg-surface shadow-card transition-opacity duration-120 ease-brand',
                            loading && 'opacity-60',
                            rows.length === 0 &&
                                'border-0 bg-transparent shadow-none',
                        )}
                    >
                        {list}
                    </section>
                    {workspace && (
                        <Link
                            href={`/w/${workspace.key}`}
                            className={cn(
                                'self-center rounded-sm text-[16px] font-semibold text-link',
                                focusRing,
                            )}
                        >
                            Buka board Penugasan HR
                        </Link>
                    )}
                    <Fab
                        label="Tugaskan pegawai"
                        onClick={() => setSheet(true)}
                    />
                    <BottomSheet
                        open={sheet}
                        onOpenChange={setSheet}
                        title="Tugaskan pegawai"
                        description='Tugas masuk ke workspace "Penugasan HR" dan tampil di Tugas saya penerima.'
                    >
                        <div className="pb-6">{form}</div>
                    </BottomSheet>
                </>
            ) : (
                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
                    <section
                        aria-label="Daftar penugasan"
                        className={cn(
                            'min-w-0 overflow-hidden rounded-panel border border-border bg-surface py-2 shadow-card transition-opacity duration-120 ease-brand',
                            loading && 'opacity-60',
                            rows.length === 0 && 'p-6',
                        )}
                    >
                        {list}
                    </section>
                    <aside
                        aria-labelledby="hr-assign-title"
                        className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-card"
                    >
                        <div className="flex flex-col gap-1">
                            <h2
                                id="hr-assign-title"
                                className="text-[20px] leading-7 font-bold md:text-[22px]"
                            >
                                Tugaskan pegawai
                            </h2>
                            <p className="text-meta text-text-muted">
                                Tugas masuk ke workspace "Penugasan HR".
                                Penerima otomatis menjadi anggota dan melihatnya
                                di Tugas saya.
                            </p>
                        </div>
                        {form}
                    </aside>
                </div>
            )}
        </HubShell>
    );
}
