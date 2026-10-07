import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import type { RouteDefinition } from '@/wayfinder';

export type FormErrors = Record<string, string>;

type Method = 'get' | 'post' | 'patch' | 'delete';

const HTTP_MESSAGES: Record<number, string> = {
    403: 'Anda tidak punya akses untuk melakukan ini.',
    404: 'Objective atau key result ini tidak ditemukan atau sudah dihapus.',
    419: 'Sesi berakhir. Muat ulang halaman lalu coba lagi.',
    429: 'Terlalu sering. Coba lagi sebentar lagi.',
};

/**
 * Inertia visit for an OKR form/action that resolves true on success (the
 * server flashes the success toast and the page props reload) and false on
 * failure: validation errors go to `onErrors` (and the first one is toasted
 * when nobody shows them), HTTP and network failures are toasted.
 */
export function submit(
    route: RouteDefinition<Method>,
    data: Record<string, unknown> = {},
    options: {
        onErrors?: (errors: FormErrors) => void;
        onStart?: () => void;
        onFinish?: () => void;
        /** Only reload these props (default: all). */
        only?: string[];
    } = {},
): Promise<boolean> {
    return new Promise((resolve) => {
        router.visit(route, {
            data: data as Record<string, string>,
            preserveScroll: true,
            preserveState: true,
            only: options.only,
            onStart: () => options.onStart?.(),
            onFinish: () => options.onFinish?.(),
            onSuccess: () => resolve(true),
            onError: (errors) => {
                const map = errors as FormErrors;

                if (options.onErrors) {
                    options.onErrors(map);
                } else {
                    toast.error(
                        Object.values(map)[0] ?? 'Perubahan gagal disimpan.',
                    );
                }

                resolve(false);
            },
            onHttpException: (response) => {
                toast.error(
                    HTTP_MESSAGES[response.status] ??
                        'Terjadi kesalahan. Coba lagi sebentar lagi.',
                );
                resolve(false);

                return false;
            },
            onNetworkError: () => {
                toast.error(
                    'Koneksi terputus. Periksa jaringan Anda lalu coba lagi.',
                );
                resolve(false);

                return false;
            },
        });
    });
}
