import { Link } from '@inertiajs/react';
import { BrandMark } from '@/components/shell/brand-mark';
import { authLinkClass } from '@/features/auth/parts';
import { focusRing, cn } from '@/lib/utils';
import { home } from '@/routes';
import { policy as privacy } from '@/routes/privacy';
import type { AuthLayoutProps } from '@/types';

/**
 * Card layout of the secondary auth screens (forgot/reset password, TOTP
 * challenge, confirm password, verify email): the DLogin sign-in column as a
 * card on the page background with the two corner glows.
 */
export default function AuthSimpleLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="flex min-h-svh flex-col items-center bg-page px-4 py-10 text-text md:justify-center md:px-10 md:py-14">
            <div className="flex w-full max-w-[440px] flex-col gap-6">
                <Link
                    href={home()}
                    aria-label="Beranda"
                    className={cn('self-start rounded-control', focusRing)}
                >
                    <BrandMark withName />
                </Link>

                <main className="flex flex-col gap-7 rounded-panel border border-border bg-surface p-6 shadow-card md:p-8">
                    <div className="flex flex-col gap-2.5">
                        <h1 className="text-h2">{title}</h1>
                        {description && (
                            <p className="text-body text-text-muted">
                                {description}
                            </p>
                        )}
                    </div>
                    {children}
                </main>

                <Link
                    href={privacy()}
                    className={cn(authLinkClass, 'self-center')}
                >
                    Kebijakan privasi
                </Link>
            </div>
        </div>
    );
}
