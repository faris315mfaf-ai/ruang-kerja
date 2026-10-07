import { Form, Head } from '@inertiajs/react';
import { CircleCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { formatTime } from '@/lib/format';
import { update } from '@/routes/password-reset';

type Props = {
    email: string;
    name: string | null;
    /** End of the 30-minute window after HR's approval. */
    expiresAt: string | null;
    /** Browser `passwordrules`: Super Admins only (employees: free choice). */
    passwordRules: string | null;
    /** Server-side rule summary for this account. */
    passwordHint: string;
};

/**
 * "Lupa kata sandi" › Sandi baru: only reachable by the browser whose request
 * HR approved (single-use setup token in its session, 30 minutes). Saving
 * signs out every other device and signs this one in.
 */
export default function PasswordResetNew({
    email,
    name,
    expiresAt,
    passwordRules,
    passwordHint,
}: Props) {
    return (
        <>
            <Head title="Buat kata sandi baru" />

            <div className="flex gap-3 rounded-lg bg-success-soft px-4 py-3.5 text-success">
                <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
                <p className="text-label font-normal text-text">
                    <span className="font-bold text-success">
                        Disetujui HR.
                    </span>{' '}
                    Buat kata sandi baru untuk{' '}
                    <span className="font-semibold break-all">
                        {name ? `${name} (${email})` : email}
                    </span>
                    {expiresAt && (
                        <>
                            {' '}
                            sebelum pukul{' '}
                            <time
                                dateTime={expiresAt}
                                className="font-semibold"
                            >
                                {formatTime(expiresAt)}
                            </time>
                        </>
                    )}
                    .
                </p>
            </div>

            <Form
                {...update.form()}
                resetOnError={['password', 'password_confirmation']}
                className="flex flex-col gap-5"
            >
                {({ processing, errors }) => (
                    <>
                        {/* Lets password managers save the new password for this account. */}
                        <input
                            type="hidden"
                            name="username"
                            autoComplete="username"
                            value={email}
                            readOnly
                        />

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password">Kata sandi baru</Label>
                            <PasswordInput
                                id="password"
                                name="password"
                                required
                                autoFocus
                                autoComplete="new-password"
                                placeholder={
                                    passwordRules
                                        ? 'Minimal 8 karakter'
                                        : undefined
                                }
                                passwordrules={passwordRules ?? undefined}
                                aria-invalid={
                                    errors.password ? true : undefined
                                }
                            />
                            <InputError message={errors.password} />
                        </div>

                        <div className="flex flex-col gap-2">
                            <Label htmlFor="password_confirmation">
                                Ulangi kata sandi baru
                            </Label>
                            <PasswordInput
                                id="password_confirmation"
                                name="password_confirmation"
                                required
                                autoComplete="new-password"
                                placeholder="Ulangi kata sandi baru"
                                passwordrules={passwordRules ?? undefined}
                            />
                            <InputError
                                message={errors.password_confirmation}
                            />
                        </div>

                        <p className="text-meta text-text-muted">
                            {passwordHint} Semua perangkat lain akan
                            dikeluarkan.
                        </p>

                        <Button
                            type="submit"
                            size="lg"
                            className="w-full"
                            disabled={processing}
                            data-test="password-reset-save-button"
                        >
                            {processing && <Spinner />}
                            Simpan dan masuk
                        </Button>
                    </>
                )}
            </Form>
        </>
    );
}

PasswordResetNew.layout = {
    title: 'Buat kata sandi baru',
    description: 'Kata sandi ini menggantikan kata sandi lama Anda.',
};
