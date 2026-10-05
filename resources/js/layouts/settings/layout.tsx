import { Link, usePage } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { hasAnyRole } from '@/lib/roles';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import { google as googleSettings } from '@/routes/settings';
import type { NavItem } from '@/types';

const profileItem: NavItem = { title: 'Profil', href: edit(), icon: null };

// Password & 2FA exist only for the Super Admin emergency sign-in.
const securityItem: NavItem = {
    title: 'Keamanan',
    href: editSecurity(),
    icon: null,
};

const appearanceItem: NavItem = {
    title: 'Tampilan',
    href: editAppearance(),
    icon: null,
};

const googleItem: NavItem = {
    title: 'Akun Google',
    href: googleSettings(),
    icon: null,
};

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentOrParentUrl } = useCurrentUrl();
    const { auth } = usePage().props;
    const sidebarNavItems = hasAnyRole(auth.roles, 'super_admin')
        ? [profileItem, securityItem, appearanceItem, googleItem]
        : [profileItem, appearanceItem, googleItem];

    return (
        <div className="px-4 py-6">
            <Heading
                title="Pengaturan"
                description="Profil dan tampilan aplikasi"
            />

            <div className="flex flex-col lg:flex-row lg:space-x-12">
                <aside className="w-full max-w-xl lg:w-48">
                    <nav
                        className="flex flex-col space-y-1 space-x-0"
                        aria-label="Pengaturan"
                    >
                        {sidebarNavItems.map((item, index) => {
                            const active = isCurrentOrParentUrl(item.href);

                            return (
                                <Button
                                    key={`${toUrl(item.href)}-${index}`}
                                    size="sm"
                                    variant="ghost"
                                    asChild
                                    className={cn('w-full justify-start', {
                                        'bg-muted': active,
                                    })}
                                >
                                    <Link
                                        href={item.href}
                                        aria-current={
                                            active ? 'page' : undefined
                                        }
                                    >
                                        {item.icon && (
                                            <item.icon className="h-4 w-4" />
                                        )}
                                        {item.title}
                                    </Link>
                                </Button>
                            );
                        })}
                    </nav>
                </aside>

                <Separator className="my-6 lg:hidden" />

                <div className="flex-1 md:max-w-2xl">
                    <section className="max-w-xl space-y-12">
                        {children}
                    </section>
                </div>
            </div>
        </div>
    );
}
