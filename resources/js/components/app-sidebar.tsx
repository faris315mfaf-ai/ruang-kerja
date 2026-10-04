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
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { useCurrentUrl } from '@/hooks/use-current-url';
import type { AppNavItem } from '@/lib/navigation';
import { adminNavItems, isActivePath, mainNavItems } from '@/lib/navigation';
import { cn } from '@/lib/utils';

function NavList({ items }: { items: AppNavItem[] }) {
    const { currentUrl } = useCurrentUrl();

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
                </SidebarMenuItem>
            ))}
        </SidebarMenu>
    );
}

function PersonalWorkspaceLink() {
    const { auth } = usePage().props;
    const { currentUrl } = useCurrentUrl();
    const initial = (auth.user?.name ?? '?').trim().charAt(0).toUpperCase();

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    isActive={currentUrl.startsWith('/workspace')}
                    tooltip="Pribadi"
                    className="h-8 text-[13px]"
                >
                    <Link href="/workspace" prefetch>
                        <span
                            aria-hidden
                            className="flex size-4.5 shrink-0 items-center justify-center rounded-[4px] bg-surface-2 text-[10px] font-semibold text-text-muted ring-1 ring-border"
                        >
                            {initial}
                        </span>
                        <span>Pribadi</span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}

export function AppSidebar({ className }: { className?: string }) {
    const { auth } = usePage().props;
    const adminItems = adminNavItems(auth.roles);

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
                    <NavList items={mainNavItems} />
                </SidebarGroup>

                <SidebarGroup className="py-1">
                    <SidebarGroupLabel className="text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                        Workspace
                    </SidebarGroupLabel>
                    <PersonalWorkspaceLink />
                </SidebarGroup>

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
