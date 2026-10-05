import { router } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import logRoutes from '@/routes/attendance/logs';

/** "Tandai sudah ditinjau" (HR). Reloads only the given props afterwards. */
export function ReviewButton({
    logId,
    only,
    className,
    size = 'sm',
}: {
    logId: string;
    only: string[];
    className?: string;
    size?: 'sm' | 'lg';
}) {
    const [busy, setBusy] = useState(false);

    return (
        <Button
            type="button"
            variant={size === 'lg' ? 'tonal' : 'default'}
            size={size === 'lg' ? 'lg' : 'sm'}
            disabled={busy}
            className={className}
            onClick={() =>
                router.post(
                    logRoutes.review.url(logId),
                    {},
                    {
                        preserveScroll: true,
                        preserveState: true,
                        only,
                        onStart: () => setBusy(true),
                        onFinish: () => setBusy(false),
                    },
                )
            }
        >
            {size === 'lg' && <Check aria-hidden />}
            Tandai ditinjau
        </Button>
    );
}
