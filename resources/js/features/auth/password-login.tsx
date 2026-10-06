import { Form, Link } from '@inertiajs/react';
import { LogIn } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { authLinkClass } from './parts';
import { store } from '@/routes/login';
import { create as forgotPassword } from '@/routes/password-reset';

/**
 * Primary sign-in (owner decision 6 Oct 2026): every employee uses their work
 * email + password; Super Admins then enter their TOTP code. Errors are always
 * generic (AuthenticateEmployee) and shown under the email field.
 */
export function PasswordLogin({ className }: { className?: string }) {
    return (
        <Form
            {...store.form()}
            resetOnSuccess={['password']}
            resetOnError={['password']}
            className={cn('flex flex-col gap-5', className)}
        >
            {({ processing, errors }) => (
                <>
                    <div className="flex flex-col gap-2">
                        <Label htmlFor="email">Email kantor</Label>
                        <Input
                            id="email"
                            type="email"
                            name="email"
                            required
                            autoFocus
                            autoComplete="username"
                            inputMode="email"
                            placeholder="nama@perusahaan.co.id"
                            aria-invalid={errors.email ? true : undefined}
                            aria-describedby={
                                errors.email ? 'login-email-error' : undefined
                            }
                        />
                        <InputError
                            id="login-email-error"
                            message={errors.email}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center">
                            <Label htmlFor="password">Kata sandi</Label>
                            <Link
                                href={forgotPassword()}
                                className={cn(authLinkClass, '-my-2 ml-auto')}
                                data-test="forgot-password-link"
                            >
                                Lupa kata sandi?
                            </Link>
                        </div>
                        <PasswordInput
                            id="password"
                            name="password"
                            required
                            autoComplete="current-password"
                            placeholder="Kata sandi"
                            aria-invalid={errors.password ? true : undefined}
                        />
                        <InputError message={errors.password} />
                    </div>

                    <label className="flex min-h-control items-center gap-3 text-label font-normal text-text">
                        <Checkbox name="remember" value="on" />
                        Ingat saya di perangkat ini
                    </label>

                    <Button
                        type="submit"
                        size="xl"
                        className="w-full gap-3"
                        disabled={processing}
                        data-test="login-button"
                    >
                        {processing ? (
                            <Spinner />
                        ) : (
                            <LogIn className="size-[22px]" aria-hidden />
                        )}
                        Masuk
                    </Button>
                </>
            )}
        </Form>
    );
}
