import { Head, Link, usePage } from '@inertiajs/react';
import { Network, RefreshCw, Search, SearchX } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SegmentedTabs } from '@/components/ui/tabs';
import { OrgChartDesktop } from '@/features/organization/chart/org-chart-desktop';
import { OrgTreeList } from '@/features/organization/chart/org-tree-list';
import type { OrgChart } from '@/features/organization/chart/types';
import {
    filterChart,
    isChartEmpty,
    normalize,
} from '@/features/organization/chart/utils';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { formatNumber } from '@/lib/format';

type Props = {
    chart: OrgChart;
    can: { manageEmployees: boolean; manageOrganization: boolean };
};

type View = 'chart' | 'list';

function SourceNote({ can }: Pick<Props, 'can'>) {
    return (
        <span className="inline-flex flex-wrap items-center gap-1.5">
            <RefreshCw className="size-4" aria-hidden />
            Dibuat otomatis dari data divisi, tim, dan atasan langsung.
            {can.manageEmployees && (
                <Link
                    href="/admin/karyawan"
                    className="font-semibold text-link hover:underline"
                >
                    Ubah di Karyawan
                </Link>
            )}
            {!can.manageEmployees && can.manageOrganization && (
                <Link
                    href="/admin/organisasi"
                    className="font-semibold text-link hover:underline"
                >
                    Kelola di Organisasi
                </Link>
            )}
        </span>
    );
}

function Legend() {
    return (
        <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-label font-normal text-text-muted">
            <li className="flex items-center gap-2">
                <span
                    aria-hidden
                    className="h-0.75 w-4 rounded-full bg-primary"
                />
                Warna garis atas = warna divisi
            </li>
            <li className="flex items-center gap-2">
                <span
                    aria-hidden
                    className="h-3 w-4 rounded-sm border border-dashed border-border-strong"
                />
                Anggota tanpa tim (ringkas)
            </li>
            <li className="flex items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-full bg-link-soft px-2.5 text-[12px] font-bold text-link">
                    Ketua
                </span>
                Ketua tim
            </li>
        </ul>
    );
}

/** Struktur organisasi: chart on desktop, nested list on mobile (mockup StrukturOrg). */
export default function Structure({ chart, can }: Props) {
    const breakpoint = useBreakpoint();
    const { auth } = usePage().props;
    const [query, setQuery] = useState('');
    const [view, setView] = useState<View>('chart');
    const deferredQuery = useDeferredValue(query);
    const searching = normalize(deferredQuery) !== '';
    const filtered = useMemo(
        () => filterChart(chart, deferredQuery),
        [chart, deferredQuery],
    );

    const isMobile = breakpoint === 'mobile';
    const context = {
        viewerId: auth.user?.id ?? null,
        viewerDivisionId: auth.user?.division_id ?? null,
        expandAll: searching,
    };
    const subtitle = [
        chart.companyName,
        `${formatNumber(chart.stats.divisions)} divisi`,
        `${formatNumber(chart.stats.teams)} tim`,
        `${formatNumber(chart.stats.people)} orang`,
    ].join(' · ');

    const empty = isChartEmpty(chart);

    const searchBox = (
        <div className="relative w-full md:w-72">
            <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-text-subtle"
            />
            <Input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cari orang"
                aria-label="Cari orang atau unit"
                className="pl-10 text-[17px] md:text-[16px]"
            />
        </div>
    );

    const body = empty ? (
        <EmptyState
            icon={Network}
            title="Struktur organisasi belum diisi"
            description="Bagan muncul otomatis setelah divisi, tim, dan karyawan ditambahkan."
            action={
                can.manageOrganization ? (
                    <Button asChild variant="outline">
                        <Link href="/admin/organisasi">Kelola divisi</Link>
                    </Button>
                ) : undefined
            }
        />
    ) : isChartEmpty(filtered) ? (
        <EmptyState
            icon={SearchX}
            title="Tidak ada yang cocok"
            description={`Tidak ada orang atau unit yang cocok dengan “${query.trim()}”.`}
            action={
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setQuery('')}
                >
                    Hapus pencarian
                </Button>
            }
        />
    ) : isMobile || view === 'list' ? (
        <OrgTreeList
            key={searching ? 'search' : 'all'}
            chart={filtered}
            {...context}
        />
    ) : (
        <OrgChartDesktop
            key={searching ? 'search' : 'all'}
            chart={filtered}
            footer={<SourceNote can={can} />}
            {...context}
        />
    );

    return (
        <>
            <Head title="Struktur organisasi" />

            {isMobile ? (
                <div className="flex flex-col gap-3.5">
                    <p className="text-label font-normal text-text-muted">
                        {subtitle}
                    </p>
                    {!empty && searchBox}
                    {body}
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    <header className="flex flex-wrap items-end justify-between gap-4">
                        <div className="flex flex-col gap-2">
                            <h1 className="text-display">
                                Struktur organisasi
                            </h1>
                            <p className="text-body-lg text-text-muted">
                                {subtitle}
                            </p>
                        </div>
                        {!empty && (
                            <div className="flex flex-wrap items-center gap-3">
                                {searchBox}
                                <SegmentedTabs
                                    label="Tampilan"
                                    value={view}
                                    onValueChange={setView}
                                    options={[
                                        { value: 'chart', label: 'Bagan' },
                                        { value: 'list', label: 'Daftar' },
                                    ]}
                                />
                            </div>
                        )}
                    </header>

                    {body}

                    {!empty && view === 'chart' && <Legend />}
                    {!empty && view === 'list' && (
                        <p className="text-label font-normal text-text-muted">
                            <SourceNote can={can} />
                        </p>
                    )}
                </div>
            )}
        </>
    );
}

Structure.layout = {
    breadcrumbs: [
        { title: 'Organisasi', href: '/organisasi/struktur' },
        { title: 'Struktur organisasi', href: '/organisasi/struktur' },
    ],
    title: 'Struktur organisasi',
    back: '/menu',
};
