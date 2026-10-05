import { CircleAlert, LogIn } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { redirect as googleRedirect } from '@/routes/auth/google';
import type { GoogleLoginState } from './types';

/**
 * Primary "Masuk dengan Google" button (DLogin: 56px gradient aksi). A full
 * page navigation (not an Inertia visit) because the server redirects to
 * accounts.google.com.
 */
export function GoogleSignInButton({ google }: { google: GoogleLoginState }) {
    const [redirecting, setRedirecting] = useState(false);

    if (!google.enabled) {
        return (
            <div className="flex flex-col gap-2">
                <Button
                    type="button"
                    size="xl"
                    disabled
                    className="w-full"
                    data-test="google-login-button"
                >
                    <LogIn className="size-[22px]" aria-hidden />
                    Masuk dengan Google
                </Button>
                <p
                    className="text-center text-label font-normal text-text-muted"
                    data-test="google-login-disabled"
                >
                    Login Google belum dikonfigurasi. Hubungi Super Admin.
                </p>
            </div>
        );
    }

    return (
        <Button asChild size="xl" className="w-full gap-3">
            <a
                href={googleRedirect().url}
                onClick={() => setRedirecting(true)}
                aria-busy={redirecting}
                data-test="google-login-button"
            >
                {redirecting ? (
                    <Spinner />
                ) : (
                    <LogIn className="size-[22px]" aria-hidden />
                )}
                Masuk dengan Google
            </a>
        </Button>
    );
}

/** Refused sign-in (wrong domain, not registered, inactive...). */
export function LoginErrorCard({
    message,
    email,
}: {
    message: string;
    email: string | null;
}) {
    return (
        <div
            role="alert"
            className="flex gap-3 rounded-lg bg-danger-soft px-4 py-3.5 text-label font-normal text-danger"
            data-test="login-error"
        >
            <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
            <p>
                {email && (
                    <>
                        Akun <strong className="font-bold">{email}</strong>{' '}
                        tidak bisa masuk.{' '}
                    </>
                )}
                {message}
            </p>
        </div>
    );
}
