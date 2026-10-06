import { usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { TabNav } from '@/components/ui/tabs';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { useInitials } from '@/hooks/use-initials';
import { primaryRoleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit as editProfile } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { google as googleSettings } from '@/routes/settings';

type SettingsLink = { title: string; href: string };

/**
 * Account pages in tab order. Keamanan (own password; TOTP for Super Admins)
 * is for every employee since password sign-in (owner decision 6 Oct 2026).
 */
export function settingsLinks(_roles: readonly string[]): SettingsLink[] {
    return [
        { title: 'Profil', href: editProfile().url },
        { title: 'Notifikasi', href: '/pengaturan/notifikasi' },
        { title: 'Tampilan', href: editAppearance().url },
        { title: 'Akun Google', href: googleSettings().url },
        { title: 'Privasi & data saya', href: '/privasi' },
        { title: 'Keamanan', href: editSecurity().url },
    ];
}

const AVATAR =
    'flex size-[54px] shrink-0 items-center justify-center rounded-full border-2 border-on-brand/50 bg-on-brand/20 text-[19px] font-extrabold md:size-[84px] md:border-[3px] md:border-on-brand/60 md:text-[30px]';

/** Gradient identity card (SPengaturan hero · MSPengaturan profile card). */
function ProfileHero() {
    const { auth } = usePage().props;
    const getInitials = useInitials();
    const user = auth.user;

    if (!user) {
        return null;
    }

    const role = primaryRoleLabel(auth.roles);
    const subtitle = [user.position?.name, user.division?.name]
        .filter(Boolean)
        .join(' · ');

    return (
        <section
            aria-label="Akun saya"
            className="flex flex-wrap items-center gap-3.5 rounded-[22px] bg-grad-highlight p-4 text-on-brand shadow-glow md:gap-[22px] md:rounded-[26px] md:p-[26px]"
        >
            {user.avatar ? (
                <img
                    src={user.avatar}
                    alt=""
                    className={cn(AVATAR, 'object-cover')}
                />
            ) : (
                <span aria-hidden className={AVATAR}>
                    {getInitials(user.name)}
                </span>
            )}
            <div className="flex min-w-0 flex-1 flex-col md:gap-1">
                <p className="truncate text-[19px] leading-[26px] font-extrabold md:text-[34px] md:leading-10 md:tracking-[-0.02em]">
                    {user.name}
                </p>
                <p className="truncate text-meta font-medium md:text-[17px] md:leading-6">
                    {subtitle || role || user.email}
                </p>
            </div>
            <div className="hidden min-w-0 flex-col gap-0.5 text-right text-[16px] leading-6 md:flex">
                <span className="truncate">{user.email}</span>
                {role && <span>Peran: {role}</span>}
            </div>
        </section>
    );
}

/**
 * Shell of the account pages (design SPengaturan / MSPengaturan): profile
 * hero, then a tab row to the separate settings screens. Used as the layout
 * of `settings/*` (app.tsx) and wrapped by the Notifikasi and Privasi pages.
 */
export default function SettingsLayout({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { auth } = usePage().props;

    return (
        <div className="flex flex-col gap-5 md:gap-6">
            <ProfileHero />

            <TabNav
                label="Pengaturan akun"
                className="-mx-4 px-4 md:mx-0 md:px-0"
                items={settingsLinks(auth.roles).map((link) => ({
                    href: link.href,
                    label: link.title,
                    active: isCurrentOrParentUrl(link.href),
                }))}
            />

            <div className={cn('flex min-w-0 flex-col gap-5', className)}>
                {children}
            </div>
        </div>
    );
}
