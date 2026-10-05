import { Pencil, RotateCcw, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
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

const HEAD = 'h-10 px-4 text-xs font-medium text-text-muted';
const CELL = 'px-4 py-3';

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
            <UserAvatar
                name={person.name}
                src={person.avatar}
                className="size-6 text-[10px]"
            />
            <span className="truncate text-text">{person.name}</span>
        </span>
    );
}

function Code({ code }: { code: string | null }) {
    return code ? (
        <span className="rounded border border-border px-1.5 py-0.5 font-mono text-xs text-text-muted">
            {code}
        </span>
    ) : (
        <span className="text-text-subtle">–</span>
    );
}

function Status({ deletedAt }: { deletedAt: string | null }) {
    return deletedAt ? (
        <span className="inline-flex items-center gap-1.5 text-text-muted">
            <span
                aria-hidden
                className="size-1.5 rounded-full bg-text-subtle"
            />
            Dihapus
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 text-success">
            <span aria-hidden className="size-1.5 rounded-full bg-success" />
            Aktif
        </span>
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
                variant="ghost"
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
                size="icon"
                className="size-8"
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
                size="icon"
                className="size-8 text-text-muted hover:text-danger"
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
            <TableHeader className="bg-surface-2">
                <TableRow className="hover:bg-transparent">{head}</TableRow>
            </TableHeader>
            <TableBody>{children}</TableBody>
        </Table>
    );
}

function rowClass(deleted: boolean) {
    return cn(
        'border-border',
        deleted ? 'text-text-muted' : 'cursor-pointer hover:bg-surface-2/60',
    );
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
                            <span className="font-medium text-text">
                                {row.name}
                            </span>
                            {row.isBoard && (
                                <span className="rounded-full bg-link-soft px-2 py-0.5 text-[11px] font-medium text-primary">
                                    Direksi
                                </span>
                            )}
                        </span>
                        {row.parentName && (
                            <span className="block text-xs text-text-muted">
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
                    <TableCell className={cn(CELL, 'text-right tabular-nums')}>
                        {formatNumber(row.membersCount)}
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tabular-nums')}>
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
                    <TableCell className={cn(CELL, 'font-medium text-text')}>
                        {row.name}
                    </TableCell>
                    <TableCell className={CELL}>
                        <Code code={row.code} />
                    </TableCell>
                    <TableCell className={CELL}>
                        {row.divisionName}
                        <span className="ml-1.5 font-mono text-xs text-text-muted">
                            {row.divisionCode}
                        </span>
                    </TableCell>
                    <TableCell className={CELL}>
                        <Person person={row.lead} empty="Belum ditentukan" />
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tabular-nums')}>
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
                    <TableCell className={cn(CELL, 'font-medium text-text')}>
                        {row.name}
                    </TableCell>
                    <TableCell className={CELL}>
                        <span className="tabular-nums">{row.level}</span>
                        <span className="ml-1.5 text-text-muted">
                            {row.levelLabel}
                        </span>
                    </TableCell>
                    <TableCell className={cn(CELL, 'text-right tabular-nums')}>
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
