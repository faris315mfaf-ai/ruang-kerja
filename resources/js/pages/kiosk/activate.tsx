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
            <div className="flex w-full max-w-md flex-col gap-5 rounded-panel border border-border bg-surface p-7 shadow-card">
                {kiosk === null ? (
                    <div className="flex flex-col items-center gap-3 text-center">
                        <span
                            aria-hidden
                            className="flex size-16 items-center justify-center rounded-xl bg-warning-soft text-warning"
                        >
                            <AlertCircle className="size-[30px]" />
                        </span>
                        <h1 className="text-h3">
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
                        <div className="flex items-start gap-4">
                            <span
                                aria-hidden
                                className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-grad-soft text-link"
                            >
                                <MonitorCheck
                                    className="size-7"
                                    strokeWidth={1.9}
                                />
                            </span>
                            <div>
                                <h1 className="text-h3">
                                    Jadikan perangkat ini kiosk?
                                </h1>
                                <p className="mt-1 text-[15px] text-text-muted">
                                    {kiosk.locationName} · {kiosk.name}{' '}
                                    <span className="font-mono font-semibold">
                                        ({kiosk.code})
                                    </span>
                                </p>
                            </div>
                        </div>
                        <ul className="list-disc space-y-1.5 pl-5 text-[15px] leading-[22px] text-text-muted">
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
                            size="lg"
                            className="w-full"
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
