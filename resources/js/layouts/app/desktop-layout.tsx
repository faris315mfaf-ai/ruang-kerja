import { usePage } from '@inertiajs/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { AppSidebar } from '@/components/app-sidebar';
import { AppTopbar } from '@/components/shell/app-topbar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import type { BreadcrumbItem } from '@/types';

type Props = {
    children: ReactNode;
    breadcrumbs: BreadcrumbItem[];
    /** 768–1023px: sidebar is always the 56px rail. */
    isTablet: boolean;
};

/**
 * Desktop & tablet shell: glass sidebar 240px (collapsible to a 56px rail,
 * remembered in the sidebar_state cookie) + glass topbar (docs/PLATFORM.md §2).
 */
export default function DesktopLayout({
    children,
    breadcrumbs,
    isTablet,
}: Props) {
    const { sidebarOpen } = usePage().props;
    const [userOpen, setUserOpen] = useState(sidebarOpen);

    return (
        <SidebarProvider
            open={isTablet ? false : userOpen}
            onOpenChange={(open) => {
                if (!isTablet) {
                    setUserOpen(open);
                }
            }}
        >
            <AppSidebar />
            <SidebarInset className="min-w-0 bg-transparent">
                <AppTopbar
                    breadcrumbs={breadcrumbs}
                    canToggleSidebar={!isTablet}
                />
                <div className="mx-auto w-full max-w-[1440px] flex-1 p-4 lg:p-6">
                    {children}
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
}
