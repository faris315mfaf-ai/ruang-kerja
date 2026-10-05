import { Link, usePage } from '@inertiajs/react';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { forwardRef } from 'react';
import { BrandMark } from '@/components/shell/brand-mark';
import { StackContent, motionStyle } from '@/components/shell/dock';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserMenuContent } from '@/components/user-menu-content';
import { setCommandPaletteOpen } from '@/features/search/command-palette-store';
import { cn, focusRing } from '@/lib/utils';
import type { GlyphMotion, NavStack } from './use-shell-navigation';
import { useShellNavigation } from './use-shell-navigation';

type ItemProps = {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    badge?: number;
    motion?: GlyphMotion;
};

/** 56×36 pill with the glyph (gradient aksi when active) + 13px label. */
function ItemBody({ label, icon: Icon, active, badge }: ItemProps) {
    return (
        <>
            <span
                className={cn(
                    'flex h-9 w-14 items-center justify-center rounded-full transition-colors duration-120 ease-brand',
                    active
                        ? 'bg-grad-aksi text-on-brand shadow-button'
                        : 'text-text-muted group-hover:bg-surface-2',
                )}
            >
                <Icon
                    aria-hidden
                    className="dock-glyph size-[22px]"
                    strokeWidth={2}
                />
            </span>
            <span className="max-w-full text-center text-[13px] leading-4 font-bold break-words">
                {label}
            </span>
            {badge !== undefined && badge > 0 && (
                <span
                    aria-hidden
                    className="absolute top-0.5 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-badge px-1.5 text-[12px] leading-5 font-bold text-on-badge tnum ring-2 ring-surface"
                >
                    {badge > 99 ? '99+' : badge}
                </span>
            )}
        </>
    );
}

const itemClass = (active?: boolean) =>
    cn(
        'rail-item group relative flex w-[76px] shrink-0 flex-col items-center gap-1 rounded-lg py-1.5',
        active ? 'text-text' : 'text-text-muted hover:text-text',
        focusRing,
    );

function RailLink({ href, ...item }: ItemProps & { href: string }) {
    return (
        <Link
            href={href}
            prefetch
            aria-label={item.badge ? `${item.label}, ${item.badge}` : undefined}
            aria-current={item.active ? 'page' : undefined}
            style={item.motion ? motionStyle(item.motion) : undefined}
            className={itemClass(item.active)}
        >
            <ItemBody {...item} />
        </Link>
    );
}

const RailButton = forwardRef<
    HTMLButtonElement,
    ItemProps & ComponentPropsWithoutRef<'button'>
>(function RailButton({ label, icon, active, badge, motion, ...rest }, ref) {
    return (
        <button
            ref={ref}
            type="button"
            style={motion ? motionStyle(motion) : undefined}
            className={itemClass(active)}
            {...rest}
        >
            <ItemBody label={label} icon={icon} active={active} badge={badge} />
        </button>
    );
});

function RailStack({ stack }: { stack: NavStack }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <RailButton
                    label={stack.label}
                    icon={stack.icon}
                    active={stack.active}
                    motion={stack.motion}
                />
            </DropdownMenuTrigger>
            <StackContent stack={stack} side="right" />
        </DropdownMenu>
    );
}

function Divider() {
    return <span aria-hidden className="my-1 h-px w-10 shrink-0 bg-border" />;
}

function Section({ children }: { children: ReactNode }) {
    return <div className="flex flex-col items-center gap-2">{children}</div>;
}

/**
 * Tablet navigation (768–1023px, Rail.dc.html / RailMalam): a 96px glass
 * rail on the left replacing the Dock and the menu bar. Same destinations
 * as the Dock (useShellNavigation); stacks open to the right; search opens
 * the command palette; the avatar at the bottom is the account menu.
 */
export function Rail() {
    const { auth } = usePage().props;
    const { tiles, organization, workspaces, admin } = useShellNavigation();

    return (
        <nav
            aria-label="Navigasi utama"
            className="glass fixed inset-y-0 left-0 z-40 flex w-(--rail-width) [scrollbar-width:none] flex-col items-center gap-2 overflow-y-auto border-y-0 border-l-0 border-r-border px-2.5 pt-5 pb-5 [&::-webkit-scrollbar]:hidden"
        >
            <Link
                href="/dashboard"
                prefetch
                aria-label="Ke beranda"
                className={cn('mb-3 shrink-0 rounded-[16px]', focusRing)}
            >
                <BrandMark size="lg" />
            </Link>

            <Section>
                <RailButton
                    label="Cari"
                    icon={Search}
                    onClick={() => setCommandPaletteOpen(true)}
                />
                {tiles.map((tile) => (
                    <RailLink
                        key={tile.key}
                        href={tile.href}
                        label={tile.label}
                        icon={tile.icon}
                        active={tile.active}
                        badge={tile.badge}
                        motion={tile.motion}
                    />
                ))}
            </Section>

            <Divider />

            <Section>
                <RailStack stack={workspaces} />
                {organization && <RailStack stack={organization} />}
                {admin && <RailStack stack={admin} />}
            </Section>

            <span className="flex-1" />

            {auth.user && (
                <DropdownMenu>
                    <DropdownMenuTrigger
                        className={cn('shrink-0 rounded-full', focusRing)}
                        aria-label={`Menu akun ${auth.user.name}`}
                    >
                        <UserAvatar
                            name={auth.user.name}
                            src={auth.user.avatar}
                            className="size-11 text-[15px]"
                        />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        side="right"
                        align="end"
                        sideOffset={14}
                        className="w-72"
                    >
                        <UserMenuContent user={auth.user} />
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </nav>
    );
}
