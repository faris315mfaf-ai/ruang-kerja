import { usePage } from '@inertiajs/react';
import { TabNav } from '@/components/ui/tabs';
import { useInitials } from '@/hooks/use-initials';
import { settingsLinks } from '@/layouts/settings/layout';
import { primaryRoleLabel } from '@/lib/roles';

const AVATAR =
    'flex size-[54px] shrink-0 items-center justify-center rounded-full border-2 border-on-brand/50 bg-on-brand/20 text-[19px] font-extrabold md:size-[84px] md:border-[3px] md:border-on-brand/60 md:text-[30px]';

/**
 * SPengaturan identity card + account tabs with a "WhatsApp" tab next to
 * Notifikasi. Mirrors SettingsLayout (which has no WhatsApp tab yet) so the
 * preview reads as part of Pengaturan.
 */
export function SettingsHeader() {
    const { auth } = usePage().props;
    const getInitials = useInitials();
    const user = auth.user;
    const links = settingsLinks(auth.roles);
    const notifIndex = links.findIndex(
        (l) => l.href === '/pengaturan/notifikasi',
    );
    const items = [
        ...links.slice(0, notifIndex + 1),
        { title: 'WhatsApp', href: '/pengaturan/whatsapp' },
        ...links.slice(notifIndex + 1),
    ];
    const role = primaryRoleLabel(auth.roles);
    const subtitle = user
        ? [user.position?.name, user.division?.name].filter(Boolean).join(' · ')
        : '';

    return (
        <>
            {user && (
                <section
                    aria-label="Akun saya"
                    className="flex flex-wrap items-center gap-3.5 rounded-[22px] bg-grad-highlight p-4 text-on-brand shadow-glow md:gap-[22px] md:rounded-[26px] md:p-[26px]"
                >
                    {user.avatar ? (
                        <img
                            src={user.avatar}
                            alt=""
                            className={`${AVATAR} object-cover`}
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
                    <div className="hidden min-w-0 flex-col gap-0.5 text-right text-[16px] leading-6 lg:flex">
                        <span className="truncate">{user.email}</span>
                        {role && <span>Peran: {role}</span>}
                    </div>
                </section>
            )}
            <TabNav
                label="Pengaturan akun"
                className="-mx-4 px-4 md:mx-0 md:px-0"
                items={items.map((link) => ({
                    href: link.href,
                    label: link.title,
                    active: link.href === '/pengaturan/whatsapp',
                }))}
            />
        </>
    );
}
