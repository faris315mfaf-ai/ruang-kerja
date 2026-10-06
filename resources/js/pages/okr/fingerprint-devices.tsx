import { Head, router } from '@inertiajs/react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FingerprintDesktop } from '@/features/fingerprint/fingerprint.desktop';
import { FingerprintMobile } from '@/features/fingerprint/fingerprint.mobile';
import { FINGERPRINT_PAGE } from '@/features/fingerprint/fixtures';
import type { FingerprintPageProps } from '@/features/fingerprint/types';
import { useFingerprint } from '@/features/fingerprint/use-fingerprint';
import { PreviewHeader, usePreviewState } from '@/features/okr/preview-state';
import { useBreakpoint } from '@/hooks/use-breakpoint';

/**
 * /admin/mesin-absensi — ZKTeco fingerprint devices (Fase 3 preview, ADMS
 * push). Desktop-first; phones get a read-only list.
 */
export default function FingerprintDevicesPage() {
    const breakpoint = useBreakpoint();
    const state = usePreviewState();
    const props: FingerprintPageProps =
        state === 'kosong'
            ? { ...FINGERPRINT_PAGE, devices: [], punches: [], mappings: [] }
            : FINGERPRINT_PAGE;

    return (
        <>
            <Head title="Mesin absensi" />
            <div className="flex flex-col gap-5">
                <PreviewHeader />
                {breakpoint === null || state === 'memuat' ? (
                    <div
                        className="flex flex-col gap-5"
                        aria-busy
                        aria-label="Memuat"
                    >
                        <Skeleton className="h-12 w-80" />
                        <div className="grid grid-cols-2 gap-5 xl:grid-cols-4">
                            {[0, 1, 2, 3].map((key) => (
                                <Skeleton
                                    key={key}
                                    className="h-32 rounded-card"
                                />
                            ))}
                        </div>
                        <Skeleton className="h-80 w-full rounded-panel" />
                    </div>
                ) : state === 'galat' ? (
                    <EmptyState
                        icon={AlertTriangle}
                        title="Daftar mesin gagal dimuat"
                        description="Data mesin tidak bisa diambil. Periksa koneksi lalu coba lagi."
                        action={
                            <Button
                                variant="outline"
                                onClick={() =>
                                    router.get(
                                        '/admin/mesin-absensi',
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
                ) : (
                    <FingerprintContent
                        key={state}
                        props={props}
                        mobile={breakpoint === 'mobile'}
                    />
                )}
            </div>
        </>
    );
}

function FingerprintContent({
    props,
    mobile,
}: {
    props: FingerprintPageProps;
    mobile: boolean;
}) {
    const state = useFingerprint(props);

    return mobile ? (
        <FingerprintMobile props={props} state={state} />
    ) : (
        <FingerprintDesktop props={props} state={state} />
    );
}

FingerprintDevicesPage.layout = {
    breadcrumbs: [
        { title: 'Admin', href: '/admin/karyawan' },
        { title: 'Mesin absensi', href: '/admin/mesin-absensi' },
    ],
    title: 'Mesin absensi',
};
