import { Head, Link, router } from '@inertiajs/react';
import { Building2, Network, Plus, Search, SearchX } from 'lucide-react';
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
import { TabNav } from '@/components/ui/tabs';
import { AdminPageHeader, AdminToolbar } from '@/features/admin/page-header';
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
                <Head title="Kelola organisasi" />
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
            <Head title="Kelola organisasi" />

            <div className="flex flex-col gap-6">
                <AdminPageHeader
                    overline="Organisasi"
                    title="Kelola organisasi"
                    description={
                        <>
                            {formatNumber(counts.divisions)} divisi ·{' '}
                            {formatNumber(counts.teams)} tim ·{' '}
                            {formatNumber(counts.positions)} jabatan · data ini
                            menjadi sumber struktur organisasi dan awalan ID
                            tugas.
                        </>
                    }
                    actions={
                        <>
                            <Button variant="outline" asChild>
                                <Link href="/organisasi/struktur" prefetch>
                                    <Network aria-hidden />
                                    Lihat bagan
                                </Link>
                            </Button>
                            <Button type="button" onClick={create}>
                                <Plus />
                                Tambah {current.noun}
                            </Button>
                        </>
                    }
                />

                <TabNav
                    preserveScroll
                    label="Data organisasi"
                    items={(Object.keys(TABS) as OrgTab[]).map((key) => ({
                        href: TABS[key].href(
                            showDeleted ? { terhapus: 1 } : undefined,
                        ),
                        label: TABS[key].label,
                        count: {
                            divisi: counts.divisions,
                            tim: counts.teams,
                            jabatan: counts.positions,
                        }[key],
                        active: key === tab,
                    }))}
                />

                <AdminToolbar className="items-center">
                    <div role="search" className="relative w-80">
                        <Search
                            aria-hidden
                            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-muted"
                        />
                        <Input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Cari nama atau kode"
                            aria-label={`Cari ${current.noun}`}
                            className="pl-11"
                        />
                    </div>
                    <div className="flex min-h-control items-center gap-2.5">
                        <Checkbox
                            id="show-deleted"
                            checked={showDeleted}
                            onCheckedChange={(checked) =>
                                toggleDeleted(checked === true)
                            }
                        />
                        <Label
                            htmlFor="show-deleted"
                            className="text-[15px] font-medium text-text-muted"
                        >
                            Tampilkan yang dihapus
                        </Label>
                    </div>
                    <span className="ml-auto text-meta text-text-muted tnum">
                        {formatNumber(rowCount)} dari {formatNumber(totalCount)}
                    </span>
                </AdminToolbar>

                <div
                    aria-busy={loading}
                    className={cn(
                        'overflow-hidden rounded-panel border border-border bg-surface shadow-card transition-opacity duration-180 ease-brand motion-reduce:transition-none',
                        loading && 'opacity-60',
                    )}
                >
                    {totalCount === 0 ? (
                        <EmptyState
                            icon={Building2}
                            title={`Belum ada ${current.noun}`}
                            description="Data yang ditambahkan akan tampil di bagan organisasi dan formulir karyawan."
                            action={
                                <Button type="button" onClick={create}>
                                    <Plus />
                                    Tambah {current.noun}
                                </Button>
                            }
                            className="m-5 border-0"
                        />
                    ) : rowCount === 0 ? (
                        <EmptyState
                            icon={SearchX}
                            title="Tidak ada yang cocok"
                            description={`Tidak ada ${current.noun} yang cocok dengan “${query.trim()}”.`}
                            className="m-5 border-0"
                        />
                    ) : (
                        table
                    )}
                </div>

                <p className="text-meta text-text-muted">
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
        { title: 'Organisasi', href: '' },
        { title: 'Kelola organisasi', href: '/admin/organisasi' },
    ],
    title: 'Kelola organisasi',
    back: '/menu',
};
