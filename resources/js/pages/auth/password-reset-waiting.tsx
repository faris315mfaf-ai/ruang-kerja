import { Head, Link, router } from '@inertiajs/react';
import { CircleAlert, Clock3, Hourglass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { authLinkClass } from '@/features/auth/parts';
import type { PasswordResetStatus } from '@/features/auth/use-password-reset-status';
import { usePasswordResetStatus } from '@/features/auth/use-password-reset-status';
import { formatDateTime, formatTime } from '@/lib/format';
import { login } from '@/routes';
import { create, edit, status as statusRoute } from '@/routes/password-reset';

type Props = {
    /** Address typed in the form (not a confirmation that it exists). */
    email: string;
    status: Exclude<PasswordResetStatus, 'approved'>;
    /** HR's reason when rejected. */
    reason: string | null;
    requestedAt: string;
    expiresAt: string;
};

/**
 * Waiting page of "Lupa kata sandi". Polls the status every 5 seconds while
 * visible; HR's approval moves on to the new-password form automatically.
 * The text is identical whether or not the address belongs to someone.
 */
export default function PasswordResetWaiting({
    email,
    status: initial,
    reason,
    requestedAt,
    expiresAt,
}: Props) {
    const status = usePasswordResetStatus({
        initial,
        url: statusRoute.url(),
        onApproved: () => router.visit(edit()),
        onFinal: () => router.reload(),
    });

    return (
        <>
            <Head title="Menunggu persetujuan HR" />

            {status === 'pending' && (
                <div className="flex flex-col gap-5" aria-live="polite">
                    <div className="flex items-start gap-3 rounded-lg bg-info-soft px-4 py-4 text-info">
                        <Hourglass
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0 motion-safe:animate-pulse"
                        />
                        <div className="flex flex-col gap-1">
                            <p className="text-body font-bold">
                                Menunggu persetujuan HR
                            </p>
                            <p className="text-label font-normal text-text">
                                Permintaan untuk{' '}
                                <span className="font-semibold break-all">
                                    {email}
                                </span>{' '}
                                sudah kami terima bila email tersebut terdaftar
                                sebagai karyawan aktif.
                            </p>
                        </div>
                    </div>

                    <ol className="flex list-decimal flex-col gap-2 pl-5 text-label font-normal text-text-muted">
                        <li>
                            Hubungi HR agar permintaan Anda segera ditinjau.
                        </li>
                        <li>
                            Biarkan halaman ini terbuka. Setelah disetujui, Anda
                            otomatis diarahkan untuk membuat kata sandi baru.
                        </li>
                        <li>
                            Permintaan berlaku sampai{' '}
                            <time
                                dateTime={expiresAt}
                                className="font-semibold text-text"
                            >
                                {formatDateTime(expiresAt)}
                            </time>
                            .
                        </li>
                    </ol>

                    <p className="flex items-center gap-2 text-meta text-text-muted">
                        <Spinner className="size-4" />
                        Diperiksa otomatis · diajukan {formatTime(requestedAt)}
                    </p>
                </div>
            )}

            {status === 'approved' && (
                <p
                    className="flex items-center gap-2 text-body"
                    aria-live="polite"
                >
                    <Spinner />
                    Disetujui HR. Membuka pembuatan kata sandi baru…
                </p>
            )}

            {status === 'rejected' && (
                <div className="flex flex-col gap-5">
                    <div
                        role="alert"
                        className="flex gap-3 rounded-lg bg-danger-soft px-4 py-4 text-danger"
                    >
                        <CircleAlert
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0"
                        />
                        <div className="flex flex-col gap-1">
                            <p className="text-body font-bold">
                                Permintaan ditolak HR
                            </p>
                            {reason && (
                                <p className="text-label font-normal text-text">
                                    Alasan: “{reason}”
                                </p>
                            )}
                        </div>
                    </div>
                    <Button asChild size="lg" className="w-full">
                        <Link href={create()}>Ajukan lagi</Link>
                    </Button>
                </div>
            )}

            {status === 'expired' && (
                <div className="flex flex-col gap-5">
                    <div
                        role="alert"
                        className="flex gap-3 rounded-lg bg-warning-soft px-4 py-4 text-warning"
                    >
                        <Clock3
                            aria-hidden
                            className="mt-0.5 size-5 shrink-0"
                        />
                        <div className="flex flex-col gap-1">
                            <p className="text-body font-bold">
                                Permintaan kedaluwarsa
                            </p>
                            <p className="text-label font-normal text-text">
                                Permintaan tidak diputus dalam 24 jam, atau kata
                                sandi baru tidak dibuat dalam 30 menit setelah
                                disetujui. Ajukan permintaan baru.
                            </p>
                        </div>
                    </div>
                    <Button asChild size="lg" className="w-full">
                        <Link href={create()}>Ajukan lagi</Link>
                    </Button>
                </div>
            )}

            <p className="text-center text-label font-normal text-text-muted">
                <Link href={login()} className={authLinkClass}>
                    Kembali ke halaman masuk
                </Link>
            </p>
        </>
    );
}

PasswordResetWaiting.layout = {
    title: 'Lupa kata sandi',
    description: 'Permintaan reset kata sandi Anda sedang ditinjau HR.',
};
