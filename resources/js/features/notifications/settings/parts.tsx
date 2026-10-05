import { Deferred, Link, usePage } from '@inertiajs/react';
import { Clock, Eye, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';
import { displayTime } from '@/features/notifications/settings/use-notification-settings';
import type {
    DigestPreview,
    NotificationSettingsProps,
} from '@/features/notifications/settings/types';
import { formatDate } from '@/lib/format';
import { hasAnyRole } from '@/lib/roles';
import { cn } from '@/lib/utils';

export const DIGEST_PREVIEW_URL = '/pengaturan/notifikasi/pratinjau-ringkasan';

export function Card({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            className={cn(
                'rounded-lg border border-border bg-surface shadow-card',
                className,
            )}
        >
            {children}
        </section>
    );
}

/** Label + description + switch row used by digest and quiet-hours cards. */
export function SwitchRow({
    title,
    description,
    checked,
    onChange,
    size,
}: {
    title: string;
    description: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
    size?: 'sm' | 'md';
}) {
    const id = useId();

    return (
        <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
                <p
                    id={`${id}-label`}
                    className="text-sm font-medium text-text md:text-[13px]"
                >
                    {title}
                </p>
                <p
                    id={`${id}-description`}
                    className="mt-0.5 text-[13px] text-text-muted md:text-xs"
                >
                    {description}
                </p>
            </div>
            <Switch
                size={size}
                checked={checked}
                onCheckedChange={onChange}
                aria-labelledby={`${id}-label`}
                aria-describedby={`${id}-description`}
            />
        </div>
    );
}

function TimeField({
    value,
    onCommit,
    large,
}: {
    value: string;
    onCommit: (value: string) => void;
    large?: boolean;
}) {
    const id = useId();

    return (
        <label
            htmlFor={id}
            className={cn(
                'flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3 focus-within:ring-2 focus-within:ring-ring',
                large ? 'h-12' : 'h-9',
            )}
        >
            <Clock
                aria-hidden
                className="size-4 text-text-muted"
                strokeWidth={1.75}
            />
            <span className="sr-only">Jam kirim ringkasan</span>
            <input
                id={id}
                type="time"
                step={300}
                defaultValue={value}
                key={value}
                onBlur={(event) => {
                    const next = event.target.value;

                    if (/^\d{2}:\d{2}$/.test(next) && next !== value) {
                        onCommit(next);
                    }
                }}
                className={cn(
                    'w-[5.5rem] bg-transparent font-mono text-text outline-none [&::-webkit-calendar-picker-indicator]:hidden',
                    large ? 'text-lg' : 'text-[13px]',
                )}
            />
            <span className="text-xs text-text-muted">WIB</span>
        </label>
    );
}

const dotTone = (tone: string) =>
    tone === 'danger' ? 'bg-danger' : 'bg-primary';

function PreviewBody({
    preview,
    firstName,
}: {
    preview?: DigestPreview;
    firstName: string;
}) {
    if (!preview) {
        return null;
    }

    return (
        <div className="space-y-2 p-3 text-xs leading-5">
            <p className="text-[13px] font-semibold text-text">
                Selamat pagi, {firstName}
            </p>
            {preview.sections.length === 0 ? (
                <p className="text-text-muted">
                    Belum ada yang perlu dikirim hari ini. Ringkasan tidak
                    dikirim bila kosong.
                </p>
            ) : (
                <ul className="space-y-2">
                    {preview.sections.map((section) => (
                        <li key={section.key} className="flex gap-2">
                            <span
                                aria-hidden
                                className={cn(
                                    'mt-1.5 size-1.5 shrink-0 rounded-full',
                                    dotTone(section.tone),
                                )}
                            />
                            <span className="text-text">
                                <strong className="font-semibold">
                                    {section.title}
                                </strong>
                                {section.items.length > 0 && ': '}
                                {section.items.map((item, index) => (
                                    <span key={index}>
                                        {index > 0 && ', '}
                                        {item.code && (
                                            <span className="font-mono text-text-muted">
                                                {item.code}{' '}
                                            </span>
                                        )}
                                        {item.title}
                                    </span>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
            <a
                href={DIGEST_PREVIEW_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-primary underline"
            >
                Buka versi email
            </a>
        </div>
    );
}

/** "Ringkasan harian" card: toggle, send time, today's preview (mockup PengaturanNotifikasi). */
export function DigestCard({
    state,
    props,
    firstName,
    variant,
}: {
    state: NotificationSettingsState;
    props: NotificationSettingsProps;
    firstName: string;
    variant: 'desktop' | 'mobile';
}) {
    const mobile = variant === 'mobile';
    const { settings } = state;

    return (
        <Card className="p-4">
            <SwitchRow
                title="Ringkasan harian"
                description="Satu email setiap hari kerja, berisi yang perlu Anda tindak lanjuti."
                checked={settings.digest_enabled}
                onChange={state.setDigestEnabled}
                size={mobile ? 'md' : 'sm'}
            />
            <div
                className={cn(
                    'mt-4 flex items-center justify-between gap-3',
                    mobile && 'border-t border-border pt-4',
                )}
            >
                <span className="text-sm text-text md:text-[13px]">
                    Jam kirim
                </span>
                <TimeField
                    value={settings.digest_time}
                    onCommit={(digest_time) =>
                        state.updateSettings({ digest_time })
                    }
                    large={mobile}
                />
            </div>
            {!settings.digest_enabled && (
                <p className="mt-2 text-xs text-text-muted">
                    Ringkasan nonaktif. Jam kirim tetap disimpan.
                </p>
            )}
            {mobile ? (
                <a
                    href={DIGEST_PREVIEW_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 flex min-h-11 items-center gap-2 text-[15px] font-medium text-primary"
                >
                    <Eye aria-hidden className="size-4.5" />
                    Lihat contoh email hari ini
                </a>
            ) : (
                <div className="mt-4 overflow-hidden rounded-md border border-border bg-surface-2">
                    <p className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-text-muted">
                        <Mail aria-hidden className="size-3.5" />
                        Pratinjau · {formatDate(new Date())} ·{' '}
                        {displayTime(settings.digest_time)}
                    </p>
                    <Deferred
                        data="digestPreview"
                        fallback={
                            <div className="space-y-2 p-3">
                                <Skeleton className="h-4 w-1/2" />
                                <Skeleton className="h-3 w-full" />
                                <Skeleton className="h-3 w-3/4" />
                            </div>
                        }
                    >
                        <PreviewBody
                            preview={props.digestPreview}
                            firstName={firstName}
                        />
                    </Deferred>
                </div>
            )}
        </Card>
    );
}

/** "Jam tenang" card. */
export function QuietHoursCard({
    state,
    props,
    variant,
}: {
    state: NotificationSettingsState;
    props: NotificationSettingsProps;
    variant: 'desktop' | 'mobile';
}) {
    const range = `${displayTime(props.quietWindow.start)}–${displayTime(props.quietWindow.end)}`;
    const size = variant === 'mobile' ? 'md' : 'sm';

    return (
        <Card className="divide-y divide-border px-4">
            {variant === 'mobile' && (
                <h2 className="pt-4 pb-1 text-[17px] font-semibold text-text">
                    Jam tenang
                </h2>
            )}
            <div className="py-4">
                <SwitchRow
                    title={
                        variant === 'mobile'
                            ? 'Di luar jam kerja'
                            : 'Jam tenang di luar jam kerja'
                    }
                    description={
                        <>
                            Tahan notifikasi email{' '}
                            <span className="font-mono">{range}</span> dan akhir
                            pekan; in-app tetap tercatat.
                        </>
                    }
                    checked={state.settings.quiet_hours}
                    onChange={(quiet_hours) =>
                        state.updateSettings({ quiet_hours })
                    }
                    size={size}
                />
            </div>
            <div className="py-4">
                <SwitchRow
                    title="Saat saya cuti, tahan semua notifikasi"
                    description="Hanya dicatat di Inbox, tanpa email dan toast. Persetujuan diteruskan ke pengganti bila delegasi aktif."
                    checked={state.settings.pause_while_on_leave}
                    onChange={(pause_while_on_leave) =>
                        state.updateSettings({ pause_while_on_leave })
                    }
                    size={size}
                />
            </div>
        </Card>
    );
}

export function EmailNote({
    email,
    className,
}: {
    email: string;
    className?: string;
}) {
    return (
        <p className={cn('text-xs leading-5 text-text-muted', className)}>
            Email dikirim ke <span className="font-mono">{email}</span>.
            Pengingat absensi mengikuti jadwal shift Anda.
        </p>
    );
}

/** Mirrors layouts/settings/layout.tsx (Keamanan only for the Super Admin emergency sign-in). */
export function accountLinks(roles: readonly string[]) {
    return [
        { title: 'Profil', href: '/settings/profile' },
        ...(hasAnyRole(roles, 'super_admin')
            ? [{ title: 'Keamanan', href: '/settings/security' }]
            : []),
        { title: 'Notifikasi', href: '/pengaturan/notifikasi' },
        { title: 'Tampilan', href: '/settings/appearance' },
        { title: 'Akun Google', href: '/settings/google' },
        { title: 'Privasi & data saya', href: '/privasi' },
    ];
}

/** Left "Akun saya" navigation (desktop). */
export function AccountNav() {
    const { auth } = usePage().props;

    return (
        <nav aria-label="Akun saya" className="w-48 shrink-0">
            <p className="px-2.5 pb-2 text-[11px] font-medium tracking-[.04em] text-text-muted uppercase">
                Akun saya
            </p>
            <ul className="space-y-0.5">
                {accountLinks(auth.roles).map((link) => {
                    const active = link.href === '/pengaturan/notifikasi';

                    return (
                        <li key={link.href}>
                            <Link
                                href={link.href}
                                prefetch
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                    'flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors duration-120 ease-brand hover:bg-surface-2',
                                    active
                                        ? 'bg-surface-2 font-medium text-text'
                                        : 'text-text-muted',
                                )}
                            >
                                {link.title}
                            </Link>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
