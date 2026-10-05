import { router } from '@inertiajs/react';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
            variant={size === 'lg' ? 'secondary' : 'outline'}
            disabled={busy}
            className={cn(
                size === 'lg'
                    ? 'h-11 bg-link-soft text-[15px] text-primary hover:bg-primary/15'
                    : 'h-8',
                className,
            )}
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
