import { Head, useForm } from '@inertiajs/react';
import { AlertCircle, MonitorCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import activateRoutes from '@/routes/kiosk/activate';

type Props = {
    token: string;
    kiosk: { name: string; code: string; locationName: string } | null;
};

/**
 * Single-use activation link from HR. Confirming signs this browser in as the
 * kiosk (and out of any employee account) and locks it to the kiosk page.
 */
export default function KioskActivate({ token, kiosk }: Props) {
    const form = useForm({});

    return (
        <div className="dark flex min-h-dvh items-center justify-center bg-background p-6 text-text">
            <Head title="Aktivasi kiosk" />
            <div className="w-full max-w-md space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
                {kiosk === null ? (
                    <div className="space-y-3 text-center">
                        <AlertCircle
                            className="mx-auto size-8 text-warning"
                            aria-hidden
                        />
                        <h1 className="text-xl font-semibold">
                            Tautan aktivasi tidak berlaku
                        </h1>
                        <p className="text-[15px] text-text-muted">
                            Tautan sudah dipakai, kedaluwarsa (24 jam), atau
                            kiosk-nya dinonaktifkan. Minta HR membuat tautan
                            baru.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-start gap-3">
                            <MonitorCheck
                                className="mt-0.5 size-7 shrink-0 text-primary"
                                strokeWidth={1.75}
                                aria-hidden
                            />
                            <div>
                                <h1 className="text-xl font-semibold">
                                    Jadikan perangkat ini kiosk?
                                </h1>
                                <p className="mt-1 text-[15px] text-text-muted">
                                    {kiosk.locationName} · {kiosk.name}{' '}
                                    <span className="font-mono">
                                        ({kiosk.code})
                                    </span>
                                </p>
                            </div>
                        </div>
                        <ul className="list-disc space-y-1 pl-5 text-sm text-text-muted">
                            <li>
                                Browser ini hanya akan menampilkan layar QR
                                absensi.
                            </li>
                            <li>
                                Akun karyawan yang sedang masuk di browser ini
                                akan dikeluarkan.
                            </li>
                            <li>
                                Perangkat kiosk sebelumnya untuk kiosk ini
                                berhenti berfungsi.
                            </li>
                        </ul>
                        <Button
                            type="button"
                            className="h-12 w-full text-base"
                            disabled={form.processing}
                            onClick={() =>
                                form.post(activateRoutes.store.url(token))
                            }
                        >
                            Aktifkan kiosk
                        </Button>
                    </>
                )}
            </div>
        </div>
    );
}
