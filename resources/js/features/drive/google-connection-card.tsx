import { router } from '@inertiajs/react';
import { CircleCheck, CloudOff, TriangleAlert, Unplug } from 'lucide-react';
import { useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { connect, disconnect } from '@/routes/google';
import { connectUrl } from './drive-files';
import type { GoogleSettingsData } from './types';

type Props = {
    google: GoogleSettingsData;
    /** Where Google sends the user back after connecting. */
    returnPath?: string;
};

/**
 * Connection status of the user's Google account (Settings › Akun Google).
 */
export function GoogleConnectionCard({
    google,
    returnPath = '/settings/google',
}: Props) {
    const [disconnecting, setDisconnecting] = useState(false);
    const account = google.account;
    const href = connectUrl(connect.url(), returnPath);
    const needsReconnect =
        account !== null &&
        (account.needs_reconnect || !account.has_drive_access);

    const onDisconnect = () => {
        router.delete(disconnect.url(), {
            preserveScroll: true,
            onStart: () => setDisconnecting(true),
            onFinish: () => setDisconnecting(false),
        });
    };

    return (
        <div className="flex flex-col gap-4">
            {google.fake && (
                <Badge variant="label" tone="info">
                    Mode Drive palsu (lokal)
                </Badge>
            )}

            {!google.drive_enabled && (
                <Alert>
                    <CloudOff />
                    <AlertTitle>Integrasi Google Drive belum aktif</AlertTitle>
                    <AlertDescription>
                        <p>
                            Folder, dokumen, dan unggahan ke Drive belum bisa
                            dipakai. Hubungi admin RuangKerja.
                        </p>
                        {google.missing_settings.length > 0 && (
                            <p>
                                Pengaturan yang belum diisi:{' '}
                                <span className="font-mono text-meta">
                                    {google.missing_settings.join(', ')}
                                </span>
                                . Jalankan{' '}
                                <span className="font-mono text-meta">
                                    php artisan ruangkerja:google-check
                                </span>{' '}
                                setelah mengisinya.
                            </p>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <section
                aria-labelledby="google-connection-title"
                className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-6 shadow-card md:px-7"
            >
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2
                        id="google-connection-title"
                        className="text-[20px] leading-7 font-bold md:text-[22px]"
                    >
                        Akun Google
                    </h2>
                    {account && !needsReconnect ? (
                        <Badge variant="status" tone="success" dot>
                            Terhubung
                        </Badge>
                    ) : needsReconnect ? (
                        <Badge variant="status" tone="warning" dot>
                            Perlu diperbarui
                        </Badge>
                    ) : (
                        <Badge variant="status" tone="neutral" dot>
                            Belum terhubung
                        </Badge>
                    )}
                </div>

                {account && !needsReconnect ? (
                    <>
                        <div className="flex items-start gap-3">
                            <CircleCheck
                                aria-hidden
                                className="mt-0.5 size-5 shrink-0 text-success"
                            />
                            <p className="min-w-0 text-label font-normal text-text-muted">
                                <span className="font-semibold break-all text-text">
                                    Terhubung sebagai {account.email}
                                </span>
                                <br />
                                {account.connected_at
                                    ? `Sejak ${formatDate(account.connected_at)} · `
                                    : ''}
                                Picker hanya membuka file yang Anda pilih.
                            </p>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="self-start"
                                    disabled={disconnecting}
                                >
                                    Putuskan
                                </Button>
                            </DialogTrigger>
                            <DisconnectDialog
                                email={account.email}
                                onConfirm={onDisconnect}
                            />
                        </Dialog>
                    </>
                ) : (
                    <>
                        <div className="flex items-start gap-3">
                            {needsReconnect ? (
                                <TriangleAlert
                                    aria-hidden
                                    className="mt-0.5 size-5 shrink-0 text-warning"
                                />
                            ) : (
                                <Unplug
                                    aria-hidden
                                    className="mt-0.5 size-5 shrink-0 text-text-subtle"
                                />
                            )}
                            <p className="min-w-0 text-label font-normal text-text-muted">
                                <span className="font-semibold text-text">
                                    {needsReconnect
                                        ? 'Sambungan Google perlu diperbarui'
                                        : 'Akun Google belum terhubung'}
                                </span>
                                <br />
                                {google.connect_enabled
                                    ? 'Hubungkan akun Google kantor untuk melampirkan file dari Drive.'
                                    : 'Sambungan akun Google belum diaktifkan admin.'}
                            </p>
                        </div>
                        {google.connect_enabled && (
                            <Button asChild className="self-start">
                                <a href={href}>
                                    {needsReconnect
                                        ? 'Hubungkan ulang'
                                        : 'Hubungkan akun Google'}
                                </a>
                            </Button>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}

function DisconnectDialog({
    email,
    onConfirm,
}: {
    email: string;
    onConfirm: () => void;
}) {
    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Putuskan akun Google?</DialogTitle>
                <DialogDescription>
                    Akses RuangKerja ke {email} dicabut. File yang sudah
                    dilampirkan tetap ada; untuk memilih file dari Drive lagi
                    Anda perlu menghubungkan ulang.
                </DialogDescription>
            </DialogHeader>
            <DialogFooter>
                <DialogClose asChild>
                    <Button type="button" variant="outline">
                        Batal
                    </Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={onConfirm}
                    >
                        Putuskan
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    );
}
