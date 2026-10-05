import { Head, usePage } from '@inertiajs/react';
import { MonitorSmartphone } from 'lucide-react';

/** /kiosk on a device that is not (or no longer) registered as a kiosk. */
export default function KioskUnpaired() {
    const { branding } = usePage().props;

    return (
        <div className="dark flex min-h-dvh items-center justify-center bg-background p-6 text-text">
            <Head title="Kiosk belum terdaftar" />
            <div className="max-w-md space-y-4 text-center">
                <span
                    aria-hidden
                    className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-surface-2 text-text-muted"
                >
                    <MonitorSmartphone className="size-7" strokeWidth={1.75} />
                </span>
                <h1 className="text-2xl font-semibold">
                    Perangkat ini belum terdaftar sebagai kiosk
                </h1>
                <p className="text-base text-text-muted">
                    Minta HR membuat tautan aktivasi di {branding.name} › Admin
                    › Lokasi &amp; shift › Kiosk QR, lalu buka tautan itu di
                    perangkat ini. Bila kiosk dinonaktifkan atau dipasang di
                    perangkat lain, layar ini juga muncul.
                </p>
            </div>
        </div>
    );
}
