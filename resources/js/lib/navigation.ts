import type { LucideIcon } from 'lucide-react';
import {
    BarChart3,
    BookOpen,
    Calendar,
    Building2,
    ClipboardCheck,
    CircleCheck,
    Clock,
    FlaskConical,
    FolderKanban,
    Gauge,
    Home,
    Inbox,
    MapPin,
    MessagesSquare,
    ListChecks,
    Menu,
    Network,
    ScrollText,
    SquareCheckBig,
    Users,
    WalletCards,
    Workflow,
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
    badge?: 'approvals' | 'chat';
    /** Hidden from the mobile Menu tab (docs/PLATFORM.md §3, "—" on mobile). */
    desktopOnly?: boolean;
};

/**
 * Desktop Dock / tablet Rail main items in the order of Dock.dc.html
 * (docs/DESIGN.md §7); the mobile tab bar has its own list.
 */
export const mainNavItems: AppNavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: Home,
        matchPrefix: true,
    },
    { title: 'Inbox', href: '/inbox', icon: Inbox, matchPrefix: true },
    {
        title: 'Tugas saya',
        href: '/tugas',
        icon: SquareCheckBig,
        matchPrefix: true,
    },
    { title: 'Absensi', href: '/absensi', icon: MapPin, matchPrefix: true },
    {
        title: 'Pengajuan',
        href: '/pengajuan',
        icon: Calendar,
        matchPrefix: true,
    },
    {
        title: 'Persetujuan',
        href: '/persetujuan',
        icon: CircleCheck,
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

/**
 * "Manajemen" (Dashboard Manajemen, /manajemen) for the holders of
 * `dashboard.view_company`: Direksi, HR and Super Admin (Gate
 * `viewManagementDashboard`).
 */
export const managementNavItem: AppNavItem = {
    title: 'Manajemen',
    href: '/manajemen',
    icon: Gauge,
    matchPrefix: true,
};

export function canSeeManagement(roles: readonly string[]): boolean {
    return hasAnyRole(roles, 'direksi', 'hr', 'super_admin');
}

/**
 * Main navigation for the signed-in roles: Portofolio right after Dashboard,
 * then Manajemen.
 */
export function mainNavItemsFor(roles: readonly string[]): AppNavItem[] {
    const extra = [
        ...(canSeePortfolio(roles) ? [portfolioNavItem] : []),
        ...(canSeeManagement(roles) ? [managementNavItem] : []),
    ];

    if (extra.length === 0) {
        return mainNavItems;
    }

    const index = mainNavItems.findIndex((item) => item.href === '/dashboard');

    return [
        ...mainNavItems.slice(0, index + 1),
        ...extra,
        ...mainNavItems.slice(index + 1),
    ];
}

/**
 * "Obrolan" (/obrolan, F2-1): shown while the `chat` feature flag is on
 * (shared prop `features.chat`); badge = channels with unread messages.
 */
export const chatNavItem: AppNavItem = {
    title: 'Obrolan',
    href: '/obrolan',
    icon: MessagesSquare,
    matchPrefix: true,
    badge: 'chat',
};

/**
 * "Otomasi" (/otomasi, F2-4): rules, recurring tasks and templates, shown
 * to every employee while the `automation` flag is on (shared prop
 * `features.automation`). Everyone may add recurring tasks and use
 * templates; rules are managed by workspace owners/admins (Policy).
 */
export const automationNavItem: AppNavItem = {
    title: 'Otomasi',
    href: '/otomasi',
    icon: Workflow,
    matchPrefix: true,
};

/** "Kinerja saya" (/kinerja, F2-4), behind the same flag. */
export const performanceNavItem: AppNavItem = {
    title: 'Kinerja saya',
    href: '/kinerja',
    icon: BarChart3,
    matchPrefix: true,
};

/**
 * "Pratinjau" (/pratinjau): Fase 2 & 3 front-end previews, shown only while
 * the `prototype` feature flag is on (shared prop `features.prototype`).
 */
export const prototypeNavItem: AppNavItem = {
    title: 'Pratinjau',
    href: '/pratinjau',
    icon: FlaskConical,
    matchPrefix: true,
};

export type TabNavItem = AppNavItem & {
    /** Raised round action in the middle of the capsule (Absen). */
    center?: boolean;
};

/**
 * Mobile bottom tab bar, five items (docs/PLATFORM.md §2.1): Beranda ·
 * Tugas · Absen (raised centre action) · Obrolan · Lainnya. Inbox lives
 * behind the app bar bell; it takes the fourth slot back when Obrolan is
 * switched off (FEATURE_CHAT).
 */
export function tabNavItems(chat: boolean): TabNavItem[] {
    return [
        { title: 'Beranda', href: '/dashboard', icon: Home, matchPrefix: true },
        {
            title: 'Tugas',
            href: '/tugas',
            icon: SquareCheckBig,
            matchPrefix: true,
        },
        {
            title: 'Absen',
            href: '/absensi',
            icon: MapPin,
            matchPrefix: true,
            center: true,
        },
        chat
            ? chatNavItem
            : {
                  title: 'Inbox',
                  href: '/inbox',
                  icon: Inbox,
                  matchPrefix: true,
              },
        { title: 'Lainnya', href: '/menu', icon: Menu },
    ];
}

/** Index of the tab owning the current URL, or -1 (e.g. /persetujuan). */
export function activeTabIndex(currentPath: string, chat: boolean): number {
    return tabNavItems(chat).findIndex((item) =>
        isActivePath(item, currentPath),
    );
}

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
