// Components
import { Form, Head, Link } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { AuthStatus, authLinkClass } from '@/features/auth/parts';
import { login } from '@/routes';
import { email } from '@/routes/password';

export default function ForgotPassword({ status }: { status?: string }) {
    return (
        <>
            <Head title="Lupa kata sandi" />

            {status && <AuthStatus>{status}</AuthStatus>}

            <div className="flex flex-col gap-5">
                <Form {...email.form()} className="flex flex-col gap-6">
                    {({ processing, errors }) => (
                        <>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    autoComplete="off"
                                    autoFocus
                                    aria-invalid={
                                        errors.email ? true : undefined
                                    }
                                    placeholder="nama@perusahaan.co.id"
                                />

                                <InputError message={errors.email} />
                            </div>

                            <Button
                                size="lg"
                                className="w-full"
                                disabled={processing}
                                data-test="email-password-reset-link-button"
                            >
                                {processing && <Spinner />}
                                Kirim tautan atur ulang
                            </Button>
                        </>
                    )}
                </Form>

                <p className="text-center text-label font-normal text-text-muted">
                    Atau, kembali ke{' '}
                    <Link href={login()} className={authLinkClass}>
                        halaman masuk
                    </Link>
                </p>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Lupa kata sandi',
    description:
        'Masukkan email Anda untuk menerima tautan atur ulang kata sandi',
};
