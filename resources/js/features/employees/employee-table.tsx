import { Link } from '@inertiajs/react';
import {
    createColumnHelper,
    tableFeatures,
    useTable,
} from '@tanstack/react-table';
import {
    ArrowDown,
    ArrowUp,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    MoreHorizontal,
    Search,
    UserRoundSearch,
} from 'lucide-react';
import { useMemo } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { show } from '@/routes/admin/employees';
import { RoleBadges, StatusBadge, WorkModeBadge } from './employee-badges';
import { NativeSelect } from './native-select';
import type { EmployeeIndexProps, EmployeeRow } from './types';
import { useEmployeeFilters } from './use-employee-filters';

const features = tableFeatures({});
const column = createColumnHelper<typeof features, EmployeeRow>();

type Props = Pick<
    EmployeeIndexProps,
    'employees' | 'filters' | 'divisions' | 'options' | 'can'
> & {
    selectedId: string | null;
    onEdit: (employee: EmployeeRow) => void;
    onDeactivate: (employee: EmployeeRow) => void;
    onReactivate: (employee: EmployeeRow) => void;
};

function SortHeader({
    label,
    column: key,
    sort,
    direction,
    onSort,
}: {
    label: string;
    column: string;
    sort: string;
    direction: 'asc' | 'desc';
    onSort: (column: string) => void;
}) {
    const active = sort === key;
    const Icon = !active
        ? ArrowUpDown
        : direction === 'asc'
          ? ArrowUp
          : ArrowDown;

    return (
        <button
            type="button"
            onClick={() => onSort(key)}
            className="-mx-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:text-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-label={`Urutkan menurut ${label.toLowerCase()}`}
        >
            {label}
            <Icon
                aria-hidden
                className={cn('size-3.5', !active && 'opacity-40')}
            />
        </button>
    );
}

/**
 * Desktop employee table (mockup `Karyawan`): server-side search, filters,
 * sort and pagination; TanStack Table renders the columns.
 */
