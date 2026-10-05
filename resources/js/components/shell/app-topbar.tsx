import { Link } from '@inertiajs/react';
import { Bell, Search } from 'lucide-react';
import { useEffect } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { CheckInButton } from '@/components/shell/check-in-button';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useUnreadCount } from '@/features/notifications/unread-store';
import { CommandPalette } from '@/features/search/command-palette';
import {
    setCommandPaletteOpen,
    toggleCommandPalette,
} from '@/features/search/command-palette-store';
import type { BreadcrumbItem } from '@/types';

type Props = {
    breadcrumbs: BreadcrumbItem[];
    /** Hidden on tablet, where the rail is fixed. */
    canToggleSidebar: boolean;
};

const openSearch = () => setCommandPaletteOpen(true);

export function AppTopbar({ breadcrumbs, canToggleSidebar }: Props) {
    const unread = useUnreadCount();

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (
                event.key.toLowerCase() === 'k' &&
                (event.metaKey || event.ctrlKey)
            ) {
                event.preventDefault();
                toggleCommandPalette();
            }
        };

        window.addEventListener('keydown', onKeyDown);

        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <header className="glass sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-x-0 border-t-0 px-4 lg:px-6">
            {canToggleSidebar && (
                <SidebarTrigger
                    className="-ml-1 text-text-muted"
                    aria-label="Ciutkan atau lebarkan sidebar"
                />
            )}
            <div className="min-w-0 flex-1">
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <button
                type="button"
                onClick={openSearch}
                className="hidden h-8 w-64 items-center gap-2 rounded-md border border-border bg-surface/70 px-2.5 text-[13px] text-text-muted transition-colors duration-120 ease-brand hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none lg:flex xl:w-72"
            >
                <Search className="size-4" aria-hidden />
                <span className="flex-1 text-left">
                    Cari atau jalankan perintah…
                </span>
                <kbd className="rounded border border-border px-1.5 font-mono text-[11px] text-text-subtle">
                    ⌘K
                </kbd>
            </button>
            <Button
                variant="ghost"
                size="icon"
                className="text-text-muted lg:hidden"
                onClick={openSearch}
                aria-label="Cari"
            >
                <Search />
            </Button>

            <CheckInButton />

            <Button
                asChild
                variant="ghost"
                size="icon"
                className="relative text-text-muted"
            >
                <Link
                    href="/inbox"
                    prefetch
                    aria-label={
                        unread > 0
                            ? `Notifikasi, ${unread} belum dibaca`
                            : 'Notifikasi'
                    }
                >
                    <Bell />
                    {unread > 0 && (
                        <span
                            aria-hidden
                            className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
                        />
                    )}
                </Link>
            </Button>

            <CommandPalette />
        </header>
    );
}
