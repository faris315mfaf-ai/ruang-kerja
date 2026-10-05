import { ChevronDown, Send } from 'lucide-react';
import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { CHANNEL_ICONS } from '@/features/notifications/settings/channel-icons';
import {
    Card,
    DigestCard,
    EmailNote,
    QuietHoursCard,
} from '@/features/notifications/settings/parts';
import type {
    ChannelKey,
    MatrixRow,
    NotificationSettingsProps,
} from '@/features/notifications/settings/types';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';
import { enabledSummary } from '@/features/notifications/settings/use-notification-settings';
import { cn } from '@/lib/utils';

type Props = {
    props: NotificationSettingsProps;
    state: NotificationSettingsState;
    firstName: string;
};

function EventRow({
    row,
    props,
    state,
    expanded,
    onToggle,
}: {
    row: MatrixRow;
    props: NotificationSettingsProps;
    state: NotificationSettingsState;
    expanded: boolean;
    onToggle: () => void;
}) {
    const labels = Object.fromEntries(
        props.channels.map((channel) => [channel.value, channel.label]),
    ) as Record<ChannelKey, string>;
    const panelId = `panel-${row.event}`;

    return (
        <li>
            <button
                type="button"
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={onToggle}
                className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left"
            >
                <span className="min-w-0 flex-1">
                    <span className="block text-[15px] text-text">
                        {row.label}
                    </span>
                    <span className="block text-[13px] text-text-muted">
                        {enabledSummary(row, labels)}
                    </span>
                </span>
                <ChevronDown
                    aria-hidden
                    className={cn(
                        'size-5 text-text-muted transition-transform duration-180 ease-brand',
                        expanded && 'rotate-180',
                    )}
                />
            </button>
            {expanded && (
                <ul
                    id={panelId}
                    className="mx-4 mb-3 divide-y divide-border rounded-lg border border-border"
                >
                    {props.channels.map((channel) => {
                        const cell = row.channels[channel.value];
                        const Icon = CHANNEL_ICONS[channel.value];

                        if (!cell.supported) {
                            return null;
                        }

                        return (
                            <li
                                key={channel.value}
                                className="flex min-h-14 items-center gap-3 px-3"
                            >
                                <Icon
                                    aria-hidden
                                    className="size-5 text-text-muted"
                                    strokeWidth={1.75}
                                />
                                <span
                                    className={cn(
                                        'flex-1 text-[15px]',
                                        channel.available
                                            ? 'text-text'
                                            : 'text-text-muted',
                                    )}
                                >
                                    {channel.label}
                                    {!channel.available && (
                                        <span className="ml-2 rounded-sm bg-info-soft px-1.5 py-0.5 text-xs text-info">
                                            Segera hadir
                                        </span>
                                    )}
                                    {channel.available &&
                                        !cell.configurable && (
                                            <span className="ml-2 text-xs text-text-muted">
                                                Selalu aktif
                                            </span>
                                        )}
                                </span>
                                <Switch
                                    size="md"
                                    checked={cell.enabled}
                                    disabled={!cell.configurable}
                                    aria-label={`${row.label} lewat ${channel.label}`}
                                    onCheckedChange={(checked) =>
                                        state.togglePreference(
                                            row.event,
                                            channel.value,
                                            checked,
                                        )
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
            )}
        </li>
    );
}

/** Accordion list (mockup MPengaturanNotifikasi). */
export function NotificationSettingsMobile({ props, state, firstName }: Props) {
    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div className="space-y-5 pb-4">
            <p className="text-sm text-text-muted">
                Pilih kejadian yang ingin Anda ketahui, dan lewat kanal apa.
                Ketuk kejadian untuk mengatur kanalnya.
            </p>

            {props.categories.map((category) => {
                const rows = state.matrix.filter(
                    (row) => row.category === category.value,
                );

                if (rows.length === 0) {
                    return null;
                }

                return (
                    <section key={category.value} className="space-y-2">
                        <h2 className="px-1 text-[13px] font-medium text-text-muted">
                            {category.label}
                        </h2>
                        <Card>
                            <ul className="divide-y divide-border">
                                {rows.map((row) => (
                                    <EventRow
                                        key={row.event}
                                        row={row}
                                        props={props}
                                        state={state}
                                        expanded={expanded === row.event}
                                        onToggle={() =>
                                            setExpanded(
                                                expanded === row.event
                                                    ? null
                                                    : row.event,
                                            )
                                        }
                                    />
                                ))}
                            </ul>
                        </Card>
                    </section>
                );
            })}

            <DigestCard
                state={state}
                props={props}
                firstName={firstName}
                variant="mobile"
            />
            <QuietHoursCard state={state} props={props} variant="mobile" />

            <button
                type="button"
                onClick={state.sendTest}
                disabled={state.sendingTest}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg border border-border bg-surface text-[15px] font-medium text-text disabled:opacity-50"
            >
                <Send aria-hidden className="size-4.5" strokeWidth={1.75} />
                Kirim notifikasi uji
            </button>

            <EmailNote email={props.email} className="px-1 text-[13px]" />
        </div>
    );
}
