import { Info, Send } from 'lucide-react';
import { Fragment } from 'react';
import { ThemeSegmented } from '@/components/shell/theme-segmented';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CHANNEL_ICONS } from '@/features/notifications/settings/channel-icons';
import {
    AccountNav,
    Card,
    DigestCard,
    EmailNote,
    QuietHoursCard,
} from '@/features/notifications/settings/parts';
import { SaveIndicator } from '@/features/notifications/settings/save-indicator';
import type { NotificationSettingsProps } from '@/features/notifications/settings/types';
import type { NotificationSettingsState } from '@/features/notifications/settings/use-notification-settings';
import { cn } from '@/lib/utils';

type Props = {
    props: NotificationSettingsProps;
    state: NotificationSettingsState;
    firstName: string;
};

/** Event × channel matrix (mockup PengaturanNotifikasi). */
export function NotificationSettingsDesktop({
    props,
    state,
    firstName,
}: Props) {
    return (
        <div className="flex gap-8">
            <AccountNav />

            <div className="min-w-0 flex-1 space-y-5">
                <header className="flex flex-wrap items-end gap-3">
                    <div className="min-w-0 flex-1">
                        <h1 className="text-xl leading-7 font-semibold text-text">
                            Notifikasi
                        </h1>
                        <p className="mt-0.5 text-[13px] text-text-muted">
                            Pilih kejadian yang ingin Anda ketahui, dan lewat
                            kanal apa.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={state.sendTest}
                        disabled={state.sendingTest}
                    >
                        <Send />
                        Kirim notifikasi uji
                    </Button>
                    <SaveIndicator />
                </header>

                <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-5">
                        <Card className="overflow-hidden">
                            <table className="w-full text-[13px]">
                                <caption className="sr-only">
                                    Kejadian dan kanal notifikasi
                                </caption>
                                <thead className="border-b border-border bg-surface-2">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-left font-medium text-text-muted"
                                        >
                                            Kejadian
                                        </th>
                                        {props.channels.map((channel) => {
                                            const Icon =
                                                CHANNEL_ICONS[channel.value];

                                            return (
                                                <th
                                                    key={channel.value}
                                                    scope="col"
                                                    className={cn(
                                                        'w-24 px-2 py-2 text-center font-medium',
                                                        channel.available
                                                            ? 'text-text-muted'
                                                            : 'text-text-subtle',
                                                    )}
                                                >
                                                    <span className="flex flex-col items-center gap-0.5">
                                                        <Icon
                                                            aria-hidden
                                                            className="size-4"
                                                            strokeWidth={1.75}
                                                        />
                                                        {channel.label}
                                                        {!channel.available && (
                                                            <span className="rounded-sm bg-warning-soft px-1.5 text-[11px] text-warning">
                                                                Segera hadir
                                                            </span>
                                                        )}
                                                    </span>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {props.categories.map((category) => {
                                        const rows = state.matrix.filter(
                                            (row) =>
                                                row.category === category.value,
                                        );

                                        if (rows.length === 0) {
                                            return null;
                                        }

                                        return (
                                            <Fragment key={category.value}>
                                                <tr>
                                                    <th
                                                        scope="rowgroup"
                                                        colSpan={
                                                            props.channels
                                                                .length + 1
                                                        }
                                                        className="px-4 pt-4 pb-1 text-left text-[11px] font-medium tracking-[.04em] text-text-muted uppercase"
                                                    >
                                                        {category.label}
                                                    </th>
                                                </tr>
                                                {rows.map((row) => (
                                                    <tr
                                                        key={row.event}
                                                        className="border-b border-border last:border-b-0"
                                                    >
                                                        <th
                                                            scope="row"
                                                            className="px-4 py-2.5 text-left font-normal text-text"
                                                        >
                                                            {row.label}
                                                        </th>
                                                        {props.channels.map(
                                                            (channel) => {
                                                                const cell =
                                                                    row
                                                                        .channels[
                                                                        channel
                                                                            .value
                                                                    ];
                                                                const locked =
                                                                    cell.supported &&
                                                                    channel.available &&
                                                                    !cell.configurable;

                                                                return (
                                                                    <td
                                                                        key={
                                                                            channel.value
                                                                        }
                                                                        className={cn(
                                                                            'px-2 py-2.5 text-center',
                                                                            !channel.available &&
                                                                                'bg-surface-2/60',
                                                                        )}
                                                                    >
                                                                        {cell.supported && (
                                                                            <Checkbox
                                                                                checked={
                                                                                    cell.enabled
                                                                                }
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
                                                                                        checked ===
                                                                                            true,
                                                                                    )
                                                                                }
                                                                            />
                                                                        )}
                                                                    </td>
                                                                );
                                                            },
                                                        )}
                                                    </tr>
                                                ))}
                                            </Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="flex gap-2 border-t border-border px-4 py-3">
                                <Info
                                    aria-hidden
                                    className="mt-0.5 size-4 shrink-0 text-text-muted"
                                />
                                <EmailNote email={props.email} />
                            </div>
                        </Card>

                        <QuietHoursCard
                            state={state}
                            props={props}
                            variant="desktop"
                        />
                    </div>

                    <div className="space-y-5">
                        <DigestCard
                            state={state}
                            props={props}
                            firstName={firstName}
                            variant="desktop"
                        />
                        <Card className="p-4">
                            <h2 className="text-[13px] font-medium text-text">
                                Tampilan
                            </h2>
                            <p className="mt-0.5 text-xs text-text-muted">
                                Disimpan ke akun Anda.
                            </p>
                            <div className="mt-4 flex items-center justify-between gap-3">
                                <span className="text-[13px] text-text">
                                    Tema
                                </span>
                                <ThemeSegmented size="sm" />
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
