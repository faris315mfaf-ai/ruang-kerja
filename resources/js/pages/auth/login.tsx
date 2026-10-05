import { Head, Link, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DemoLoginSection } from '@/features/auth/demo-login';
import {
    GoogleSignInButton,
    LoginErrorCard,
} from '@/features/auth/google-sign-in';
import { LoginBrandPanel } from '@/features/auth/login-brand-panel';
import {
    LoginMobileHero,
    MOBILE_LOGIN_BACKGROUND,
} from '@/features/auth/login-mobile-hero';
import {
    loginLinkClass,
    SuperAdminLogin,
} from '@/features/auth/super-admin-login';
import type { DemoAccount, GoogleLoginState } from '@/features/auth/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { policy as privacy } from '@/routes/privacy';

type Props = {
    status?: string;
    canResetPassword: boolean;
    google: GoogleLoginState;
    /** Name of the company (companies.name); null before seeding. */
    companyName: string | null;
    /** Only filled when APP_ENV=local and DEMO_LOGIN_ENABLED=true. */
    demoAccounts?: DemoAccount[];
};

/**
 * Login (designs DLogin / DLoginMalam desktop & tablet, MLogin phone).
 * Rendered without the shared auth layout (see app.tsx): desktop is a
 * gradient brand panel + the sign-in column, the phone a night aurora with
 * the actions in the thumb zone. Biometric sign-in (MLogin) is Phase 3, so
 * the phone gets the same Google + demo actions.
 */
export default function Login({
    status,
    canResetPassword,
    google,
    companyName,
    demoAccounts = [],
}: Props) {
    const { errors, branding } = usePage().props;
    const company = companyName ?? branding.companyName ?? 'perusahaan';
    const phone = useBreakpoint() === 'mobile';

    // <Form> submissions preserve state, so the emergency form stays open after
    // a failed attempt and shows Fortify's `email` errors in place.
    const [superAdminOpen, setSuperAdminOpen] = useState(false);

    const googleError = errors.google;
    // `email` errors on a fresh page load come from EnsureActiveEmployee (signed
    // out because the account was deactivated): show them in the error card.
    const generalError =
        googleError ?? (superAdminOpen ? undefined : errors.email);

    const actions = (
        <>
            <GoogleSignInButton google={google} />

            {generalError && (
                <LoginErrorCard
                    message={generalError}
                    email={googleError ? google.rejectedEmail : null}
                />
            )}

            {status && (
                <p
                    role="status"
                    className="rounded-lg bg-success-soft px-4 py-3.5 text-label text-success"
                >
                    {status}
                </p>
            )}

            {demoAccounts.length > 0 && (
                <>
                    <div
                        aria-hidden
                        className="flex items-center gap-3.5 text-label font-normal text-text-muted"
                    >
                        <span className="h-px flex-1 bg-border" />
                        atau
                        <span className="h-px flex-1 bg-border" />
                    </div>
                    <DemoLoginSection accounts={demoAccounts} />
                </>
            )}

            <SuperAdminLogin
                open={superAdminOpen}
                onOpenChange={setSuperAdminOpen}
                canResetPassword={canResetPassword}
                aside={
                    <Link href={privacy()} className={loginLinkClass}>
                        Kebijakan privasi
                    </Link>
                }
            />
        </>
    );

    if (phone) {
        return (
            <>
                <Head title="Masuk" />
                {/* MLogin is a night screen in both themes. */}
                <div
                    className="dark flex min-h-svh flex-col bg-background text-text [color-scheme:dark]"
                    style={{ backgroundImage: MOBILE_LOGIN_BACKGROUND }}
                >
                    <LoginMobileHero companyName={company} />
                    <main
                        aria-labelledby="login-title"
                        className="mt-auto flex flex-col gap-4 px-6 pt-10 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
                    >
                        <h1 id="login-title" className="sr-only">
                            Masuk ke {branding.name}
                        </h1>
                        {actions}
                    </main>
                </div>
            </>
        );
    }

    return (
        <>
            <Head title="Masuk" />

            <div className="flex min-h-svh flex-col bg-background text-text lg:grid lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)]">
                <LoginBrandPanel companyName={company} />

                <main className="flex flex-1 items-center justify-center px-10 py-14">
                    <section
                        aria-labelledby="login-title"
                        className="flex w-full max-w-[440px] flex-col gap-7"
                    >
                        <div className="flex flex-col gap-2.5">
                            <h1 id="login-title" className="text-h1">
                                Masuk
                            </h1>
                            <p className="text-[17px] leading-[26px] text-text-muted">
                                Gunakan akun Google kantor
                                {google.domain ? (
                                    <>
                                        {' '}
                                        dengan domain{' '}
                                        <span className="font-semibold text-text">
                                            @{google.domain}
                                        </span>
                                    </>
                                ) : (
                                    ' Anda'
                                )}
                                .
                            </p>
                        </div>
                        {actions}
                    </section>
                </main>
            </div>
        </>
    );
}
