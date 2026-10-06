import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DivisionRow, PersonRef, PositionRow, TeamRow } from './types';

type RowActions<T> = {
    onEdit: (row: T) => void;
    onDelete: (row: T) => void;
    onRestore: (row: T) => void;
};

const HEAD = 'first:pl-6 last:pr-6';
const CELL = 'py-3.5 first:pl-6 last:pr-6';

function Person({
    person,
    empty,
}: {
    person: PersonRef | null;
    empty: string;
}) {
    if (!person) {
        return <span className="text-text-subtle">{empty}</span>;
    }

    return (
        <span className="flex items-center gap-2">
            <UserAvatar name={person.name} src={person.avatar} />
            <span className="truncate text-text">{person.name}</span>
        </span>
    );
}

function Code({ code }: { code: string | null }) {
    return code ? (
        <Badge variant="label" className="font-mono">
            {code}
        </Badge>
    ) : (
        <span className="text-text-subtle">–</span>
    );
}

function Status({ deletedAt }: { deletedAt: string | null }) {
    return deletedAt ? (
        <Badge variant="status" tone="neutral" dot>
            Dihapus
        </Badge>
    ) : (
        <Badge variant="status" tone="success" dot>
            Aktif
        </Badge>
    );
}

function Actions<T extends { deletedAt: string | null }>({
    row,
    label,
    onEdit,
    onDelete,
    onRestore,
}: RowActions<T> & { row: T; label: string }) {
    if (row.deletedAt) {
        return (
            <Button
                type="button"
                variant="tonal"
                size="sm"
                onClick={(event) => {
                    event.stopPropagation();
                    onRestore(row);
                }}
            >
                <RotateCcw />
                Pulihkan
            </Button>
        );
    }

    return (
        <span className="flex justify-end gap-1">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Ubah ${label}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onEdit(row);
                }}
            >
                <Pencil />
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-text-muted hover:text-danger"
                aria-label={`Hapus ${label}`}
                onClick={(event) => {
                    event.stopPropagation();
                    onDelete(row);
                }}
            >
                <Trash2 />
            </Button>
        </span>
    );
}

function Shell({ head, children }: { head: ReactNode; children: ReactNode }) {
    return (
        <Table>
            <TableHeader>
                <TableRow className="hover:bg-transparent">{head}</TableRow>
            </TableHeader>
            <TableBody>{children}</TableBody>
        </Table>
    );
}

function rowClass(deleted: boolean) {
    return cn(deleted ? 'text-text-muted' : 'cursor-pointer');
}

export function DivisionTable({
    rows,
    ...actions
}: RowActions<DivisionRow> & { rows: DivisionRow[] }) {
    return (
        <Shell
            head={
                <>
                    <TableHead className={HEAD}>Nama</TableHead>
                    <TableHead className={HEAD}>Kode</TableHead>
                    <TableHead className={HEAD}>Kepala divisi</TableHead>
                    <TableHead className={cn(HEAD, 'text-right')}>
                        Karyawan aktif
                    </TableHead>
                    <TableHead className={cn(HEAD, 'text-right')}>
                        Tim
                    </TableHead>
                    <TableHead className={HEAD}>Status</TableHead>
                    <TableHead className={HEAD}>
                        <span className="sr-only">Aksi</span>
                    </TableHead>
                </>
            }
        >
            {rows.map((row) => (
                <TableRow
                    key={row.id}
                    className={rowClass(row.deletedAt !== null)}
                    onClick={() => !row.deletedAt && actions.onEdit(row)}
                >
                    <TableCell className={CELL}>
                        <span className="flex items-center gap-2">
                            <span className="font-semibold text-text">
                                {row.name}
                            </span>
                            {row.isBoard && (
                                <Badge
                                    variant="status"
                                    tone="link"
                                    className="h-6 px-2.5 text-[13px]"
                                >
                                    Direksi
                                </Badge>
                            )}
                        </span>
                        {row.parentName && (
                            <span className="block text-meta text-text-muted">
                                Sub-divisi dari {row.parentName}
                            </span>
                        )}
                    </TableCell>
                    <TableCell className={CELL}>
                        <Code code={row.code} />
                    </TableCell>
                    <TableCell className={CELL}>
                        <Person person={row.head} empty="Belum ditentukan" />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tnum')}>
                        {formatNumber(row.membersCount)}
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tnum')}>
                        {formatNumber(row.teamsCount)}
                    </TableCell>
                    <TableCell className={CELL}>
                        <Status deletedAt={row.deletedAt} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'w-px text-right')}>
                        <Actions
                            row={row}
                            label={`divisi ${row.name}`}
                            {...actions}
                        />
                    </TableCell>
                </TableRow>
            ))}
        </Shell>
    );
}

