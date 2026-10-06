import { Head, Link, router, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Bell,
    Calendar,
    CheckCheck,
    ChevronRight,
    CloudCog,
    FileText,
    Inbox,
    LayoutGrid,
    LogOut,
    Moon,
    ShieldCheck,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { MenuWorkspaceGrid } from '@/features/workspaces/menu-workspace-grid';
import { useAppearance } from '@/hooks/use-appearance';
import { useInitials } from '@/hooks/use-initials';
import {
    adminNavItems,
    attendanceNavItems,
    canSeeManagement,
    canSeePortfolio,
    managementNavItem,
    organizationNavItems,
    chatNavItem,
    okrNavItem,
    portfolioNavItem,
    prototypeNavItem,
} from '@/lib/navigation';
import { primaryRoleLabel } from '@/lib/roles';
import { cn, focusRing } from '@/lib/utils';
import { logout } from '@/routes';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { google as googleSettings } from '@/routes/settings';

const APPEARANCE_LABELS = {
    system: 'Ikuti sistem',
    light: 'Terang',
    dark: 'Gelap',
} as const;

/** Overline heading + one card of rows (MMenu "Workspace", "Lainnya"). */
function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="flex flex-col gap-2.5">
            <h2 className="px-1 pt-1 text-overline text-text-muted">{title}</h2>
            {children}
        </section>
    );
}

function Group({ children }: { children: ReactNode }) {
    return (
        <div className="divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface">
            {children}
        </div>
    );
}

/** Row with a 38px neutral icon tile and an optional value on the right. */
function Row({
    icon: Icon,
    label,
    href,
    trailing,
}: {
    icon: LucideIcon;
    label: string;
    href: string;
    trailing?: ReactNode;
}) {
    return (
        <ListRow
            href={href}
            className="min-h-[58px] px-4 md:px-4"
            leading={
                <span className="flex size-[38px] items-center justify-center rounded-[11px] bg-surface-2 text-text">
                    <Icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
            }
            title={label}
            trailing={
                trailing && (
                    <span className="flex items-center gap-2 text-label font-normal text-text-muted">
                        {trailing}
                        <ChevronRight
                            aria-hidden
                            className="size-[18px] text-text-subtle"
                            strokeWidth={2.4}
                        />
                    </span>
                )
            }
        />
    );
}

/** Gradient identity card linking to the profile (MMenu header card). */
function ProfileCard() {
    const { auth } = usePage().props;
    const getInitials = useInitials();
    const user = auth.user;

    if (!user) {
        return null;
    }

    const subtitle =
        [user.position?.name, user.division?.name]
            .filter(Boolean)
            .join(' · ') ||
        primaryRoleLabel(auth.roles) ||
        user.email;
    const avatar =
        'flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-on-brand/50 bg-on-brand/20 text-[19px] font-extrabold';

    return (
        <Link
            href={edit()}
            prefetch
            className={cn(
                'flex items-center gap-3.5 rounded-panel bg-grad-highlight p-[18px] text-on-brand shadow-glow transition-opacity duration-120 ease-brand hover:opacity-95',
                focusRing,
            )}
        >
            {user.avatar ? (
                <img
                    src={user.avatar}
                    alt=""
                    className={cn(avatar, 'object-cover')}
                />
            ) : (
                <span aria-hidden className={avatar}>
                    {getInitials(user.name)}
                </span>
            )}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-[19px] leading-[26px] font-extrabold">
                    {user.name}
                </span>
                <span className="truncate text-label font-normal">
                    {subtitle}
                </span>
            </span>
            <ChevronRight aria-hidden className="size-5" strokeWidth={2.4} />
        </Link>
    );
}

/**
 * Mobile "Lainnya" tab (/menu): profile, workspaces, work & settings
 * (mobile-first canvas › Menu). Holds Inbox too while Obrolan has its tab.
 */
