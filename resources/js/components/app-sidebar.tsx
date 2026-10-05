import { Link, usePage } from '@inertiajs/react';
import { CheckInStatus } from '@/components/shell/check-in-status';
import { BrandMark } from '@/components/shell/brand-mark';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { SidebarWorkspaces } from '@/features/workspaces/sidebar-workspaces';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { AppNavItem } from '@/lib/navigation';
import {
    adminNavItems,
    attendanceNavItems,
    isActivePath,
    mainNavItemsFor,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

function NavList({ items }: { items: AppNavItem[] }) {
    const { currentUrl } = useCurrentUrl();
    const unread = useUnreadCount();
    const { approvals } = usePage().props;
    const badgeCount = (item: AppNavItem): number =>
        item.badge === 'approvals' ? (approvals?.pending ?? 0) : 0;

    return (
        <SidebarMenu>
            {items.map((item) => (
                <SidebarMenuItem key={item.href + item.title}>
                    <SidebarMenuButton
                        asChild
                        isActive={isActivePath(item, currentUrl)}
                        tooltip={item.title}
                        className="h-8 text-[13px] [&>svg]:size-4.5"
                    >
                        <Link href={item.href} prefetch>
                            <item.icon strokeWidth={1.75} />
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                    {item.href === '/inbox' && unread > 0 && (
                        <SidebarMenuBadge className="text-primary tnum">
                            {unread > 99 ? '99+' : unread}
                            <span className="sr-only"> belum dibaca</span>
                        </SidebarMenuBadge>
                    )}
                    {badgeCount(item) > 0 && (
                        <SidebarMenuBadge className="text-primary tnum">
                            {badgeCount(item)}
                            <span className="sr-only"> menunggu keputusan</span>
                        </SidebarMenuBadge>
                    )}
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}

export function AppSidebar({ className }: { className?: string }) {
    const { auth } = usePage().props;
    const adminItems = [
        ...attendanceNavItems(auth.roles),
        ...adminNavItems(auth.roles),
    ];

    return (
        <Sidebar
            collapsible="icon"
            variant="sidebar"
            className={cn(
                'glass border-y-0 border-l-0 [&>[data-sidebar=sidebar]]:bg-transparent',
                className,
            )}
        >
            <SidebarHeader className="gap-3 px-3 pt-4 group-data-[collapsible=icon]:px-2">
                <Link
                    href="/dashboard"
                    prefetch
                    className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                    <BrandMark
                        withName
                        className="group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&>span:last-child]:hidden"
                    />
                </Link>
                <CheckInStatus />
            </SidebarHeader>

            <SidebarContent className="gap-1">
                <SidebarGroup className="py-1">
                    <NavList items={mainNavItemsFor(auth.roles)} />
                </SidebarGroup>

                <SidebarWorkspaces />

                {adminItems.length > 0 && (
                    <SidebarGroup className="py-1">
                        <SidebarGroupLabel className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                            Admin
                        </SidebarGroupLabel>
                        <NavList items={adminItems} />
                    </SidebarGroup>
                )}
            </SidebarContent>

            <SidebarFooter className="border-t border-border p-2">
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
