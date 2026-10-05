import { Head, Link, router } from '@inertiajs/react';
import { Building2, Plus, Search, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import DivisionController from '@/actions/App/Http/Controllers/Organization/DivisionController';
import PositionController from '@/actions/App/Http/Controllers/Organization/PositionController';
import TeamController from '@/actions/App/Http/Controllers/Organization/TeamController';
import { DesktopOnlyNotice } from '@/components/desktop-only-notice';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DeleteDialog } from '@/features/organization/admin/delete-dialog';
import { DivisionSheet } from '@/features/organization/admin/division-sheet';
import { PositionSheet } from '@/features/organization/admin/position-sheet';
import {
    DivisionTable,
    PositionTable,
    TeamTable,
} from '@/features/organization/admin/tables';
import { TeamSheet } from '@/features/organization/admin/team-sheet';
import type {
    DivisionRow,
    OrganizationAdminProps,
    OrgTab,
    PositionRow,
    TeamRow,
} from '@/features/organization/admin/types';
import { normalize } from '@/features/organization/chart/utils';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

const TABS: Record<
    OrgTab,
    {
        label: string;
        noun: string;
        href: (query?: Record<string, number>) => string;
    }
> = {
    divisi: {
        label: 'Divisi',
        noun: 'divisi',
        href: (query) => DivisionController.index.url({ query }),
    },
    tim: {
        label: 'Tim',
        noun: 'tim',
        href: (query) => TeamController.index.url({ query }),
    },
    jabatan: {
        label: 'Jabatan',
        noun: 'jabatan',
        href: (query) => PositionController.index.url({ query }),
    },
};

/** Sheet state: closed, creating, or editing a row. */
type Editing<T> = { open: boolean; row: T | null; key: number };

function useEditing<T>() {
    const [state, setState] = useState<Editing<T>>({
        open: false,
        row: null,
        key: 0,
    });

    return {
        state,
        open: (row: T | null) =>
            setState((current) => ({ open: true, row, key: current.key + 1 })),
        setOpen: (open: boolean) =>
            setState((current) => ({ ...current, open })),
    };
}

function matches(query: string, ...values: (string | null)[]): boolean {
    const needle = normalize(query);

    return (
        needle === '' ||
        values.some(
            (value) => value !== null && normalize(value).includes(needle),
        )
    );
}

function restore(url: string) {
    router.post(
        url,
        {},
        {
            preserveScroll: true,
            onError: (errors) =>
                toast.error(Object.values(errors)[0] ?? 'Gagal memulihkan.'),
        },
    );
}