export default function Menu() {
    const { auth, approvals, features, chatUnread } = usePage().props;
    const { appearance } = useAppearance();
    const pending = approvals?.pending ?? 0;
    const unread = useUnreadCount();

    return (
        <>
            <Head title="Lainnya" />
            <div className="mx-auto flex max-w-xl flex-col gap-4 pb-2">
                <h1 className="hidden md:sr-only md:block">Lainnya</h1>
                <ProfileCard />

                <Section title="Workspace">
                    <MenuWorkspaceGrid />
                </Section>

                <Section title="Pekerjaan">
                    <Group>
                        <Row
                            icon={LayoutGrid}
                            label="Dashboard"
                            href="/dashboard"
                        />
                        {canSeePortfolio(auth.roles) && (
                            <Row
                                icon={portfolioNavItem.icon}
                                label="Portofolio proyek"
                                href={portfolioNavItem.href}
                            />
                        )}
                        {canSeeManagement(auth.roles) && (
                            <Row
                                icon={managementNavItem.icon}
                                label="Ringkasan manajemen"
                                href={managementNavItem.href}
                            />
                        )}
                        {features?.okr && (
                            <Row
                                icon={okrNavItem.icon}
                                label="OKR divisi"
                                href={okrNavItem.href}
                            />
                        )}
                        {features?.chat && (
                            <Row
                                icon={chatNavItem.icon}
                                label={chatNavItem.title}
                                href={chatNavItem.href}
                                trailing={
                                    (chatUnread ?? 0) > 0 ? (
                                        <Badge
                                            variant="count"
                                            aria-label={`${chatUnread ?? 0} obrolan belum dibaca`}
                                        >
                                            {chatUnread}
                                        </Badge>
                                    ) : undefined
                                }
                            />
                        )}
                        {features?.chat && (
                            <Row
                                icon={Inbox}
                                label="Inbox"
                                href="/inbox"
                                trailing={
                                    unread > 0 ? (
                                        <Badge
                                            variant="count"
                                            aria-label={`${unread} notifikasi belum dibaca`}
                                        >
                                            {unread > 99 ? '99+' : unread}
                                        </Badge>
                                    ) : undefined
                                }
                            />
                        )}
                        <Row
                            icon={CheckCheck}
                            label="Persetujuan"
                            href="/persetujuan"
                            trailing={
                                pending > 0 ? (
                                    <Badge
                                        variant="count"
                                        aria-label={`${pending} menunggu`}
                                    >
                                        {pending}
                                    </Badge>
                                ) : undefined
                            }
                        />
                        <Row
                            icon={FileText}
                            label="Pengajuan saya"
                            href="/pengajuan"
                        />
                        <Row
                            icon={Calendar}
                            label="Riwayat absensi"
                            href="/absensi/riwayat"
                        />
                        {[
                            ...organizationNavItems(auth.roles),
                            ...attendanceNavItems(auth.roles),
                            ...adminNavItems(auth.roles),
                        ]
                            .filter((item) => !item.desktopOnly)
                            .map((item) => (
                                <Row
                                    key={item.href}
                                    icon={item.icon}
                                    label={item.title}
                                    href={item.href}
                                />
                            ))}
                    </Group>
                </Section>

                {features?.prototype && (
                    <Section title="Pratinjau">
                        <Group>
                            <Row
                                icon={prototypeNavItem.icon}
                                label="Fitur Fase 2 & 3"
                                href={prototypeNavItem.href}
                            />
                        </Group>
                    </Section>
                )}

                <Section title="Lainnya">
                    <Group>
                        <Row
                            icon={Bell}
                            label="Notifikasi"
                            href="/pengaturan/notifikasi"
                        />
                        <Row
                            icon={Moon}
                            label="Tampilan"
                            href={editAppearance().url}
                            trailing={APPEARANCE_LABELS[appearance]}
                        />
                        <Row
                            icon={ShieldCheck}
                            label="Privasi & data saya"
                            href="/privasi"
                        />
                        <Row
                            icon={CloudCog}
                            label="Akun Google"
                            href={googleSettings().url}
                        />
                    </Group>
                </Section>

                <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="mt-1 w-full text-danger"
                    onClick={() => {
                        router.flushAll();
                        router.post(logout());
                    }}
                >
                    <LogOut aria-hidden />
                    Keluar
                </Button>
            </div>
        </>
    );
}

Menu.layout = {
    breadcrumbs: [{ title: 'Lainnya', href: '/menu' }],
};
