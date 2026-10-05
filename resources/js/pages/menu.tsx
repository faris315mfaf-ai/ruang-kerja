import { Head, Link, router, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import {
    Bell,
    Calendar,
    CheckCheck,
    ChevronRight,
    FileText,
    LayoutGrid,
    LogOut,
    Network,
    ShieldCheck,
    SunMoon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { ThemeSegmented } from '@/components/shell/theme-segmented';
import { UserAvatar } from '@/components/shell/user-avatar';
import { MenuWorkspaceGrid } from '@/features/workspaces/menu-workspace-grid';
import { adminNavItems } from '@/lib/navigation';
import { primaryRoleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { logout } from '@/routes';
import { edit } from '@/routes/profile';

function Section({ title, children }: { title: string; children: ReactNode }) {
    return (
        <section className="space-y-2">
            <h2 className="px-1 text-[13px] font-medium text-text-muted">
                {title}
            </h2>
            {children}
        </section>
    );
}

function Group({ children }: { children: ReactNode }) {
    return (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface [&>li]:ml-0">
            {children}
        </ul>
    );
}

type RowProps = {
    icon: LucideIcon;
    label: string;
    href?: string;
    trailing?: ReactNode;
};

function Row({ icon: Icon, label, href, trailing }: RowProps) {
    const content = (
        <>
            <Icon
                className="size-5 shrink-0 text-text-muted"
                strokeWidth={1.75}
                aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[15px] text-text">
                {label}
            </span>
            {trailing}
            {href && (
                <ChevronRight
                    className="size-4 shrink-0 text-text-subtle"
                    aria-hidden
                />
            )}
        </>
    );

    const className =
        'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left';

    return (
        <li>
            {href ? (
                <Link
                    href={href}
                    prefetch
                    className={cn(
                        className,
                        'transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none',
                    )}
                >
                    {content}
                </Link>
            ) : (
                <div className={className}>{content}</div>
            )}
        </li>
    );
}

/** Mobile "Menu" tab: profile, workspace, work & settings (mockup MMenu). */
export default function Menu() {
    const { auth } = usePage().props;
    const roleLabel = primaryRoleLabel(auth.roles);

    return (
        <>
            <Head title="Menu" />
            <div className="mx-auto max-w-xl space-y-6">
                {auth.user && (
                    <Link
                        href={edit()}
                        prefetch
                        className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3.5 transition-colors duration-120 ease-brand hover:bg-surface-2"
                    >
                        <UserAvatar
                            name={auth.user.name}
                            src={auth.user.avatar}
                            className="size-12 text-base"
                        />
                        <span className="grid min-w-0 flex-1">
                            <span className="truncate text-[17px] font-semibold text-text">
                                {auth.user.name}
                            </span>
                            <span className="truncate text-sm text-text-muted">
                                {roleLabel ?? auth.user.email}
                            </span>
                        </span>
                        <ChevronRight
                            className="size-4 text-text-subtle"
                            aria-hidden
                        />
                    </Link>
                )}

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
                        <Row
                            icon={CheckCheck}
                            label="Persetujuan"
                            href="/persetujuan"
                        />
                        <Row
                            icon={FileText}
                            label="Pengajuan saya"
                            href="/pengajuan"
                        />
                        <Row
                            icon={Calendar}
                            label="Riwayat absensi"
                            href="/absensi"
                        />
                        <Row
                            icon={Network}
                            label="Struktur organisasi"
                            href="/organisasi/struktur"
                        />
                        {adminNavItems(auth.roles)
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

                <Section title="Pengaturan">
                    <Group>
                        <Row
                            icon={Bell}
                            label="Notifikasi"
                            href="/pengaturan/notifikasi"
                        />
                        <Row
                            icon={SunMoon}
                            label="Tampilan"
                            trailing={<ThemeSegmented />}
                        />
                        <Row
                            icon={ShieldCheck}
                            label="Privasi & data saya"
                            href="/privasi"
                        />
                    </Group>
                </Section>

                <button
                    type="button"
                    onClick={() => {
                        router.flushAll();
                        router.post(logout());
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-[15px] font-medium text-danger transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <LogOut className="size-5" strokeWidth={1.75} aria-hidden />
                    Keluar
                </button>
            </div>
        </>
    );
}

Menu.layout = {
    breadcrumbs: [{ title: 'Menu', href: '/menu' }],
};
