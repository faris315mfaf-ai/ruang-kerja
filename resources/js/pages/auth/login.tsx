import { Head, Link, usePage } from '@inertiajs/react';
import { DemoLoginSection } from '@/features/auth/demo-login';
import { LoginErrorCard } from '@/features/auth/google-sign-in';
import { LoginBrandPanel } from '@/features/auth/login-brand-panel';
import {
    LoginMobileHero,
    MOBILE_LOGIN_BACKGROUND,
} from '@/features/auth/login-mobile-hero';
import { AuthStatus, authLinkClass } from '@/features/auth/parts';
import { PasswordLogin } from '@/features/auth/password-login';
import type { DemoAccount } from '@/features/auth/types';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { cn } from '@/lib/utils';
import { policy as privacy } from '@/routes/privacy';

type Props = {
    status?: string;
    /** Name of the company (companies.name); null before seeding. */
    companyName: string | null;
    /** Only filled when APP_ENV=local and DEMO_LOGIN_ENABLED=true. */
    demoAccounts?: DemoAccount[];
};

/**
 * Login (designs DLogin / DLoginMalam desktop & tablet, MLogin phone).
 * Rendered without the shared auth layout (see app.tsx): desktop is a
 * gradient brand panel + the sign-in column, the phone a night aurora with
 * the form in the thumb zone.
 *
 * Owner decision 6 Oct 2026: every employee signs in with email + password
 * ("Lupa kata sandi" goes through HR). Google sign-in is on hold — its button
 * (features/auth/google-sign-in.tsx) and routes stay in the code, unused here.
 */
export default function Login({
    status,
    companyName,
    demoAccounts = [],
}: Props) {
    const { errors, branding } = usePage().props;
    const company = companyName ?? branding.companyName ?? 'perusahaan';
    const phone = useBreakpoint() === 'mobile';

    const actions = (
        <>
            {status && <AuthStatus>{status}</AuthStatus>}

            {errors.google && (
                <LoginErrorCard message={errors.google} email={null} />
            )}

            <PasswordLogin />

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

            <Link href={privacy()} className={cn(authLinkClass, 'self-center')}>
                Kebijakan privasi
            </Link>
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
                                Gunakan email kantor dan kata sandi Anda. Belum
                                punya kata sandi? Pilih{' '}
                                <span className="font-semibold text-text">
                                    Lupa kata sandi
                                </span>{' '}
                                atau hubungi HR.
                            </p>
                        </div>
                        {actions}
                    </section>
                </main>
            </div>
        </>
    );
}
