import { router } from '@inertiajs/react';
import { toast } from 'sonner';

/**
 * POST from a task flow back to the job dashboard. The server answers with a
 * redirect to the same page (fresh `dashboard` + `flow` props, success toast
 * from the flash). State is preserved so the sheet stays open; on a
 * validation error or an HTTP error the caller rolls its optimistic change
 * back and a toast explains what went wrong.
 */
export function submitFlowAction(
    url: string,
    data: Record<string, string | null>,
    {
        failure,
        onStart,
        onSuccess,
        onFailure,
        onFinish,
    }: {
        /** Toast text when the action fails without a field message. */
        failure: string;
        onStart?: () => void;
        onSuccess?: () => void;
        onFailure?: () => void;
        onFinish?: () => void;
    },
): void {
    router.post(url, data, {
        preserveScroll: true,
        preserveState: true,
        onStart,
        onSuccess,
        onFinish,
        onError: (errors) => {
            const message = Object.values(errors)[0];
            toast.error(typeof message === 'string' ? message : failure);
            onFailure?.();
        },
        onHttpException: (response) => {
            toast.error(
                response.status === 404 || response.status === 403
                    ? 'Item ini sudah diputus atau bukan lagi giliran Anda.'
                    : response.status === 429
                      ? 'Terlalu sering. Coba lagi dalam satu menit.'
                      : failure,
            );
            onFailure?.();
            router.reload({ only: ['dashboard', 'flow'] });

            return false;
        },
        onNetworkError: () => {
            toast.error('Koneksi terputus. Periksa jaringan lalu coba lagi.');
            onFailure?.();

            return false;
        },
    });
}
