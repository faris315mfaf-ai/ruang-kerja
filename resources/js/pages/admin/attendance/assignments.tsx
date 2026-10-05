import { Head, Link, router } from '@inertiajs/react';
import { CalendarPlus, Search, Settings2, Users, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { OverrideDialog } from '@/features/attendance/admin/override-dialog';
import { PatternDialog } from '@/features/attendance/admin/pattern-dialog';
import type {
    AssignmentEmployee,
    ShiftAssignmentsProps,
} from '@/features/attendance/admin/types';
import { workDateLabel } from '@/features/attendance/admin/types';
import { AdminPageHeader } from '@/features/admin/page-header';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn, focusRing } from '@/lib/utils';
import { index as settingsIndex } from '@/routes/admin/attendance';
import { destroy } from '@/routes/admin/attendance/assignments';

const ALL = 'all';

function officeToday(): string {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jakarta',
    }).format(new Date());
}

function RemoveButton({ id, label }: { id: string; label: string }) {
    return (
        <button
            type="button"
            aria-label={`Hapus ${label}`}
            onClick={() =>
                window.confirm(`Hapus ${label}?`) &&
                router.delete(destroy.url(id), { preserveScroll: true })
            }
            className={cn(
                'ml-1 inline-flex size-7 items-center justify-center rounded-sm text-text-subtle transition-colors duration-120 ease-brand hover:bg-danger-soft hover:text-danger',
                focusRing,
            )}
        >
            <X className="size-4" aria-hidden />
        </button>
    );
}

