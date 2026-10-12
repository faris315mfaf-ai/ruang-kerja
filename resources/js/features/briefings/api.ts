import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import type { RouteDefinition } from '@/wayfinder';

const HTTP_MESSAGES: Record<number, string> = {
    403: 'Anda tidak punya akses untuk melakukan ini.',
    404: 'Data briefing tidak ditemukan.',
    419: 'Sesi berakhir. Muat ulang halaman lalu coba lagi.',
    429: 'Terlalu sering. Coba lagi sebentar lagi.',
};

/**
 * POST /briefing or /briefing/delegasi: the server answers with a redirect
 * back (fresh `briefing` prop, success toast from the flash). Resolves true
 * on success; a validation error (e.g. the window just closed), an HTTP or
 * a network failure is toasted and resolves false. A cancelled/interrupted
 * visit also resolves false (`onFinish` settles whatever is left), so the
 * caller's button never stays busy.
 */
export function submitBriefingForm(
    route: RouteDefinition<'post'>,
    data: Record<string, string>,
    failure: string,
    onStart?: () => void,
): Promise<boolean> {
    return new Promise((resolve) => {
        let settled = false;
        const settle = (ok: boolean) => {
            if (!settled) {
                settled = true;
                resolve(ok);
            }
        };

        router.visit(route, {
            data,
            preserveScroll: true,
            preserveState: true,
            onStart: () => onStart?.(),
            onSuccess: () => settle(true),
            onError: (errors) => {
                const first = Object.values(errors)[0];

                toast.error(typeof first === 'string' ? first : failure);
                settle(false);
            },
            onHttpException: (response) => {
                toast.error(HTTP_MESSAGES[response.status] ?? failure);
                settle(false);

                return false;
            },
            onNetworkError: () => {
                toast.error(
                    'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
                );
                settle(false);

                return false;
            },
            onCancel: () => settle(false),
            onFinish: () => settle(false),
        });
    });
}
