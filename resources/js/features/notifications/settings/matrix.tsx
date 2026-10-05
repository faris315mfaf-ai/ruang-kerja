import { Fragment } from 'react';
import { Switch } from '@/components/ui/switch';
import type {
    CategoryInfo,
    ChannelInfo,
} from '@/features/notifications/settings/types';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';
import { cn } from '@/lib/utils';

/**
 * Event × channel switches (SPengaturan "Notifikasi" table, MSPengaturan
 * rows): header row on the page background, 60px rows with a divider, one
 * switch per channel. Channels that are not available yet show "Fase 2"
 * instead of switches. `categories` limits the table to those groups (the
 * phone renders one table per group under an overline heading).
 */
export function NotificationMatrix({
    state,
    channels,
    categories,
    showGroupHeadings = true,
}: {
    state: NotificationSettingsState;
    channels: ChannelInfo[];
    categories: CategoryInfo[];
    showGroupHeadings?: boolean;
}) {
    return (
        <table className="w-full table-fixed border-collapse text-left">
            <caption className="sr-only">Kejadian dan kanal notifikasi</caption>
            <colgroup>
                <col />
                {channels.map((channel) => (
                    <col
                        key={channel.value}
                        className={cn(
                            channel.available
                                ? 'w-[68px] md:w-24'
                                : 'w-[60px] md:w-[120px]',
                        )}
                    />
                ))}
            </colgroup>
            <thead>
                <tr className="bg-background text-meta font-bold text-text-muted">
                    <th scope="col" className="py-2.5 pr-2 pl-4 md:pl-7">
                        Kejadian
                    </th>
                    {channels.map((channel, index) => (
                        <th
                            key={channel.value}
                            scope="col"
                            className={cn(
                                'px-1 py-2.5 text-center',
                                index === channels.length - 1 && 'pr-4 md:pr-7',
                            )}
                        >
                            {channel.value === 'in_app'
                                ? 'Aplikasi'
                                : channel.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {categories.map((category) => {
                    const rows = state.matrix.filter(
                        (row) => row.category === category.value,
                    );

                    if (rows.length === 0) {
                        return null;
                    }

                    return (
                        <Fragment key={category.value}>
                            {showGroupHeadings && (
                                <tr className="border-t border-divider">
                                    <th
                                        scope="rowgroup"
                                        colSpan={channels.length + 1}
                                        className="px-4 pt-4 pb-1 text-overline text-text-muted md:px-7"
                                    >
                                        {category.label}
                                    </th>
                                </tr>
                            )}
                            {rows.map((row) => (
                                <tr
                                    key={row.event}
                                    className="border-t border-divider"
                                >
                                    <th
                                        scope="row"
                                        className="h-[60px] py-2 pr-2 pl-4 text-body font-medium text-text md:pl-7"
                                    >
                                        {row.label}
                                    </th>
                                    {channels.map((channel, index) => {
                                        const cell =
                                            row.channels[channel.value];
                                        const locked =
                                            cell.supported &&
                                            channel.available &&
                                            !cell.configurable;

                                        return (
                                            <td
                                                key={channel.value}
                                                className={cn(
                                                    'px-1 py-2 text-center align-middle',
                                                    index ===
                                                        channels.length - 1 &&
                                                        'pr-4 md:pr-7',
                                                )}
                                            >
                                                {!channel.available ? (
                                                    <span className="text-meta font-bold text-text-subtle">
                                                        Fase 2
                                                    </span>
                                                ) : cell.supported ? (
                                                    <Switch
                                                        size="md"
                                                        checked={cell.enabled}
                                                        disabled={
                                                            !cell.configurable
                                                        }
                                                        title={
                                                            locked
                                                                ? 'Selalu aktif'
                                                                : undefined
                                                        }
                                                        aria-label={`${row.label} lewat ${channel.label}${locked ? ' (selalu aktif)' : ''}`}
                                                        onCheckedChange={(
                                                            checked,
                                                        ) =>
                                                            state.togglePreference(
                                                                row.event,
                                                                channel.value,
                                                                checked,
                                                            )
                                                        }
                                                    />
                                                ) : (
                                                    <span
                                                        className="text-text-subtle"
                                                        aria-label="Tidak tersedia"
                                                    >
                                                        –
                                                    </span>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </Fragment>
                    );
                })}
            </tbody>
        </table>
    );
}
