import { Form, Head, Link } from '@inertiajs/react';
import { ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { authLinkClass } from '@/features/auth/parts';
import { login } from '@/routes';
import { store } from '@/routes/password-reset';

type Props = {
    /** Address of this browser's previous request, to try again quickly. */
    email: string | null;
};

/**
 * "Lupa kata sandi" (owner decision 6 Oct 2026): no email link — HR approves
 * the request and the waiting page continues on its own to the new password.
 */
export default function ForgotPassword({ email }: Props) {
    return (
        <>
            <Head title="Lupa kata sandi" />

            <div className="flex flex-col gap-5">
                <div className="flex gap-3 rounded-lg bg-info-soft px-4 py-3.5 text-label font-normal text-text">
                    <ShieldCheck
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 text-info"
                    />
                    <p>
                        Permintaan Anda ditinjau HR. Biarkan halaman berikutnya
                        tetap terbuka: setelah disetujui, Anda langsung
                        diarahkan untuk membuat kata sandi baru.
                    </p>
                </div>

                <Form {...store.form()} className="flex flex-col gap-6">
                    {({ processing, errors }) => (
                        <>
                            <div className="flex flex-col gap-2">
                                <Label htmlFor="email">Email kantor</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoComplete="username"
                                    inputMode="email"
                                    autoFocus
                                    defaultValue={email ?? undefined}
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
                                data-test="password-reset-request-button"
                            >
                                {processing && <Spinner />}
                                Minta reset ke HR
                            </Button>
                        </>
                    )}
                </Form>

                <p className="text-center text-label font-normal text-text-muted">
                    Ingat kata sandi Anda?{' '}
                    <Link href={login()} className={authLinkClass}>
                        Kembali ke halaman masuk
                    </Link>
                </p>
            </div>
        </>
    );
}

ForgotPassword.layout = {
    title: 'Lupa kata sandi',
    description:
        'Masukkan email kantor Anda. HR akan memeriksa dan menyetujui permintaan reset kata sandi.',
};
