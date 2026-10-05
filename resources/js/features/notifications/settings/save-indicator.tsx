import { AlertCircle, Check, Loader2 } from 'lucide-react';
import { useSaveStatus } from '@/features/notifications/settings/save-status';
import { cn } from '@/lib/utils';

/** "Tersimpan otomatis" / "Menyimpan…" / "Gagal menyimpan". */
export function SaveIndicator({ className }: { className?: string }) {
    const status = useSaveStatus();

    return (
        <p
            role="status"
            aria-live="polite"
            className={cn(
                'flex items-center gap-1.5 text-[13px]',
                status === 'error'
                    ? 'text-danger'
                    : status === 'saving'
                      ? 'text-text-muted'
                      : 'text-success',
                className,
            )}
        >
            {status === 'saving' ? (
                <>
                    <Loader2 aria-hidden className="size-4 animate-spin" />
                    Menyimpan…
                </>
            ) : status === 'error' ? (
                <>
                    <AlertCircle aria-hidden className="size-4" />
                    Gagal menyimpan
                </>
            ) : (
                <>
                    <Check aria-hidden className="size-4" />
                    Tersimpan otomatis
                </>
            )}
        </p>
    );
}
