import { usePage } from '@inertiajs/react';
import { ChevronsUpDown } from 'lucide-react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from '@/components/ui/sidebar';
import { UserMenuContent } from '@/components/user-menu-content';
import { primaryRoleLabel } from '@/lib/roles';

export function NavUser() {
    const { auth } = usePage().props;
    const { state } = useSidebar();

    if (!auth.user) {
        return null;
    }

    const roleLabel = primaryRoleLabel(auth.roles);

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            tooltip={auth.user.name}
                            className="group text-text data-[state=open]:bg-sidebar-accent"
                            data-test="sidebar-menu-button"
                        >
                            <UserAvatar
                                name={auth.user.name}
                                src={auth.user.avatar}
                            />
                            <span className="grid flex-1 text-left leading-tight">
                                <span className="truncate text-[13px] font-medium">
                                    {auth.user.name}
                                </span>
                                {roleLabel && (
                                    <span className="truncate text-[11px] text-text-muted">
                                        {roleLabel}
                                    </span>
                                )}
                            </span>
                            <ChevronsUpDown className="ml-auto size-4 text-text-muted" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="glass w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
                        align="end"
                        side={state === 'collapsed' ? 'right' : 'top'}
                    >
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    );
}