export function EmployeeTable({
    employees,
    filters,
    divisions,
    options,
    can,
    selectedId,
    onEdit,
    onDeactivate,
    onReactivate,
}: Props) {
    const { search, changeSearch, apply, toggleSort, loading } =
        useEmployeeFilters(filters);
    const { meta } = employees;
    const filtered = Boolean(
        filters.search || filters.division || filters.role || filters.status,
    );

    const columns = useMemo(() => {
        const sortable = (label: string, key: string) => () => (
            <SortHeader
                label={label}
                column={key}
                sort={filters.sort}
                direction={filters.direction}
                onSort={toggleSort}
            />
        );

        return column.columns([
            column.accessor('name', {
                header: sortable('Nama', 'name'),
                cell: ({ row }) => (
                    <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                            name={row.original.name}
                            src={row.original.avatar_url}
                        />
                        <div className="min-w-0">
                            <Link
                                href={show(row.original.id)}
                                className="block truncate font-medium text-text hover:underline"
                                onClick={(event) => event.stopPropagation()}
                            >
                                {row.original.name}
                            </Link>
                            <div className="truncate text-xs text-text-muted">
                                {row.original.email}
                            </div>
                        </div>
                    </div>
                ),
            }),
            column.accessor((row) => row.division?.name ?? null, {
                id: 'division',
                header: sortable('Divisi', 'division'),
                cell: ({ row }) =>
                    row.original.division ? (
                        <div>
                            <div>{row.original.division.name}</div>
                            {row.original.team && (
                                <div className="text-xs text-text-muted">
                                    {row.original.team.name}
                                </div>
                            )}
                        </div>
                    ) : (
                        <span className="text-text-subtle">—</span>
                    ),
            }),
            column.accessor((row) => row.position?.name ?? null, {
                id: 'position',
                header: sortable('Jabatan', 'position'),
                cell: ({ getValue }) =>
                    getValue() ?? <span className="text-text-subtle">—</span>,
            }),
            column.accessor((row) => row.manager?.name ?? null, {
                id: 'manager',
                header: sortable('Atasan langsung', 'manager'),
                cell: ({ getValue }) =>
                    getValue() ?? <span className="text-text-subtle">—</span>,
            }),
            column.accessor('work_mode', {
                header: sortable('Mode kerja', 'work_mode'),
                cell: ({ getValue }) => <WorkModeBadge mode={getValue()} />,
            }),
            column.accessor('roles', {
                header: () => 'Peran',
                cell: ({ getValue }) => <RoleBadges roles={getValue()} />,
            }),
            column.accessor('status', {
                header: sortable('Status', 'status'),
                cell: ({ getValue }) => <StatusBadge status={getValue()} />,
            }),
            column.display({
                id: 'actions',
                header: () => <span className="sr-only">Aksi</span>,
                cell: ({ row }) => (
                    <RowActions
                        employee={row.original}
                        onEdit={onEdit}
                        onDeactivate={onDeactivate}
                        onReactivate={onReactivate}
                    />
                ),
            }),
        ]);
    }, [
        filters.sort,
        filters.direction,
        toggleSort,
        onEdit,
        onDeactivate,
        onReactivate,
    ]);

    const table = useTable({
        features,
        columns,
        data: employees.data,
        getRowId: (row) => row.id,
    });

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full max-w-72">
                    <Search
                        aria-hidden
                        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
                    />
                    <Input
                        type="search"
                        value={search}
                        onChange={(event) => changeSearch(event.target.value)}
                        placeholder="Cari nama, email, atau jabatan"
                        aria-label="Cari karyawan"
                        className="pl-9"
                    />
                </div>
                <NativeSelect
                    aria-label="Filter divisi"
                    value={filters.division ?? ''}
                    onChange={(event) =>
                        apply({ division: event.target.value || null })
                    }
                    className="w-40"
                >
                    <option value="">Semua divisi</option>
                    {divisions.map((division) => (
                        <option key={division.id} value={division.id}>
                            {division.name}
                        </option>
                    ))}
                    {can.manage && <option value="none">Tanpa divisi</option>}
                </NativeSelect>
                <NativeSelect
                    aria-label="Filter peran"
                    value={filters.role ?? ''}
                    onChange={(event) =>
                        apply({
                            role:
                                (event.target.value as typeof filters.role) ||
                                null,
                        })
                    }
                    className="w-40"
                >
                    <option value="">Semua peran</option>
                    {options.roles.map((role) => (
                        <option key={role.value} value={role.value}>
                            {role.label}
                        </option>
                    ))}
                </NativeSelect>
                <NativeSelect
                    aria-label="Filter status"
                    value={filters.status ?? ''}
                    onChange={(event) =>
                        apply({
                            status:
                                (event.target.value as typeof filters.status) ||
                                null,
                        })
                    }
                    className="w-44"
                >
                    <option value="">Status: Semua</option>
                    {options.statuses.map((status) => (
                        <option key={status.value} value={status.value}>
                            Status: {status.label}
                        </option>
                    ))}
                </NativeSelect>
                <p className="ml-auto text-[13px] text-text-muted tnum">
                    {meta.total === 0
                        ? '0 karyawan'
                        : `${meta.from}–${meta.to} dari ${formatNumber(meta.total)}`}
                </p>
            </div>

            {employees.data.length === 0 ? (
                <EmptyState
                    icon={UserRoundSearch}
                    title={
                        filtered
                            ? 'Tidak ada karyawan yang cocok'
                            : 'Belum ada karyawan'
                    }
                    description={
                        filtered
                            ? 'Ubah kata kunci atau filter untuk melihat karyawan lain.'
                            : 'Tambahkan karyawan satu per satu atau impor dari CSV/XLSX.'
                    }
                    action={
                        filtered ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    changeSearch('');
                                    apply({
                                        search: null,
                                        division: null,
                                        role: null,
                                        status: null,
                                    });
                                }}
                            >
                                Hapus filter
                            </Button>
                        ) : undefined
                    }
                />
            ) : (
                <div
                    className={cn(
                        'overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-opacity',
                        loading && 'opacity-60',
                    )}
                    aria-busy={loading}
                >
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[960px] text-[13px]">
                            <thead className="bg-surface-2 text-left text-xs font-medium text-text-muted">
                                {table.getHeaderGroups().map((group) => (
                                    <tr key={group.id}>
                                        {group.headers.map((header) => (
                                            <th
                                                key={header.id}
                                                scope="col"
                                                className="h-10 px-4 font-medium whitespace-nowrap"
                                            >
                                                <table.FlexRender
                                                    header={header}
                                                />
                                            </th>
                                        ))}
                                    </tr>
                                ))}
                            </thead>
                            <tbody>
                                {table.getRowModel().rows.map((row) => {
                                    const employee = row.original;

                                    return (
                                        <tr
                                            key={row.id}
                                            onClick={() =>
                                                employee.can.update &&
                                                onEdit(employee)
                                            }
                                            className={cn(
                                                'border-t border-border transition-colors',
                                                employee.can.update &&
                                                    'cursor-pointer hover:bg-surface-2/60',
                                                employee.status !== 'active' &&
                                                    'text-text-muted',
                                                selectedId === employee.id &&
                                                    'bg-primary/5 shadow-[inset_3px_0_0_var(--primary)]',
                                            )}
                                        >
                                            {row.getAllCells().map((cell) => (
                                                <td
                                                    key={cell.id}
                                                    className="h-[52px] px-4 align-middle"
                                                >
                                                    <table.FlexRender
                                                        cell={cell}
                                                    />
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-2.5 text-xs text-text-muted">
                        <p>
                            Akun nonaktif tidak bisa masuk; riwayat absensi dan
                            tugasnya tetap tersimpan.
                        </p>
                        <div className="flex items-center gap-2">
                            <NativeSelect
                                aria-label="Baris per halaman"
                                value={String(meta.per_page)}
                                onChange={(event) =>
                                    apply({
                                        per_page: Number(event.target.value),
                                    })
                                }
                                className="w-24"
                            >
                                {[10, 25, 50].map((size) => (
                                    <option key={size} value={size}>
                                        {size} / hlm
                                    </option>
                                ))}
                            </NativeSelect>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={meta.current_page <= 1 || loading}
                                onClick={() =>
                                    apply({ page: meta.current_page - 1 })
                                }
                                aria-label="Halaman sebelumnya"
                            >
                                <ChevronLeft />
                            </Button>
                            <span className="tnum">
                                {meta.current_page} / {meta.last_page}
                            </span>
                            <Button
                                variant="outline"
                                size="icon"
                                className="size-8"
                                disabled={
                                    meta.current_page >= meta.last_page ||
                                    loading
                                }
                                onClick={() =>
                                    apply({ page: meta.current_page + 1 })
                                }
                                aria-label="Halaman berikutnya"
                            >
                                <ChevronRight />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function RowActions({
    employee,
    onEdit,
    onDeactivate,
    onReactivate,
}: {
    employee: EmployeeRow;
    onEdit: (employee: EmployeeRow) => void;
    onDeactivate: (employee: EmployeeRow) => void;
    onReactivate: (employee: EmployeeRow) => void;
}) {
    return (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={`Aksi untuk ${employee.name}`}
                    >
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem asChild>
                        <Link href={show(employee.id)}>Lihat profil</Link>
                    </DropdownMenuItem>
                    {employee.can.update && (
                        <DropdownMenuItem onSelect={() => onEdit(employee)}>
                            Ubah data
                        </DropdownMenuItem>
                    )}
                    {employee.can.deactivate && (
                        <>
                            <DropdownMenuSeparator />
                            {employee.status === 'active' ? (
                                <DropdownMenuItem
                                    className="text-danger focus:text-danger"
                                    onSelect={() => onDeactivate(employee)}
                                >
                                    Nonaktifkan
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem
                                    onSelect={() => onReactivate(employee)}
                                >
                                    Aktifkan kembali
                                </DropdownMenuItem>
                            )}
                        </>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
