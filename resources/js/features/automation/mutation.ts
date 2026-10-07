import { router } from '@inertiajs/react';
import type { RequestPayload } from '@inertiajs/core';
import { toast } from 'sonner';

type Method = 'post' | 'put' | 'patch' | 'delete';

type Options = {
    /** Page prop to reload after the redirect back (partial reload). */
    only?: string[];
    onSuccess?: () => void;
    /** Validation errors (field → message); a toast is shown when not handled. */
    onError?: (errors: Record<string, string>) => void;
    onFinish?: () => void;
};

/**
 * Inertia mutation of the Otomasi screens: the controller answers with a
 * redirect back + flash toast (useFlashToast shows it), the page prop is
 * reloaded, scroll and local state are kept. Validation errors go to
 * `onError`; without a handler the first one becomes an error toast.
 */
export function mutate(
    method: Method,
    url: string,
    data: RequestPayload = {},
    options: Options = {},
): void {
    const visit = {
        preserveScroll: true,
        preserveState: true,
        only: options.only,
        onSuccess: () => options.onSuccess?.(),
        onError: (errors: Record<string, string>) => {
            if (options.onError) {
                options.onError(errors);

                return;
            }

            toast.error(
                Object.values(errors)[0] ??
                    'Gagal menyimpan. Coba lagi sebentar.',
            );
        },
        onFinish: () => options.onFinish?.(),
    };

    if (method === 'delete') {
        router.delete(url, visit);
    } else {
        router[method](url, data, visit);
    }
}
