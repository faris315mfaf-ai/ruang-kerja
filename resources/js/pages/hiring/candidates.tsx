import { Head, Link } from '@inertiajs/react';
import { BriefcaseBusiness, UserPlus, Users } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/mobile/fab';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AddCandidateDialog } from '@/features/hiring/add-candidate-dialog';
import {
    CandidateBoard,
    CandidateList,
} from '@/features/hiring/candidate-board';
import { CandidateFilters } from '@/features/hiring/candidate-filters';
import { HiringShell } from '@/features/hiring/hiring-shell';
import { hiringUrls } from '@/features/hiring/lib';
import type { CandidatesPageProps } from '@/features/hiring/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /hiring — tab Kandidat: board per stage on desktop/tablet, stage chips +
 * list on phones. HR adds candidates by hand ("Tambah kandidat manual");
 * applicants from the Google Form arrive here automatically.
 */
export default function HiringCandidates({
    hiring,
    positions,
    candidates,
    truncated,
    filters,
}: CandidatesPageProps) {
    const breakpoint = useBreakpoint();
    const mobile = breakpoint === 'mobile';
    const [adding, setAdding] = useState(false);
    const canAdd =
        hiring.can_manage &&
        positions.some((position) => position.status !== 'closed');
    const filtered = filters.position !== null || filters.q !== null;

    let body;

    if (breakpoint === null) {
        body = <Skeleton className="h-96 w-full rounded-panel" />;
    } else if (positions.length === 0) {
        body = (
            <EmptyState
                icon={BriefcaseBusiness}
                title="Belum ada lowongan"
                description={
                    hiring.can_manage
                        ? 'Buat lowongan dulu, lalu sambungkan Google Form-nya agar pelamar masuk otomatis.'
                        : 'Lowongan yang Anda tangani akan muncul di sini.'
                }
                action={
                    hiring.can_manage ? (
                        <Button asChild>
                            <Link href={hiringUrls.positions}>
                                Buka tab Lowongan
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
        );
    } else if (candidates.length === 0 && !filtered) {
        body = (
            <EmptyState
                icon={Users}
                title="Belum ada kandidat"
                description="Pelamar dari Google Form masuk otomatis ke tahap Masuk."
            />
        );
    } else if (mobile) {
        body = (
            <CandidateList
                candidates={candidates}
                canManage={hiring.can_manage}
                showPosition={filters.position === null}
            />
        );
    } else {
        body = (
            <CandidateBoard
                candidates={candidates}
                canManage={hiring.can_manage}
                showPosition={filters.position === null}
            />
        );
    }

    return (
        <>
            <Head title="Hiring" />
            <HiringShell
                overview={hiring}
                tab="candidates"
                actions={
                    canAdd && !mobile ? (
                        <Button onClick={() => setAdding(true)}>
                            <UserPlus aria-hidden />
                            Tambah kandidat manual
                        </Button>
                    ) : undefined
                }
            >
                {positions.length > 0 && (
                    <CandidateFilters positions={positions} filters={filters} />
                )}
                {filtered && candidates.length === 0 ? (
                    <EmptyState
                        size="sm"
                        icon={Users}
                        title="Tidak ada kandidat yang cocok"
                        description="Ubah filter lowongan atau kata pencarian."
                    />
                ) : (
                    body
                )}
                {truncated && (
                    <p className="text-meta text-text-muted">
                        Menampilkan 500 kandidat terbaru. Pilih satu lowongan
                        untuk melihat sisanya.
                    </p>
                )}
            </HiringShell>
            {canAdd && mobile && (
                <Fab
                    label="Tambah kandidat manual"
                    onClick={() => setAdding(true)}
                >
                    <UserPlus
                        className="size-7"
                        strokeWidth={2.2}
                        aria-hidden
                    />
                </Fab>
            )}
            {canAdd && breakpoint !== null && (
                <AddCandidateDialog
                    open={adding}
                    onOpenChange={setAdding}
                    positions={positions}
                    defaultPosition={filters.position}
                    mobile={mobile}
                />
            )}
        </>
    );
}

HiringCandidates.layout = {
    width: 'wide',
    breadcrumbs: [{ title: 'Hiring', href: '/hiring' }],
    title: 'Hiring',
};
