import type { LucideIcon } from 'lucide-react';
import {
    BarChart3,
    BookOpen,
    Building2,
    ClipboardCheck,
    CheckCheck,
    CircleCheck,
    Clock,
    FileText,
    FolderKanban,
    Home,
    Inbox,
    LayoutGrid,
    MapPin,
    ListChecks,
    Menu,
    Network,
    ScrollText,
    Users,
    WalletCards,
} from 'lucide-react';
import type { RoleName } from '@/lib/roles';
import { hasAnyRole } from '@/lib/roles';

export type AppNavItem = {
    title: string;
    href: string;
    icon: LucideIcon;
    /** Match nested routes too (e.g. /pengajuan/123). */
    matchPrefix?: boolean;
    /** Shared-prop counter shown as a badge. */
    badge?: 'approvals';
    /** Hidden from the mobile Menu tab (docs/PLATFORM.md §3, "—" on mobile). */
    desktopOnly?: boolean;
};

/** Desktop Dock main tiles (docs/DESIGN.md §5); the mobile tab bar has its own list. */
export const mainNavItems: AppNavItem[] = [
    { title: 'Inbox', href: '/inbox', icon: Inbox, matchPrefix: true },
    {
        title: 'Tugas saya',
        href: '/tugas',
        icon: CircleCheck,
        matchPrefix: true,
    },
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutGrid,
        matchPrefix: true,
    },
    { title: 'Absensi', href: '/absensi', icon: MapPin, matchPrefix: true },
    {
        title: 'Pengajuan',
        href: '/pengajuan',
        icon: FileText,
        matchPrefix: true,
    },
    {
        title: 'Persetujuan',
        href: '/persetujuan',
        icon: CheckCheck,
        matchPrefix: true,
        badge: 'approvals',
    },
];

/** Org chart: every role (mobile Menu row, first entry of the Dock "Organisasi" stack). */
export const orgChartNavItem: AppNavItem = {
    title: 'Struktur organisasi',
    href: '/organisasi/struktur',
    icon: Network,
    matchPrefix: true,
};

/**
 * Everything about the organization in one place (Dock "Organisasi" stack):
 * the org chart for everyone, the organization admin for HR & Super Admin and
 * the employee list (Kepala Divisi sees it as "Anggota divisi"). Each
 * destination lives here only, never in {@link adminNavItems} as well.
 */
export function organizationNavItems(roles: readonly string[]): AppNavItem[] {
    const items: AppNavItem[] = [orgChartNavItem];

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push(
            {
                title: 'Kelola organisasi',
                href: '/admin/organisasi',
                icon: Building2,
                matchPrefix: true,
                desktopOnly: true,
            },
            {
                title: 'Karyawan',
                href: '/admin/karyawan',
                icon: Users,
                matchPrefix: true,
            },
        );
    } else if (hasAnyRole(roles, 'kepala_divisi' satisfies RoleName)) {
        items.push({
            title: 'Anggota divisi',
            href: '/admin/karyawan',
            icon: Users,
            matchPrefix: true,
        });
    }

    return items;
}

/** "Portofolio" (Dashboard Direksi, Sprint 9) for Direksi and Super Admin. */
export const portfolioNavItem: AppNavItem = {
    title: 'Portofolio',
    href: '/portofolio',
    icon: FolderKanban,
};

export function canSeePortfolio(roles: readonly string[]): boolean {
    return hasAnyRole(roles, 'direksi', 'super_admin');
}

/** Main navigation for the signed-in roles: Portofolio right after Dashboard. */
export function mainNavItemsFor(roles: readonly string[]): AppNavItem[] {
    if (!canSeePortfolio(roles)) {
        return mainNavItems;
    }

    const index = mainNavItems.findIndex((item) => item.href === '/dashboard');

    return [
        ...mainNavItems.slice(0, index + 1),
        portfolioNavItem,
        ...mainNavItems.slice(index + 1),
    ];
}

/** Mobile bottom tab bar: exactly five items (docs/PLATFORM.md §2). */
export const tabNavItems: AppNavItem[] = [
    { title: 'Beranda', href: '/dashboard', icon: Home, matchPrefix: true },
    { title: 'Absen', href: '/absensi', icon: MapPin, matchPrefix: true },
    { title: 'Tugas', href: '/tugas', icon: CircleCheck, matchPrefix: true },
    { title: 'Inbox', href: '/inbox', icon: Inbox, matchPrefix: true },
    { title: 'Menu', href: '/menu', icon: Menu },
];

/**
 * Team attendance (Sprint 3): live board for HR, Direksi, Super Admin and
 * Kepala Divisi; the monthly recap & export is desktop only.
 */
export function attendanceNavItems(roles: readonly string[]): AppNavItem[] {
    if (!hasAnyRole(roles, 'super_admin', 'hr', 'direksi', 'kepala_divisi')) {
        return [];
    }

    return [
        {
            title: 'Absensi hari ini',
            href: '/absensi/hari-ini',
            icon: ClipboardCheck,
        },
        {
            title: 'Rekap absensi',
            href: '/absensi/rekap',
            icon: BarChart3,
            desktopOnly: true,
        },
    ];
}

/**
 * Admin entries depend on global roles. Organization screens (org admin,
 * employees) live in {@link organizationNavItems} instead.
 */
export function adminNavItems(roles: readonly string[]): AppNavItem[] {
    const items: AppNavItem[] = [];

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push({
            title: 'Lokasi & shift',
            href: '/admin/absensi',
            icon: Clock,
            matchPrefix: true,
            desktopOnly: true,
        });
    }

    if (hasAnyRole(roles, 'super_admin')) {
        items.push({
            title: 'Audit log',
            href: '/admin/audit',
            icon: ScrollText,
            matchPrefix: true,
            desktopOnly: true,
        });
    }

    if (hasAnyRole(roles, 'super_admin', 'hr')) {
        items.push(
            {
                title: 'Jenis pengajuan',
                href: '/admin/pengajuan',
                icon: ListChecks,
                matchPrefix: true,
                desktopOnly: true,
            },
            {
                title: 'Saldo cuti',
                href: '/admin/saldo-cuti',
                icon: WalletCards,
                matchPrefix: true,
                desktopOnly: true,
            },
        );
    }

    if (hasAnyRole(roles, 'super_admin')) {
        items.push({
            title: 'Dokumentasi',
            href: '/admin/dokumentasi',
            icon: BookOpen,
            matchPrefix: true,
            desktopOnly: true,
        });
    }

    return items;
}

export function isActivePath(item: AppNavItem, currentPath: string): boolean {
    if (item.matchPrefix) {
        return (
            currentPath === item.href || currentPath.startsWith(`${item.href}/`)
        );
    }

    return currentPath === item.href;
}
