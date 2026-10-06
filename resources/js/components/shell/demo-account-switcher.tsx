import { router, usePage } from '@inertiajs/react';
import { Check, ChevronDown, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { UserAvatar } from '@/components/shell/user-avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn, focusRing } from '@/lib/utils';
import type { DemoSwitcherAccount } from '@/types';

/**
 * Local demo only (APP_ENV=local + DEMO_LOGIN_ENABLED): switch between the
 * persona accounts without going back to the login page, to review each
 * role's screens. Renders nothing when the shared prop `demoSwitcher` is
 * null (production, demo login off).
 */
function useDemoSwitcher() {
    const { demoSwitcher, auth } = usePage().props;
    const [pending, setPending] = useState<string | null>(null);

    const accounts = demoSwitcher ?? [];
    const current = accounts.find((account) => account.current) ?? null;
    // Signed in as a demo account outside the five personas (e.g. kadiv@): show its name.
    const label = current?.persona ?? auth.user?.name ?? 'akun lain';

    const switchTo = (account: DemoSwitcherAccount) => {
        if (account.current || pending !== null) {
            return;
        }

        router.post(
            '/demo/ganti-akun',
            { email: account.email },
            {
                onStart: () => setPending(account.email),
                onFinish: () => setPending(null),
                // Props of the previous persona must never be reused.
                onSuccess: () => router.flushAll(),
            },
        );
    };

    return { accounts, current, label, pending, switchTo };
}

function AccountItems({
    accounts,
    pending,
    onSelect,
}: {
    accounts: DemoSwitcherAccount[];
    pending: string | null;
    onSelect: (account: DemoSwitcherAccount) => void;
}) {
    return (
        <>
            <DropdownMenuLabel>Masuk sebagai (demo lokal)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {accounts.map((account) => (
                <DropdownMenuItem
                    key={account.email}
                    onSelect={() => onSelect(account)}
                    disabled={pending !== null}
                    aria-current={account.current ? 'true' : undefined}
                    className="min-h-14 gap-3"
                >
                    <UserAvatar
                        name={account.name}
                        className="size-9 text-[13px]"
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] leading-5 font-semibold text-text">
                            {account.persona}
                        </span>
                        <span className="truncate text-[13px] text-text-muted">
                            {account.name} · {account.role_label}
                        </span>
                    </span>
                    {pending === account.email ? (
                        <Spinner className="size-4" />
                    ) : (
                        account.current && (
                            <Check
                                aria-hidden
                                className="size-4 text-primary"
                                strokeWidth={2.4}
                            />
                        )
                    )}
                </DropdownMenuItem>
            ))}
        </>
    );
}

/** Desktop menu bar: compact pill "Demo · <persona>". */
export function DemoAccountSwitcher() {
    const { accounts, label, pending, switchTo } = useDemoSwitcher();

    if (accounts.length === 0) {
        return null;
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                className={cn(
                    'flex h-10 max-w-[240px] shrink-0 items-center gap-2 rounded-full border border-border bg-info-soft pr-3 pl-3.5 text-[14px] font-semibold text-info transition-colors duration-120 ease-brand hover:border-border-strong',
                    focusRing,
                )}
                aria-label={`Ganti akun demo, sekarang ${label}`}
            >
                {pending !== null ? (
                    <Spinner className="size-4 shrink-0" />
                ) : (
                    <UsersRound
                        aria-hidden
                        className="size-4 shrink-0"
                        strokeWidth={2.2}
                    />
                )}
                <span className="shrink-0 max-2xl:sr-only">Demo ·</span>
                <span className="min-w-0 truncate">{label}</span>
                <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0"
                    strokeWidth={2.4}
                />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} className="w-80">
                <AccountItems
                    accounts={accounts}
                    pending={pending}
                    onSelect={switchTo}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/**
 * Tablet (above the content, next to the Rail) and phone (above the app
 * bar): a slim strip with the current persona and a "Ganti akun" menu.
 */
export function DemoAccountStrip({ className }: { className?: string }) {
    const { accounts, label, pending, switchTo } = useDemoSwitcher();

    if (accounts.length === 0) {
        return null;
    }

    return (
        <div
            className={cn(
                'flex items-center justify-between gap-3 border-b border-border bg-info-soft px-4 text-info',
                className,
            )}
        >
            <p className="flex min-w-0 items-center gap-2 text-[14px] leading-5 font-semibold">
                <UsersRound
                    aria-hidden
                    className="size-4 shrink-0"
                    strokeWidth={2.2}
                />
                <span className="truncate">Demo · {label}</span>
            </p>
            <DropdownMenu>
                <DropdownMenuTrigger
                    className={cn(
                        'flex h-11 shrink-0 items-center gap-1.5 rounded-control px-2 text-[14px] font-bold',
                        focusRing,
                    )}
                >
                    {pending !== null && <Spinner className="size-4" />}
                    Ganti akun
                    <ChevronDown
                        aria-hidden
                        className="size-4"
                        strokeWidth={2.4}
                    />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    sideOffset={6}
                    className="w-[min(20rem,calc(100vw-2rem))]"
                >
                    <AccountItems
                        accounts={accounts}
                        pending={pending}
                        onSelect={switchTo}
                    />
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
