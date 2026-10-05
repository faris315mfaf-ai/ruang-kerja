import { AlertCircle, Eye, Loader2, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/format';
import { HttpRequestError, requestJson } from '@/lib/http';
import logRoutes from '@/routes/attendance/logs';

type Props = {
    logId: string;
    name: string;
    occurredAt: string;
    className?: string;
    size?: 'sm' | 'lg';
};

/**
 * "Lihat selfie": asks for a fresh 5-minute signed URL only when clicked; the
 * image request itself is written to the audit log by the server.
 */
export function SelfieButton({
    logId,
    name,
    occurredAt,
    className,
    size = 'sm',
}: Props) {
    const [open, setOpen] = useState(false);
    const [url, setUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const show = async () => {
        setOpen(true);
        setError(null);
        setUrl(null);
        setLoading(true);

        try {
            const data = await requestJson<{ url: string }>(
                logRoutes.selfieUrl.url(logId),
            );
            setUrl(data.url);
        } catch (failure) {
            setError(
                failure instanceof HttpRequestError && failure.status === 404
                    ? 'Selfie sudah dihapus sesuai masa retensi.'
                    : failure instanceof HttpRequestError &&
                        failure.status === 403
                      ? 'Anda tidak berhak melihat selfie ini.'
                      : 'Selfie gagal dimuat. Coba lagi.',
            );
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size={size}
                className={className}
                onClick={() => void show()}
            >
                <Eye aria-hidden />
                Lihat selfie
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Selfie · {name}</DialogTitle>
                        <DialogDescription>
                            {formatDateTime(occurredAt)}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex aspect-[3/4] items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-2">
                        {loading && (
                            <Loader2
                                className="size-6 animate-spin text-text-muted"
                                aria-label="Memuat selfie"
                            />
                        )}
                        {error && (
                            <p className="flex flex-col items-center gap-2 p-6 text-center text-[15px] text-text-muted">
                                <AlertCircle
                                    className="size-6 text-warning"
                                    aria-hidden
                                />
                                {error}
                            </p>
                        )}
                        {url && (
                            <img
                                src={url}
                                alt={`Selfie ${name}`}
                                className="size-full object-cover"
                            />
                        )}
                    </div>
                    <p className="flex items-center gap-1.5 text-meta text-text-muted">
                        <ShieldCheck className="size-3.5" aria-hidden />
                        Akses selfie tercatat di audit log.
                    </p>
                </DialogContent>
            </Dialog>
        </>
    );
}
