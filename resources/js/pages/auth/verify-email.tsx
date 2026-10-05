// Components
import { Form, Head, Link } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { AuthStatus, authLinkClass } from '@/features/auth/parts';
import { logout } from '@/routes';
import { send } from '@/routes/verification';

export default function VerifyEmail({ status }: { status?: string }) {
    return (
        <>
            <Head title="Verifikasi email" />

            {status === 'verification-link-sent' && (
                <AuthStatus>
                    Tautan verifikasi baru telah dikirim ke alamat email yang
                    terdaftar di akun Anda.
                </AuthStatus>
            )}

            <Form {...send.form()} className="flex flex-col items-center gap-4">
                {({ processing }) => (
                    <>
                        <Button
                            size="lg"
                            className="w-full"
                            disabled={processing}
                        >
                            {processing && <Spinner />}
                            Kirim ulang email verifikasi
                        </Button>

                        <Link
                            href={logout()}
                            as="button"
                            className={authLinkClass}
                        >
                            Keluar
                        </Link>
                    </>
                )}
            </Form>
        </>
    );
}

VerifyEmail.layout = {
    title: 'Verifikasi email',
    description:
        'Verifikasi alamat email Anda dengan mengeklik tautan yang baru saja kami kirim ke email Anda.',
};
