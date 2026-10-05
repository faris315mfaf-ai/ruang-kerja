import { Link, router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { policy } from '@/routes/attendance';
import consentRoutes from '@/routes/attendance/consent';
import type { AttendanceConsentState } from '@/types/attendance';

/** Consent status with the policy link and "Cabut persetujuan" (UU PDP). */
export function ConsentFooter({
    consent,
}: {
    consent: AttendanceConsentState;
}) {
    const [confirming, setConfirming] = useState(false);
    const [processing, setProcessing] = useState(false);

    return (
        <p className="text-center text-[13px] leading-6 text-text-muted">
            {consent.granted
                ? `Persetujuan data lokasi & selfie: diberikan (versi ${consent.version}).`
                : 'Persetujuan data lokasi & selfie diminta saat check-in pertama.'}{' '}
            <Link
                href={policy()}
                className="font-medium text-primary hover:underline"
            >
                Baca kebijakan
            </Link>
            {consent.granted && (
                <>
                    {' · '}
                    <button
                        type="button"
                        onClick={() => setConfirming(true)}
                        className="font-medium text-danger hover:underline"
                    >
                        Cabut persetujuan
                    </button>
                    <Dialog open={confirming} onOpenChange={setConfirming}>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Cabut persetujuan?</DialogTitle>
                                <DialogDescription>
                                    Anda tidak bisa check-in atau check-out
                                    dengan GPS + selfie sampai menyetujui lagi.
                                    HR akan diberi tahu untuk mengatur cara
                                    absensi lain. Data absensi yang sudah
                                    tercatat tetap disimpan sesuai kebijakan.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setConfirming(false)}
                                >
                                    Batal
                                </Button>
                                <Button
                                    variant="destructive"
                                    disabled={processing}
                                    onClick={() => {
                                        setProcessing(true);
                                        router.delete(consentRoutes.destroy(), {
                                            preserveScroll: true,
                                            onFinish: () => {
                                                setProcessing(false);
                                                setConfirming(false);
                                            },
                                        });
                                    }}
                                >
                                    Cabut persetujuan
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </>
            )}
        </p>
    );
}
