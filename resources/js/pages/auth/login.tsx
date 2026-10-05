import { Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import { DemoLoginSection } from '@/features/auth/demo-login';
import {
    GoogleSignInButton,
    LoginErrorCard,
} from '@/features/auth/google-sign-in';
import { LoginBrandPanel } from '@/features/auth/login-brand-panel';
import { LoginMobileHero } from '@/features/auth/login-mobile-hero';
import { LoginPrivacyNote } from '@/features/auth/login-privacy-note';
import { SuperAdminLogin } from '@/features/auth/super-admin-login';
import type { DemoAccount, GoogleLoginState } from '@/features/auth/types';

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
 * Login (mockups `Login` desktop & `MLogin` mobile). Rendered without the
 * shared auth layout (see app.tsx): desktop is a split brand panel + card,
 * mobile a centered brand header with the actions at the bottom.
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

    // <Form> submissions preserve state, so the emergency form stays open after
    // a failed attempt and shows Fortify's `email` errors in place.
    const [superAdminOpen, setSuperAdminOpen] = useState(false);

    const googleError = errors.google;
    // `email` errors on a fresh page load come from EnsureActiveEmployee (signed
    // out because the account was deactivated): show them in the error card.
    const generalError =
        googleError ?? (superAdminOpen ? undefined : errors.email);

    return (
        <>
            <Head title="Masuk" />

            <div className="min-h-svh bg-background lg:grid lg:grid-cols-[minmax(0,53fr)_minmax(0,47fr)]">
                <LoginBrandPanel companyName={company} />

                <main className="flex min-h-svh flex-col bg-linear-to-b from-brand-50/70 via-background to-background lg:items-center lg:justify-center lg:bg-surface-2 lg:bg-none lg:px-10 lg:py-12 dark:from-brand-700/20">
                    <LoginMobileHero companyName={company} />

                    <div className="mt-auto w-full px-4 pb-8 lg:mt-0 lg:max-w-md lg:px-0 lg:pb-0">
                        <section
                            aria-labelledby="login-title"
                            className="space-y-5 lg:rounded-xl lg:border lg:border-border lg:bg-surface lg:p-8 lg:shadow-card"
                        >
                            <div className="space-y-1.5 text-center lg:text-left">
                                <h1
                                    id="login-title"
                                    className="text-xl font-semibold text-text lg:text-2xl"
                                >
                                    Masuk ke {branding.name}
                                </h1>
                                <p className="text-base text-text-muted lg:text-sm">
                                    Gunakan akun Google kantor Anda
                                    {google.domain && (
                                        <>
                                            {' ('}
                                            <span className="font-mono text-sm text-text">
                                                @{google.domain}
                                            </span>
                                            {')'}
                                        </>
                                    )}
                                    .
                                </p>
                            </div>

                            <GoogleSignInButton google={google} />

                            {generalError && (
                                <LoginErrorCard
                                    message={generalError}
                                    email={
                                        googleError
                                            ? google.rejectedEmail
                                            : null
                                    }
                                />
                            )}

                            {status && (
                                <p className="rounded-lg bg-success/10 px-4 py-3 text-sm font-medium text-success">
                                    {status}
                                </p>
                            )}

                            <div className="border-t border-border pt-4 text-center lg:text-left">
                                <SuperAdminLogin
                                    open={superAdminOpen}
                                    onOpenChange={setSuperAdminOpen}
                                    canResetPassword={canResetPassword}
                                />
                            </div>
                        </section>

                        <LoginPrivacyNote className="mt-5 hidden px-2 lg:block" />

                        {demoAccounts.length > 0 && (
                            <div className="mt-6">
                                <DemoLoginSection accounts={demoAccounts} />
                            </div>
                        )}
                    </div>

                    <footer className="border-t border-border px-4 py-5 text-center lg:hidden">
                        <LoginPrivacyNote />
                    </footer>
                </main>
            </div>
        </>
    );
}
