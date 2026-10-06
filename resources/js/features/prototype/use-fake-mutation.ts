import { useCallback, useState } from 'react';
import { toast } from 'sonner';

type Options = {
    /** Toast after success (Indonesian). */
    success?: string;
    /** Simulated latency in ms (default 600). */
    delay?: number;
    /** Make the call fail, to preview error states. */
    fail?: boolean;
    /** Toast after a simulated failure. */
    error?: string;
};

/**
 * Stand-in for a server mutation on preview pages: waits, then runs `apply`
 * (local state update) and shows a toast. `processing` drives button
 * spinners like Inertia's `useForm().processing` does on real pages.
 */
export function useFakeMutation() {
    const [processing, setProcessing] = useState(false);

    const run = useCallback(
        async (apply: () => void, options: Options = {}): Promise<boolean> => {
            setProcessing(true);

            await new Promise((resolve) =>
                setTimeout(resolve, options.delay ?? 600),
            );
            setProcessing(false);

            if (options.fail) {
                toast.error(
                    options.error ?? 'Gagal menyimpan. Coba lagi sebentar.',
                );

                return false;
            }

            apply();

            if (options.success) {
                toast.success(options.success);
            }

            return true;
        },
        [],
    );

    return { processing, run };
}