/** Admin › Organisasi: divisions, teams and positions (desktop only). */
export default function OrganizationAdmin({
    tab,
    showDeleted,
    counts,
    options,
    divisions = [],
    teams = [],
    positions = [],
}: OrganizationAdminProps) {
    const breakpoint = useBreakpoint();
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState<{
        label: string;
        url: string;
    } | null>(null);

    const divisionSheet = useEditing<DivisionRow>();
    const teamSheet = useEditing<TeamRow>();
    const positionSheet = useEditing<PositionRow>();

    const filtered = useMemo(
        () => ({
            divisions: divisions.filter((row) =>
                matches(query, row.name, row.code, row.head?.name ?? null),
            ),
            teams: teams.filter((row) =>
                matches(
                    query,
                    row.name,
                    row.code,
                    row.divisionName,
                    row.lead?.name ?? null,
                ),
            ),
            positions: positions.filter((row) => matches(query, row.name)),
        }),
        [divisions, teams, positions, query],
    );

    if (breakpoint === 'mobile') {
        return (
            <>
                <Head title="Organisasi" />
                <DesktopOnlyNotice feature="Kelola divisi, tim, dan jabatan" />
            </>
        );
    }

    const current = TABS[tab];
    const rowCount = {
        divisi: filtered.divisions.length,
        tim: filtered.teams.length,
        jabatan: filtered.positions.length,
    }[tab];
    const totalCount = {
        divisi: divisions.length,
        tim: teams.length,
        jabatan: positions.length,
    }[tab];

    const toggleDeleted = (checked: boolean) => {
        router.get(
            current.href(checked ? { terhapus: 1 } : undefined),
            {},
            {
                preserveScroll: true,
                preserveState: true,
                replace: true,
                onStart: () => setLoading(true),
                onFinish: () => setLoading(false),
            },
        );
    };

    const create = () => {
        if (tab === 'divisi') {
            divisionSheet.open(null);
        } else if (tab === 'tim') {
            teamSheet.open(null);
        } else {
            positionSheet.open(null);
        }
    };

    let table = null;

    if (tab === 'divisi') {
        table = (
            <DivisionTable
                rows={filtered.divisions}
                onEdit={divisionSheet.open}
                onDelete={(row) =>
                    setDeleting({
                        label: `divisi ${row.name}`,
                        url: DivisionController.destroy.url(row.id),
                    })
                }
                onRestore={(row) =>
                    restore(DivisionController.restore.url(row.id))
                }
            />
        );
    } else if (tab === 'tim') {
        table = (
            <TeamTable
                rows={filtered.teams}
                onEdit={teamSheet.open}
                onDelete={(row) =>
                    setDeleting({
                        label: row.name,
                        url: TeamController.destroy.url(row.id),
                    })
                }
                onRestore={(row) => restore(TeamController.restore.url(row.id))}
            />
        );
    } else {
        table = (
            <PositionTable
                rows={filtered.positions}
                onEdit={positionSheet.open}
                onDelete={(row) =>
                    setDeleting({
                        label: `jabatan ${row.name}`,
                        url: PositionController.destroy.url(row.id),
                    })
                }
                onRestore={(row) =>
                    restore(PositionController.restore.url(row.id))
                }
            />
        );
    }

    return (
        <>
            <Head title="Organisasi" />

            <div className="space-y-5">
                <header className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Organisasi
                        </h1>
                        <p className="text-sm text-text-muted">
                            {formatNumber(counts.divisions)} divisi ·{' '}
                            {formatNumber(counts.teams)} tim ·{' '}
                            {formatNumber(counts.positions)} jabatan · data ini
                            menjadi sumber struktur organisasi dan awalan ID
                            tugas.{' '}
                            <Link
                                href="/organisasi/struktur"
                                className="text-primary underline underline-offset-2 hover:text-primary-hover"
                            >
                                Lihat bagan
                            </Link>
                        </p>
                    </div>
                    <Button type="button" onClick={create}>
                        <Plus />
                        Tambah {current.noun}
                    </Button>
                </header>

                <nav
                    aria-label="Data organisasi"
                    className="flex gap-1 border-b border-border"
                >
                    {(Object.keys(TABS) as OrgTab[]).map((key) => (
                        <Link
                            key={key}
                            href={TABS[key].href(
                                showDeleted ? { terhapus: 1 } : undefined,
                            )}
                            preserveScroll
                            aria-current={key === tab ? 'page' : undefined}
                            className={cn(
                                '-mb-px border-b-2 px-3 py-2 text-sm transition-colors duration-120 ease-brand',
                                key === tab
                                    ? 'border-primary font-medium text-text'
                                    : 'border-transparent text-text-muted hover:text-text',
                            )}
                        >
                            {TABS[key].label}
                            <span className="ml-1.5 text-xs text-text-muted tabular-nums">
                                {formatNumber(
                                    {
                                        divisi: counts.divisions,
                                        tim: counts.teams,
                                        jabatan: counts.positions,
                                    }[key],
                                )}
                            </span>
                        </Link>
                    ))}
                </nav>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative w-72">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-subtle"
                        />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Cari nama atau kode"
                            aria-label={`Cari ${current.noun}`}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Checkbox
                            id="show-deleted"
                            checked={showDeleted}
                            onCheckedChange={(checked) =>
                                toggleDeleted(checked === true)
                            }
                        />
                        <Label
                            htmlFor="show-deleted"
                            className="text-sm font-normal text-text-muted"
                        >
                            Tampilkan yang dihapus
                        </Label>
                    </div>
                    <span className="ml-auto text-[13px] text-text-muted tabular-nums">
                        {formatNumber(rowCount)} dari {formatNumber(totalCount)}
                    </span>
                </div>

                <div
                    aria-busy={loading}
                    className={cn(
                        'overflow-hidden rounded-lg border border-border bg-surface shadow-card transition-opacity duration-180 ease-brand',
                        loading && 'opacity-60',
                    )}
                >
                    {totalCount === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title={`Belum ada ${current.noun}`}
                            description="Data yang ditambahkan akan tampil di bagan organisasi dan formulir karyawan."
                            action={
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={create}
                                >
                                    <Plus />
                                    Tambah {current.noun}
                                </Button>
                            }
                            className="m-4 border-0"
                        />
                    ) : rowCount === 0 ? (
                        <EmptyState
                            icon={SearchX}
                            title="Tidak ada yang cocok"
                            description={`Tidak ada ${current.noun} yang cocok dengan “${query.trim()}”.`}
                            className="m-4 border-0"
                        />
                    ) : (
                        table
                    )}
                </div>

                <p className="text-[13px] text-text-muted">
                    Hapus hanya bisa dilakukan bila tidak ada karyawan aktif
                    {tab === 'divisi' ? ', tim, atau sub-divisi' : ''} di
                    dalamnya. Riwayat lama tetap tersimpan.
                </p>
            </div>

            <DivisionSheet
                key={`division-${divisionSheet.state.key}`}
                division={divisionSheet.state.row}
                open={divisionSheet.state.open}
                onOpenChange={divisionSheet.setOpen}
                onDelete={(row) => {
                    divisionSheet.setOpen(false);
                    setDeleting({
                        label: `divisi ${row.name}`,
                        url: DivisionController.destroy.url(row.id),
                    });
                }}
                options={options}
            />
            <TeamSheet
                key={`team-${teamSheet.state.key}`}
                team={teamSheet.state.row}
                open={teamSheet.state.open}
                onOpenChange={teamSheet.setOpen}
                onDelete={(row) => {
                    teamSheet.setOpen(false);
                    setDeleting({
                        label: row.name,
                        url: TeamController.destroy.url(row.id),
                    });
                }}
                options={options}
            />
            <PositionSheet
                key={`position-${positionSheet.state.key}`}
                position={positionSheet.state.row}
                open={positionSheet.state.open}
                onOpenChange={positionSheet.setOpen}
                onDelete={(row) => {
                    positionSheet.setOpen(false);
                    setDeleting({
                        label: `jabatan ${row.name}`,
                        url: PositionController.destroy.url(row.id),
                    });
                }}
                options={options}
            />
            <DeleteDialog
                target={deleting}
                onClose={() => setDeleting(null)}
                errorKey={
                    tab === 'divisi'
                        ? 'division'
                        : tab === 'tim'
                          ? 'team'
                          : 'position'
                }
            />
        </>
    );
}

OrganizationAdmin.layout = {
    width: 'wide',
    breadcrumbs: [
        { title: 'Admin', href: '/admin/organisasi' },
        { title: 'Organisasi', href: '/admin/organisasi' },
    ],
    back: '/menu',
};
