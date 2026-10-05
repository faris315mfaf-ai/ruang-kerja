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
        <div className="space-y-4">
            {google.fake && (
                <Badge variant="outline">Mode Drive palsu (lokal)</Badge>
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
                                <span className="font-mono text-xs">
                                    {google.missing_settings.join(', ')}
                                </span>
                                . Jalankan{' '}
                                <span className="font-mono text-xs">
                                    php artisan ruangkerja:google-check
                                </span>{' '}
                                setelah mengisinya.
                            </p>
                        )}
                    </AlertDescription>
                </Alert>
            )}

            <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
                {account && !needsReconnect ? (
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        <CircleCheck
                            aria-hidden
                            className="size-5 shrink-0 text-success"
                        />
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-text">
                                Terhubung sebagai {account.email}
                            </p>
                            <p className="text-[13px] text-text-muted">
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
                                    className="h-11 md:h-9"
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
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                        {needsReconnect ? (
                            <TriangleAlert
                                aria-hidden
                                className="size-5 shrink-0 text-warning"
                            />
                        ) : (
                            <Unplug
                                aria-hidden
                                className="size-5 shrink-0 text-text-subtle"
                            />
                        )}
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-text">
                                {needsReconnect
                                    ? 'Sambungan Google perlu diperbarui'
                                    : 'Akun Google belum terhubung'}
                            </p>
                            <p className="text-[13px] text-text-muted">
                                {google.connect_enabled
                                    ? 'Hubungkan akun Google kantor untuk melampirkan file dari Drive.'
                                    : 'Sambungan akun Google belum diaktifkan admin.'}
                            </p>
                        </div>
                        {google.connect_enabled && (
                            <Button asChild className="h-11 md:h-9">
                                <a href={href}>
                                    {needsReconnect
                                        ? 'Hubungkan ulang'
                                        : 'Hubungkan akun Google'}
                                </a>
                            </Button>
                        )}
                    </div>
                )}
            </div>
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
                    <Button
                        type="button"
                        variant="outline"
                        className="h-11 md:h-9"
                    >
                        Batal
                    </Button>
                </DialogClose>
                <DialogClose asChild>
                    <Button
                        type="button"
                        variant="destructive"
                        className="h-11 md:h-9"
                        onClick={onConfirm}
                    >
                        Putuskan
                    </Button>
                </DialogClose>
            </DialogFooter>
        </DialogContent>
    );
}
