import { Deferred } from '@inertiajs/react';
import { Clock, Eye, Mail } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId } from 'react';
import { Panel } from '@/components/ui/panel';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';
import { displayTime } from '@/features/notifications/settings/use-notification-settings';
import type {
    DigestPreview,
    NotificationSettingsProps,
} from '@/features/notifications/settings/types';
import { formatDate, officeZoneLabel } from '@/lib/format';
import { cn } from '@/lib/utils';

export const DIGEST_PREVIEW_URL = '/pengaturan/notifikasi/pratinjau-ringkasan';

/** Label + description + switch row used by digest and quiet-hours cards. */
export function SwitchRow({
    title,
    description,
    checked,
    onChange,
}: {
    title: string;
    description: ReactNode;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    const id = useId();

    return (
        <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
                <p
                    id={`${id}-label`}
                    className="text-body font-semibold text-text"
                >
                    {title}
                </p>
                <p
                    id={`${id}-description`}
                    className="mt-0.5 text-label font-normal text-text-muted"
                >
                    {description}
                </p>
            </div>
            <Switch
                size="md"
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
                'flex h-11 items-center gap-2 rounded-control border border-border-strong bg-surface px-3.5 transition-[border-color,box-shadow] duration-120 ease-brand focus-within:border-primary focus-within:ring-4 focus-within:ring-ring/55',
                large && 'h-12',
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
                    'w-[7rem] bg-transparent font-mono font-semibold text-text tnum outline-none [&::-webkit-calendar-picker-indicator]:hidden',
                    large ? 'text-[17px]' : 'text-[15px]',
                )}
            />
            <span className="text-meta text-text-muted">
                {officeZoneLabel()}
            </span>
        </label>
    );
}

const dotTone = (tone: string) =>
    tone === 'danger' ? 'bg-fill-danger' : 'bg-fill-teal';

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
        <div className="flex flex-col gap-2 p-4 text-label font-normal">
            <p className="text-body font-bold text-text">
                Selamat pagi, {firstName}
            </p>
            {preview.sections.length === 0 ? (
                <p className="text-text-muted">
                    Belum ada yang perlu dikirim hari ini. Ringkasan tidak
                    dikirim bila kosong.
                </p>
            ) : (
                <ul className="flex flex-col gap-2">
                    {preview.sections.map((section) => (
                        <li key={section.key} className="flex gap-2">
                            <span
                                aria-hidden
                                className={cn(
                                    'mt-2 size-2 shrink-0 rounded-full',
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
                className="inline-flex min-h-control items-center self-start font-semibold text-link hover:opacity-80"
            >
                Buka versi email
            </a>
        </div>
    );
}

/** "Ringkasan harian" panel: toggle, send time, today's preview. */
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
        <Panel
            title="Ringkasan harian"
            action={
                <span className="text-label font-normal text-text-muted tnum">
                    {displayTime(settings.digest_time)} {officeZoneLabel()}
                </span>
            }
            bodyClassName="gap-4"
        >
            <SwitchRow
                title="Kirim email ringkasan"
                description="Satu email setiap hari kerja, berisi yang perlu Anda tindak lanjuti."
                checked={settings.digest_enabled}
                onChange={state.setDigestEnabled}
            />
            <div className="flex items-center justify-between gap-3 border-t border-divider pt-4">
                <span className="text-body font-semibold">Jam kirim</span>
                <TimeField
                    value={settings.digest_time}
                    onCommit={(digest_time) =>
                        state.updateSettings({ digest_time })
                    }
                    large={mobile}
                />
            </div>
            {!settings.digest_enabled && (
                <p className="-mt-2 text-meta font-normal text-text-muted">
                    Ringkasan nonaktif. Jam kirim tetap disimpan.
                </p>
            )}
            {mobile ? (
                <a
                    href={DIGEST_PREVIEW_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-control items-center gap-2 self-start text-label font-semibold text-link"
                >
                    <Eye aria-hidden className="size-5" />
                    Lihat contoh email hari ini
                </a>
            ) : (
                <div className="overflow-hidden rounded-lg border border-border bg-background">
                    <p className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-meta text-text-muted">
                        <Mail aria-hidden className="size-4" />
                        Pratinjau · {formatDate(new Date())} ·{' '}
                        {displayTime(settings.digest_time)}
                    </p>
                    <Deferred
                        data="digestPreview"
                        fallback={
                            <div className="flex flex-col gap-2 p-4">
                                <Skeleton className="h-5 w-1/2" />
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
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
        </Panel>
    );
}

/** "Jam tenang" panel. */
export function QuietHoursCard({
    state,
    props,
}: {
    state: NotificationSettingsState;
    props: NotificationSettingsProps;
}) {
    const range = `${displayTime(props.quietWindow.start)}–${displayTime(props.quietWindow.end)}`;

    return (
        <Panel title="Jam tenang" bodyClassName="divide-y divide-divider">
            <div className="pb-4">
                <SwitchRow
                    title="Di luar jam kerja"
                    description={
                        <>
                            Tahan notifikasi email{' '}
                            <span className="font-mono tnum">{range}</span> dan
                            akhir pekan; in-app tetap tercatat.
                        </>
                    }
                    checked={state.settings.quiet_hours}
                    onChange={(quiet_hours) =>
                        state.updateSettings({ quiet_hours })
                    }
                />
            </div>
            <div className="pt-4">
                <SwitchRow
                    title="Saat saya cuti, tahan semua notifikasi"
                    description="Hanya dicatat di Inbox, tanpa email dan toast. Persetujuan diteruskan ke pengganti bila delegasi aktif."
                    checked={state.settings.pause_while_on_leave}
                    onChange={(pause_while_on_leave) =>
                        state.updateSettings({ pause_while_on_leave })
                    }
                />
            </div>
        </Panel>
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
        <p
            className={cn(
                'text-label font-normal break-words text-text-muted',
                className,
            )}
        >
            Email dikirim ke <span className="font-semibold">{email}</span>.
            Pengingat absensi mengikuti jadwal shift Anda.
        </p>
    );
}
