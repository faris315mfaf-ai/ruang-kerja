import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, RefreshCw, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { findObjective } from '@/features/okr/fixtures';
import { ObjectiveDetail } from '@/features/okr/objective-detail';
import { PreviewHeader, usePreviewState } from '@/features/okr/preview-state';
import { useBreakpoint } from '@/hooks/use-breakpoint';

type Props = {
    /** Objective id from the URL (sample ids: q4-ops-1, q3-prg-1 …). */
    objectiveId: string;
};

/**
 * /okr/{objective} — objective detail (Fase 3 preview): key results with
 * progress, check-ins and linked tasks; add/edit KR and check-in dialogs.
 */
export default function OkrShowPage({ objectiveId }: Props) {
    const breakpoint = useBreakpoint();
    const state = usePreviewState();
    const found = findObjective(objectiveId);
    const objective =
        found && state === 'kosong' ? { ...found, key_results: [] } : found;

    return (
        <>
            <Head title={objective?.title ?? 'Detail OKR'} />
            <div className="flex flex-col gap-5">
                <PreviewHeader />
                {breakpoint === null || state === 'memuat' ? (
                    <div
                        className="flex flex-col gap-5"
                        aria-busy
                        aria-label="Memuat"
                    >
                        <Skeleton className="h-48 w-full rounded-panel" />
                        <div className="grid grid-cols-3 gap-5">
                            <Skeleton className="h-28" />
                            <Skeleton className="h-28" />
                            <Skeleton className="h-28" />
                        </div>
                        <Skeleton className="h-96 w-full rounded-panel" />
                    </div>
                ) : state === 'galat' ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Objective gagal dimuat"
                        description="Data objective tidak bisa diambil. Periksa koneksi lalu coba lagi."
                        action={
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.get(
                                        `/okr/${objectiveId}`,
                                        {},
                                        { preserveScroll: true },
                                    )
                                }
                            >
                                <RefreshCw aria-hidden />
                                Coba lagi
                            </Button>
                        }
                    />
                ) : objective ? (
                    <ObjectiveDetail
                        key={`${objective.id}-${state}`}
                        initial={objective}
                        mobile={breakpoint === 'mobile'}
                    />
                ) : (
                    <EmptyState
                        icon={SearchX}
                        title="Objective tidak ditemukan"
                        description="Objective ini mungkin sudah dihapus atau Anda tidak punya akses."
                        action={
                            <Button asChild variant="outline">
                                <Link href="/okr">Kembali ke OKR</Link>
                            </Button>
                        }
                    />
                )}
            </div>
        </>
    );
}

OkrShowPage.layout = {
    breadcrumbs: [
        { title: 'OKR', href: '/okr' },
        { title: 'Detail objective', href: '/okr' },
    ],
    title: 'Detail OKR',
    back: '/okr',
};
