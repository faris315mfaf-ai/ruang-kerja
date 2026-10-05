import { CircleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { redirect as googleRedirect } from '@/routes/auth/google';
import type { GoogleLoginState } from './types';

function GoogleGlyph() {
    return (
        <span
            aria-hidden
            className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-xs font-semibold text-text"
        >
            G
        </span>
    );
}

/**
 * Primary "Masuk dengan Google" button. A full page navigation (not an Inertia
 * visit) because the server redirects to accounts.google.com.
 */
export function GoogleSignInButton({ google }: { google: GoogleLoginState }) {
    const [redirecting, setRedirecting] = useState(false);

    if (!google.enabled) {
        return (
            <div className="space-y-2">
                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    disabled
                    className="h-12 w-full gap-3 text-base"
                    data-test="google-login-button"
                >
                    <GoogleGlyph />
                    Masuk dengan Google
                </Button>
                <p
                    className="text-center text-sm text-text-muted"
                    data-test="google-login-disabled"
                >
                    Login Google belum dikonfigurasi. Hubungi Super Admin.
                </p>
            </div>
        );
    }

    return (
        <Button
            asChild
            variant="outline"
            size="lg"
            className="h-12 w-full gap-3 bg-surface text-base font-medium shadow-card hover:bg-surface-2"
        >
            <a
                href={googleRedirect().url}
                onClick={() => setRedirecting(true)}
                aria-busy={redirecting}
                data-test="google-login-button"
            >
                {redirecting ? <Spinner /> : <GoogleGlyph />}
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
            className="flex gap-3 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger"
            data-test="login-error"
        >
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="leading-relaxed">
                {email && (
                    <>
                        Akun <strong className="font-semibold">{email}</strong>{' '}
                        tidak bisa masuk.{' '}
                    </>
                )}
                {message}
            </p>
        </div>
    );
}