/** Admin › Penugasan shift: weekly patterns (bulk) and date overrides. Desktop only. */
export default function ShiftAssignments({
    employees,
    divisions,
    shifts,
    workModes,
}: ShiftAssignmentsProps) {
    const breakpoint = useBreakpoint();
    const [query, setQuery] = useState('');
    const [division, setDivision] = useState(ALL);
    const [selected, setSelected] = useState<string[]>([]);
    const [patternOpen, setPatternOpen] = useState(false);
    const [patternKey, setPatternKey] = useState(0);
    const [overrideFor, setOverrideFor] = useState<AssignmentEmployee | null>(
        null,
    );
    const today = officeToday();

    const visible = useMemo(
        () =>
            employees.filter(
                (employee) =>
                    (division === ALL || employee.divisionId === division) &&
                    employee.name
                        .toLowerCase()
                        .includes(query.trim().toLowerCase()),
            ),
        [employees, division, query],
    );

    if (breakpoint === null) {
        return <Skeleton className="h-96 rounded-panel" />;
    }

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Penugasan shift" />
                <DesktopOnlyNotice feature="Penugasan shift" />
            </>
        );
    }

    const allSelected =
        visible.length > 0 &&
        visible.every((employee) => selected.includes(employee.id));
    const toggleAll = () =>
        setSelected(
            allSelected
                ? selected.filter((id) => !visible.some((e) => e.id === id))
                : [...new Set([...selected, ...visible.map((e) => e.id)])],
        );
    const toggle = (id: string) =>
        setSelected(
            selected.includes(id)
                ? selected.filter((value) => value !== id)
                : [...selected, id],
        );

    return (
        <>
            <Head title="Penugasan shift" />
            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    overline="Admin · Absensi"
                    title="Penugasan shift"
                    description="Pola mingguan per karyawan atau per divisi, plus jadwal khusus per tanggal."
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <Link href={settingsIndex()} prefetch>
                                    <Settings2 aria-hidden />
                                    Kelola shift
                                </Link>
                            </Button>
                            <Button
                                disabled={shifts.length === 0}
                                onClick={() => {
                                    setPatternKey((key) => key + 1);
                                    setPatternOpen(true);
                                }}
                            >
                                <Users aria-hidden />
                                Atur pola{' '}
                                {selected.length > 0
                                    ? `(${selected.length})`
                                    : 'per divisi'}
                            </Button>
                        </>
                    }
                />

                <div className="overflow-hidden rounded-panel border border-border bg-surface shadow-card">
                    <div className="flex flex-wrap items-center gap-3 border-b border-divider px-6 py-5 md:px-7">
                        <div role="search" className="relative w-72">
                            <Search
                                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-muted"
                                aria-hidden
                            />
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Cari karyawan"
                                aria-label="Cari karyawan"
                                className="pl-11"
                            />
                        </div>
                        <Select value={division} onValueChange={setDivision}>
                            <SelectTrigger
                                className="w-60"
                                aria-label="Filter divisi"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ALL}>
                                    Semua divisi
                                </SelectItem>
                                {divisions.map((item) => (
                                    <SelectItem key={item.id} value={item.id}>
                                        {item.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="ml-auto text-meta text-text-muted tnum">
                            {visible.length} karyawan aktif
                        </span>
                    </div>
                    {visible.length === 0 ? (
                        <div className="p-6">
                            <EmptyState
                                icon={Users}
                                title="Tidak ada karyawan"
                                description="Ubah pencarian atau filter divisi."
                            />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-10 pl-6">
                                        <Checkbox
                                            checked={allSelected}
                                            onCheckedChange={toggleAll}
                                            aria-label="Pilih semua"
                                        />
                                    </TableHead>
                                    <TableHead>Karyawan</TableHead>
                                    <TableHead>Mode</TableHead>
                                    <TableHead>Pola mingguan</TableHead>
                                    <TableHead>Jadwal khusus</TableHead>
                                    <TableHead className="w-12 pr-6">
                                        <span className="sr-only">Aksi</span>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {visible.map((employee) => (
                                    <TableRow
                                        key={employee.id}
                                        data-state={
                                            selected.includes(employee.id)
                                                ? 'selected'
                                                : undefined
                                        }
                                    >
                                        <TableCell className="pl-6 align-top">
                                            <Checkbox
                                                checked={selected.includes(
                                                    employee.id,
                                                )}
                                                onCheckedChange={() =>
                                                    toggle(employee.id)
                                                }
                                                aria-label={`Pilih ${employee.name}`}
                                            />
                                        </TableCell>
                                        <TableCell className="align-top">
                                            <p className="text-[16px] font-semibold text-text">
                                                {employee.name}
                                            </p>
                                            <p className="text-meta text-text-muted">
                                                {employee.divisionName ??
                                                    'Tanpa divisi'}
                                            </p>
                                        </TableCell>
                                        <TableCell className="align-top text-text">
                                            {employee.workModeLabel}
                                        </TableCell>
                                        <TableCell className="align-top whitespace-normal">
                                            {employee.patterns.length === 0 ? (
                                                <Badge
                                                    variant="status"
                                                    tone="warning"
                                                    dot
                                                >
                                                    Belum terjadwal
                                                </Badge>
                                            ) : (
                                                <ul className="space-y-1">
                                                    {employee.patterns.map(
                                                        (pattern) => (
                                                            <li
                                                                key={pattern.id}
                                                                className="flex items-center text-[15px] text-text"
                                                            >
                                                                <span>
                                                                    {
                                                                        pattern.shiftName
                                                                    }{' '}
                                                                    <span className="font-mono text-[14px] font-medium text-text-muted">
                                                                        {
                                                                            pattern.hours
                                                                        }
                                                                    </span>{' '}
                                                                    ·{' '}
                                                                    {
                                                                        pattern.daysLabel
                                                                    }
                                                                    {pattern.workModeLabel && (
                                                                        <span className="ml-1 inline-flex h-6 items-center rounded-sm bg-info-soft px-2 text-[13px] font-semibold text-info">
                                                                            {
                                                                                pattern.workModeLabel
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    <span className="ml-1 text-meta text-text-muted">
                                                                        {pattern.validFrom >
                                                                        today
                                                                            ? `mulai ${workDateLabel(pattern.validFrom)}`
                                                                            : ''}
                                                                        {pattern.validUntil
                                                                            ? ` s.d. ${workDateLabel(pattern.validUntil)}`
                                                                            : ''}
                                                                    </span>
                                                                </span>
                                                                <RemoveButton
                                                                    id={
                                                                        pattern.id
                                                                    }
                                                                    label={`pola ${pattern.shiftName ?? ''} ${pattern.daysLabel}`}
                                                                />
                                                            </li>
                                                        ),
                                                    )}
                                                </ul>
                                            )}
                                        </TableCell>
                                        <TableCell className="align-top whitespace-normal">
                                            <ul className="space-y-1">
                                                {employee.overrides
                                                    .slice(0, 4)
                                                    .map((item) => (
                                                        <li
                                                            key={item.id}
                                                            className="flex items-center text-[15px] text-text"
                                                        >
                                                            <span>
                                                                {workDateLabel(
                                                                    item.date,
                                                                )}
                                                                :{' '}
                                                                {item.shiftName ??
                                                                    'Libur'}
                                                                {item.workModeLabel &&
                                                                    ` · ${item.workModeLabel}`}
                                                            </span>
                                                            <RemoveButton
                                                                id={item.id}
                                                                label={`jadwal khusus ${workDateLabel(item.date)}`}
                                                            />
                                                        </li>
                                                    ))}
                                                {employee.overrides.length >
                                                    4 && (
                                                    <li className="text-meta text-text-muted">
                                                        +
                                                        {employee.overrides
                                                            .length - 4}{' '}
                                                        lainnya
                                                    </li>
                                                )}
                                                {employee.overrides.length ===
                                                    0 && (
                                                    <li className="text-meta text-text-subtle">
                                                        –
                                                    </li>
                                                )}
                                            </ul>
                                        </TableCell>
                                        <TableCell className="pr-6 align-top">
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={`Jadwal khusus ${employee.name}`}
                                                onClick={() =>
                                                    setOverrideFor(employee)
                                                }
                                            >
                                                <CalendarPlus aria-hidden />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </div>
            <PatternDialog
                key={patternKey}
                open={patternOpen}
                onClose={() => setPatternOpen(false)}
                selectedIds={selected}
                divisions={divisions}
                shifts={shifts}
                workModes={workModes}
                today={today}
                onApplied={() => setSelected([])}
            />
            <OverrideDialog
                key={overrideFor?.id ?? 'none'}
                employee={overrideFor}
                shifts={shifts}
                workModes={workModes}
                today={today}
                onClose={() => setOverrideFor(null)}
            />
        </>
    );
}

ShiftAssignments.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Lokasi, shift & hari libur', href: '/admin/absensi' },
        { title: 'Penugasan shift', href: '/admin/absensi/penugasan' },
    ],
    title: 'Penugasan shift',
    back: '/admin/absensi',
};