export function TeamTable({
    rows,
    ...actions
}: RowActions<TeamRow> & { rows: TeamRow[] }) {
    return (
        <Shell
            head={
                <>
                    <TableHead className={HEAD}>Nama</TableHead>
                    <TableHead className={HEAD}>Kode</TableHead>
                    <TableHead className={HEAD}>Divisi</TableHead>
                    <TableHead className={HEAD}>Ketua tim</TableHead>
                    <TableHead className={cn(HEAD, 'text-right')}>
                        Anggota aktif
                    </TableHead>
                    <TableHead className={HEAD}>Status</TableHead>
                    <TableHead className={HEAD}>
                        <span className="sr-only">Aksi</span>
                    </TableHead>
                </>
            }
        >
            {rows.map((row) => (
                <TableRow
                    key={row.id}
                    className={rowClass(row.deletedAt !== null)}
                    onClick={() => !row.deletedAt && actions.onEdit(row)}
                >
                    <TableCell className={cn(CELL, 'font-semibold text-text')}>
                        {row.name}
                    </TableCell>
                    <TableCell className={CELL}>
                        <Code code={row.code} />
                    </TableCell>
                    <TableCell className={CELL}>
                        {row.divisionName}
                        <span className="ml-1.5 font-mono text-meta text-text-muted">
                            {row.divisionCode}
                        </span>
                    </TableCell>
                    <TableCell className={CELL}>
                        <Person person={row.lead} empty="Belum ditentukan" />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tnum')}>
                        {formatNumber(row.membersCount)}
                    </TableCell>
                    <TableCell className={CELL}>
                        <Status deletedAt={row.deletedAt} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'w-px text-right')}>
                        <Actions row={row} label={row.name} {...actions} />
                    </TableCell>
                </TableRow>
            ))}
        </Shell>
    );
}

export function PositionTable({
    rows,
    ...actions
}: RowActions<PositionRow> & { rows: PositionRow[] }) {
    return (
        <Shell
            head={
                <>
                    <TableHead className={HEAD}>Nama jabatan</TableHead>
                    <TableHead className={HEAD}>Level</TableHead>
                    <TableHead className={cn(HEAD, 'text-right')}>
                        Dipakai karyawan aktif
                    </TableHead>
                    <TableHead className={HEAD}>Status</TableHead>
                    <TableHead className={HEAD}>
                        <span className="sr-only">Aksi</span>
                    </TableHead>
                </>
            }
        >
            {rows.map((row) => (
                <TableRow
                    key={row.id}
                    className={rowClass(row.deletedAt !== null)}
                    onClick={() => !row.deletedAt && actions.onEdit(row)}
                >
                    <TableCell className={cn(CELL, 'font-semibold text-text')}>
                        {row.name}
                        {row.dashboardRoleLabel && (
                            <span className="block text-meta font-normal text-text-muted">
                                Dashboard {row.dashboardRoleLabel}
                            </span>
                        )}
                    </TableCell>
                    <TableCell className={CELL}>
                        <span className="tnum">{row.level}</span>
                        <span className="ml-1.5 text-text-muted">
                            {row.levelLabel}
                        </span>
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tnum')}>
                        {formatNumber(row.usersCount)}
                    </TableCell>
                    <TableCell className={CELL}>
                        <Status deletedAt={row.deletedAt} />
                    </TableCell>
                    <TableCell className={cn(CELL, 'w-px text-right')}>
                        <Actions
                            row={row}
                            label={`jabatan ${row.name}`}
                            {...actions}
                        />
                    </TableCell>
                </TableRow>
            ))}
        </Shell>
    );
}
