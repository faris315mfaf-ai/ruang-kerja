import { Link, router } from '@inertiajs/react';
import {
    Mail,
    Monitor,
    Search,
    UserRound,
    UserRoundSearch,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { ChipScroller } from '@/components/mobile/chip-scroller';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';
import { index, show } from '@/routes/admin/employees';
import { RoleBadges, StatusBadge, WorkModeBadge } from './employee-badges';
import { STATUS_LABELS } from './labels';
import type { EmployeeIndexProps, EmployeeRow } from './types';
import { useEmployeeFilters } from './use-employee-filters';

/**
 * Admin › Karyawan on phones (mockup `MKaryawan`): search, division chips, cards
 * and a read-only profile sheet. Editing is desktop-only (PLATFORM.md §3).
 */
export function EmployeesMobile({
    employees,
    filters,
    counts,
    divisions,
    can,
}: EmployeeIndexProps) {
    const { search, changeSearch, apply, loading } =
        useEmployeeFilters(filters);
    const [items, setItems] = useState<EmployeeRow[]>(employees.data);
    const [loadingMore, setLoadingMore] = useState(false);
    const [selected, setSelected] = useState<EmployeeRow | null>(null);
    const { meta } = employees;

    // Page 1 replaces the list (new filter); later pages append ("Muat lagi").
    useEffect(() => {
        setItems((current) =>
            meta.current_page === 1
                ? employees.data
                : [
                      ...current,
                      ...employees.data.filter(
                          (row) => !current.some((item) => item.id === row.id),
                      ),
                  ],
        );
    }, [employees.data, meta.current_page]);

    const loadMore = () => {
        router.get(
            index.url(),
            { ...currentQuery(), page: meta.current_page + 1 },
            {
                only: ['employees'],
                preserveState: true,
                preserveScroll: true,
                preserveUrl: true,
                onStart: () => setLoadingMore(true),
                onFinish: () => setLoadingMore(false),
            },
        );
    };

    const chips = [
        { value: '', label: 'Semua divisi' },
        ...divisions.map((division) => ({
            value: division.id,
            label: division.name,
            count: division.count,
        })),
    ];

    return (
        <div className="space-y-4">
            <p className="text-[13px] text-text-muted">
                <span className="font-medium text-text tnum">
                    {formatNumber(counts.active)}
                </span>{' '}
                aktif ·{' '}
                <span className="tnum">{formatNumber(counts.inactive)}</span>{' '}
                nonaktif
            </p>

            {can.manage && (
                <p
                    role="note"
                    className="flex items-start gap-3 rounded-lg border border-info/30 bg-info/10 px-4 py-3 text-sm text-text"
                >
                    <Monitor
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-info"
                        strokeWidth={1.75}
                    />
                    Kelola, impor, dan ubah peran karyawan tersedia di desktop.
                    Di ponsel Anda bisa mencari dan melihat profil.
                </p>
            )}

            <div className="relative">
                <Search
                    aria-hidden
                    className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
                />
                <Input
                    type="search"
                    value={search}
                    onChange={(event) => changeSearch(event.target.value)}
                    placeholder="Cari nama, email, atau jabatan"
                    aria-label="Cari karyawan"
                    className="h-11 pl-11 text-base"
                />
            </div>

            {divisions.length > 1 && (
                <ChipScroller
                    label="Filter divisi"
                    chips={chips}
                    value={filters.division ?? ''}
                    onChange={(value) => apply({ division: value || null })}
                />
            )}

            {loading && items.length === 0 ? (
                <div className="space-y-2" aria-busy>
                    {Array.from({ length: 5 }, (_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                    ))}
                </div>
            ) : items.length === 0 ? (
                <EmptyState
                    icon={UserRoundSearch}
                    title="Tidak ada karyawan yang cocok"
                    description="Coba kata kunci lain atau pilih divisi lain."
                />
            ) : (
                <ul
                    className={cn(
                        '-mx-4 divide-y divide-border border-y border-border bg-surface transition-opacity',
                        loading && 'opacity-60',
                    )}
                    aria-busy={loading}
                >
                    {items.map((employee) => (
                        <li key={employee.id}>
                            <button
                                type="button"
                                onClick={() => setSelected(employee)}
                                className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-2"
                            >
                                <UserAvatar
                                    name={employee.name}
                                    src={employee.avatar_url}
                                    className="size-10"
                                />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[15px] font-medium text-text">
                                        {employee.name}
                                    </span>
                                    <span className="block truncate text-[13px] text-text-muted">
                                        {[
                                            employee.position?.name,
                                            employee.division?.name,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ') || '—'}
                                    </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <WorkModeBadge mode={employee.work_mode} />
                                    <StatusBadge
                                        status={employee.status}
                                        className="text-xs"
                                    />
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            {meta.current_page < meta.last_page && items.length > 0 && (
                <Button
                    variant="outline"
                    className="h-11 w-full"
                    disabled={loadingMore}
                    onClick={loadMore}
                >
                    {loadingMore
                        ? 'Memuat…'
                        : `Muat lagi (${formatNumber(meta.total - items.length)} tersisa)`}
                </Button>
            )}

            <ProfileSheet
                employee={selected}
                canManage={can.manage}
                onClose={() => setSelected(null)}
            />
        </div>
    );
}

function currentQuery(): Record<string, string> {
    return Object.fromEntries(new URLSearchParams(window.location.search));
}

function ProfileSheet({
    employee,
    canManage,
    onClose,
}: {
    employee: EmployeeRow | null;
    canManage: boolean;
    onClose: () => void;
}) {
    return (
        <BottomSheet
            open={employee !== null}
            onOpenChange={(open) => !open && onClose()}
            title={employee?.name ?? 'Profil karyawan'}
            description={
                employee
                    ? [
                          employee.position?.name,
                          employee.division
                              ? `Divisi ${employee.division.name}`
                              : null,
                      ]
                          .filter(Boolean)
                          .join(' · ') || STATUS_LABELS[employee.status]
                    : undefined
            }
            footer={
                employee && (
                    <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" className="h-11" asChild>
                                <a href={`mailto:${employee.email}`}>
                                    <Mail />
                                    Hubungi via email
                                </a>
                            </Button>
                            <Button className="h-11" asChild>
                                <Link href={show(employee.id)}>
                                    <UserRound />
                                    Lihat profil
                                </Link>
                            </Button>
                        </div>
                        {canManage && (
                            <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted">
                                <Monitor aria-hidden className="size-3.5" />
                                Ubah data, divisi, atau peran lewat desktop.
                            </p>
                        )}
                    </div>
                )
            }
        >
            {employee && (
                <div className="space-y-1">
                    <div className="flex items-center gap-3 pb-3">
                        <UserAvatar
                            name={employee.name}
                            src={employee.avatar_url}
                            className="size-14 text-base"
                        />
                        <StatusBadge status={employee.status} />
                    </div>
                    <dl className="divide-y divide-border border-t border-border text-[15px]">
                        <ProfileRow label="Email">
                            <span className="font-mono text-[13px] break-all">
                                {employee.email}
                            </span>
                        </ProfileRow>
                        <ProfileRow label="Atasan langsung">
                            {employee.manager ? (
                                <span className="flex items-center gap-2">
                                    <UserAvatar
                                        name={employee.manager.name}
                                        src={employee.manager.avatar_url}
                                        className="size-6"
                                    />
                                    {employee.manager.name}
                                </span>
                            ) : (
                                '—'
                            )}
                        </ProfileRow>
                        <ProfileRow label="Tim">
                            {employee.team?.name ?? '—'}
                        </ProfileRow>
                        <ProfileRow label="Mode kerja">
                            <WorkModeBadge mode={employee.work_mode} />
                        </ProfileRow>
                        <ProfileRow label="Peran">
                            <RoleBadges roles={employee.roles} />
                        </ProfileRow>
                        <ProfileRow label="Bergabung">
                            {employee.joined_at
                                ? formatDate(employee.joined_at)
                                : '—'}
                        </ProfileRow>
                    </dl>
                </div>
            )}
        </BottomSheet>
    );
}

function ProfileRow({
    label,
    children,
}: {
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="grid min-h-12 grid-cols-[120px_1fr] items-center gap-3 py-2.5">
            <dt className="text-text-muted">{label}</dt>
            <dd className="min-w-0 text-text">{children}</dd>
        </div>
    );
}
