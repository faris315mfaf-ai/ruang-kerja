import { Copy, KeyRound, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { requestJson } from '@/lib/http';
import { appsScript } from './apps-script';
import { hiringUrls } from './lib';
import { errorMessage } from './use-autosave';

async function copy(text: string, what: string): Promise<void> {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${what} disalin.`);
    } catch {
        toast.error('Gagal menyalin. Pilih teksnya lalu salin manual.');
    }
}

/**
 * Google Form connection of a position: webhook URL, "Buat ulang tautan &
 * secret" (the secret is shown once, then only stored encrypted) and the
 * ready-to-paste Apps Script with both values filled in.
 */
export function WebhookPanel({
    positionId,
    initialUrl,
}: {
    positionId: string;
    initialUrl: string;
}) {
    const [url, setUrl] = useState(initialUrl);
    const [secret, setSecret] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);

    const regenerate = () => {
        setBusy(true);
        requestJson<{ url: string; secret: string }>(
            hiringUrls.webhook(positionId),
            { method: 'POST' },
        )
            .then((result) => {
                setUrl(result.url);
                setSecret(result.secret);
                setConfirming(false);
            })
            .catch((error: unknown) => toast.error(errorMessage(error)))
            .finally(() => setBusy(false));
    };

    return (
        <div className="flex flex-col gap-4">
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[15px] text-text-muted">
                <li>
                    Klik <b className="text-text">Buat tautan &amp; secret</b>{' '}
                    di bawah, lalu salin skripnya.
                </li>
                <li>
                    Di Google Form: titik tiga ›{' '}
                    <b className="text-text">Apps Script</b>, tempel skrip,
                    simpan.
                </li>
                <li>
                    Pilih fungsi{' '}
                    <code className="font-mono text-[14px]">pasangPemicu</code>,
                    klik Jalankan, izinkan akses.
                </li>
                <li>Kirim satu jawaban uji; kandidat muncul di tahap Masuk.</li>
            </ol>
            <div className="flex flex-col gap-1.5">
                <Label htmlFor="webhook-url">Tautan webhook</Label>
                <div className="flex gap-2">
                    <Input
                        id="webhook-url"
                        value={url}
                        readOnly
                        className="font-mono text-[14px]"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Salin tautan webhook"
                        onClick={() => void copy(url, 'Tautan')}
                    >
                        <Copy aria-hidden />
                    </Button>
                </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2/60 px-4 py-3">
                <p className="flex items-center gap-2 text-[15px] text-text">
                    <KeyRound aria-hidden className="size-4 text-text-muted" />
                    {secret
                        ? 'Secret baru siap disalin (hanya tampil sekali).'
                        : 'Secret tersimpan terenkripsi dan tidak bisa dilihat lagi.'}
                </p>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirming(true)}
                >
                    <RefreshCw aria-hidden />
                    Buat tautan &amp; secret
                </Button>
            </div>
            {secret && (
                <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor="webhook-secret">Secret</Label>
                        <div className="flex gap-2">
                            <Input
                                id="webhook-secret"
                                value={secret}
                                readOnly
                                className="font-mono text-[14px]"
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                aria-label="Salin secret"
                                onClick={() => void copy(secret, 'Secret')}
                            >
                                <Copy aria-hidden />
                            </Button>
                        </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-3">
                            <Label htmlFor="webhook-script">
                                Skrip Apps Script
                            </Label>
                            <Button
                                type="button"
                                variant="tonal"
                                size="sm"
                                onClick={() =>
                                    void copy(appsScript(url, secret), 'Skrip')
                                }
                            >
                                <Copy aria-hidden />
                                Salin skrip
                            </Button>
                        </div>
                        <textarea
                            id="webhook-script"
                            readOnly
                            value={appsScript(url, secret)}
                            className="h-64 w-full resize-y rounded-control border border-border-strong bg-surface p-3 font-mono text-[13px] leading-5 text-text"
                        />
                    </div>
                </div>
            )}
            <Dialog open={confirming} onOpenChange={setConfirming}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            Buat tautan &amp; secret baru?
                        </DialogTitle>
                        <DialogDescription>
                            Tautan dan secret lama langsung tidak berlaku. Skrip
                            di Google Form harus diperbarui dengan nilai baru.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="quiet"
                            onClick={() => setConfirming(false)}
                        >
                            Batal
                        </Button>
                        <Button
                            type="button"
                            disabled={busy}
                            onClick={regenerate}
                        >
                            Buat baru
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
