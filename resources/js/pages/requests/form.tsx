import { Head } from '@inertiajs/react';
import { FileText } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { RequestFormDesktop } from '@/features/requests/request-form.desktop';
import { RequestFormMobile } from '@/features/requests/request-form.mobile';
import { useRequestForm } from '@/features/requests/use-request-form';
import type { RequestFormInitial } from '@/features/requests/use-request-form';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { create, index } from '@/routes/requests';
import type { FormCategory, RequestDetail } from '@/types/requests';

type Props = {
    categories: FormCategory[];
    substitutes: { id: string; name: string; avatar: string | null }[];
    today: string;
    limits: { reason: number; max_files: number; max_kilobytes: number };
    request: RequestDetail | null;
    initial: RequestFormInitial;
};

export default function RequestForm({
    categories,
    substitutes,
    today,
    limits,
    request,
    initial,
}: Props) {
    const breakpoint = useBreakpoint();
    const state = useRequestForm({ categories, initial, request, today });
    const savedAt =
        request?.status === 'draft' ? (request.updated_at ?? null) : null;
    const shared = {
        state,
        categories,
        request,
        substitutes,
        limits,
        today,
        savedAt,
    };

    if (categories.length === 0) {
        return (
            <>
                <Head title="Ajukan pengajuan" />
                <EmptyState
                    icon={FileText}
                    title="Belum ada jenis pengajuan aktif"
                    description="Hubungi HR untuk mengaktifkan jenis cuti, izin, atau lembur."
                />
            </>
        );
    }

    return (
        <>
            <Head title={request ? 'Ubah pengajuan' : 'Ajukan baru'} />
            {breakpoint === 'mobile' ? (
                <RequestFormMobile {...shared} />
            ) : (
                <RequestFormDesktop {...shared} />
            )}
        </>
    );
}

RequestForm.layout = {
    breadcrumbs: [
        { title: 'Pengajuan', href: index() },
        { title: 'Ajukan baru', href: create() },
    ],
    title: 'Ajukan baru',
    back: '/pengajuan',
};
