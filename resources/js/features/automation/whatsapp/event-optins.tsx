import { Link } from '@inertiajs/react';
import { BellOff, Check, Minus, Zap } from 'lucide-react';
import { Fragment } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import type { EventCategory, WhatsappEvent } from '@/features/automation/types';
import type { WhatsappState } from '@/features/automation/whatsapp/use-whatsapp';
import { cn, focusRing } from '@/lib/utils';

export const CATEGORY_LABELS: Record<EventCategory, string> = {
    tasks: 'Tugas',
    requests: 'Pengajuan',
    attendance: 'Absensi',
    digest: 'Ringkasan',
};

const ORDER: EventCategory[] = ['tasks', 'requests', 'attendance', 'digest'];

export function groupEvents(events: WhatsappEvent[]) {
    return ORDER.map((category) => ({
        category,
        label: CATEGORY_LABELS[category],
        events: events.filter((e) => e.category === category),
    })).filter((group) => group.events.length > 0);
}

function ChannelMark({ on, channel }: { on: boolean; channel: string }) {
    return on ? (
        <Check
            role="img"
            aria-label={`${channel}: aktif`}
            className="mx-auto size-5 text-success"
            strokeWidth={2.4}
        />
    ) : (
        <Minus
            role="img"
            aria-label={`${channel}: mati`}
            className="mx-auto size-5 text-text-subtle"
            strokeWidth={2.4}
        />
    );
}

function HighPriority() {
    return (
        <span className="inline-flex items-center gap-1 text-meta font-semibold text-warning">
            <Zap aria-hidden className="size-3.5" strokeWidth={2.4} />
            Tetap dikirim saat jam tenang
        </span>
    );
}

const EDIT_LINK = (
    <Link
        href="/pengaturan/notifikasi"
        className={cn(
            'inline-flex min-h-control items-center rounded-control font-semibold text-link hover:opacity-80',
            focusRing,
        )}
    >
        Ubah aplikasi & email di Notifikasi
    </Link>
);

function NoEvents() {
    return (
        <EmptyState
            size="sm"
            icon={BellOff}
            title="Belum ada kejadian untuk WhatsApp"
            description="Super Admin belum menyetujui template pesan. Notifikasi tetap lewat aplikasi dan email."
            className="mx-5 md:mx-7"
        />
    );
}

/**
 * "Kirim lewat WhatsApp" (SPengaturan matrix, WhatsApp column live):
 * Aplikasi/Email are read-only marks, WhatsApp is the opt-in switch.
 */
export function EventOptinsTable({ wa }: { wa: WhatsappState }) {
    const connected = wa.settings.status === 'connected';
    const groups = groupEvents(wa.settings.events);

    return (
        <Panel
            title="Kirim lewat WhatsApp"
            action={
                <span className="text-[15px] text-text-muted">
                    {connected
                        ? `${wa.settings.events.filter((e) => e.whatsapp).length} kejadian aktif`
                        : 'Mati sampai terhubung'}
                </span>
            }
            flush
            className="pb-2"
        >
            {groups.length === 0 ? (
                <NoEvents />
            ) : (
                <table className="w-full table-fixed border-collapse text-left">
                    <caption className="sr-only">
                        Kejadian dan kanal notifikasi, kolom WhatsApp bisa
                        diubah
                    </caption>
                    <colgroup>
                        <col />
                        <col className="w-24" />
                        <col className="w-24" />
                        <col className="w-[120px]" />
                    </colgroup>
                    <thead>
                        <tr className="bg-background text-meta font-bold text-text-muted">
                            <th scope="col" className="py-2.5 pr-2 pl-7">
                                Kejadian
                            </th>
                            <th scope="col" className="px-1 py-2.5 text-center">
                                Aplikasi
                            </th>
                            <th scope="col" className="px-1 py-2.5 text-center">
                                Email
                            </th>
                            <th
                                scope="col"
                                className="py-2.5 pr-7 pl-1 text-center"
                            >
                                WhatsApp
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {groups.map((group) => (
                            <Fragment key={group.category}>
                                <tr className="border-t border-divider">
                                    <th
                                        scope="rowgroup"
                                        colSpan={4}
                                        className="px-7 pt-4 pb-1 text-overline text-text-muted"
                                    >
                                        {group.label}
                                    </th>
                                </tr>
                                {group.events.map((event) => (
                                    <tr
                                        key={event.event}
                                        className="border-t border-divider"
                                    >
                                        <th
                                            scope="row"
                                            className="py-3 pr-2 pl-7 align-middle font-normal"
                                        >
                                            <span className="block text-body font-medium text-text">
                                                {event.label}
                                            </span>
                                            <span className="block text-meta text-text-muted">
                                                {event.description}
                                            </span>
                                            {event.high_priority && (
                                                <HighPriority />
                                            )}
                                        </th>
                                        <td className="px-1 text-center">
                                            <ChannelMark
                                                on={event.in_app}
                                                channel="Aplikasi"
                                            />
                                        </td>
                                        <td className="px-1 text-center">
                                            <ChannelMark
                                                on={event.email}
                                                channel="Email"
                                            />
                                        </td>
                                        <td className="py-2 pr-7 pl-1 text-center">
                                            <Switch
                                                size="md"
                                                checked={
                                                    connected && event.whatsapp
                                                }
                                                disabled={!connected}
                                                title={
                                                    connected
                                                        ? undefined
                                                        : 'Hubungkan nomor dulu'
                                                }
                                                aria-label={`${event.label} lewat WhatsApp`}
                                                onCheckedChange={(on) =>
                                                    wa.toggleEvent(
                                                        event.event,
                                                        on,
                                                    )
                                                }
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </Fragment>
                        ))}
                    </tbody>
                </table>
            )}
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-divider px-7 pt-3 text-label font-normal text-text-muted">
                <span>
                    {connected
                        ? 'Pilihan WhatsApp tersimpan otomatis.'
                        : 'Hubungkan nomor untuk menyalakan kolom WhatsApp.'}
                </span>
                {EDIT_LINK}
            </div>
        </Panel>
    );
}

/** Phone version (MSPengaturan rows): one card per group, switch per row. */
export function EventOptinsList({ wa }: { wa: WhatsappState }) {
    const connected = wa.settings.status === 'connected';
    const groups = groupEvents(wa.settings.events);

    if (groups.length === 0) {
        return <NoEvents />;
    }

    return (
        <div className="flex flex-col gap-3.5">
            {!connected && (
                <p className="px-1 text-[15px] leading-[22px] text-text-muted">
                    Hubungkan nomor dulu untuk memilih kejadian.
                </p>
            )}
            {groups.map((group) => (
                <section key={group.category} className="flex flex-col gap-2">
                    <h3 className="px-1 text-overline text-text-muted">
                        {group.label}
                    </h3>
                    <div className="divide-y divide-divider overflow-hidden rounded-[22px] border border-border bg-surface">
                        {group.events.map((event) => (
                            <div
                                key={event.event}
                                className="flex min-h-[64px] items-center gap-3 px-4 py-3"
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="text-body font-medium text-text">
                                        {event.label}
                                    </p>
                                    <p className="text-meta text-text-muted">
                                        {[
                                            event.in_app && 'Aplikasi',
                                            event.email && 'Email',
                                        ]
                                            .filter(Boolean)
                                            .join(' · ') ||
                                            'Tidak ada kanal lain'}
                                    </p>
                                    {event.high_priority && <HighPriority />}
                                </div>
                                <Switch
                                    size="md"
                                    checked={connected && event.whatsapp}
                                    disabled={!connected}
                                    aria-label={`${event.label} lewat WhatsApp`}
                                    onCheckedChange={(on) =>
                                        wa.toggleEvent(event.event, on)
                                    }
                                />
                            </div>
                        ))}
                    </div>
                </section>
            ))}
            <div className="px-1 text-[15px]">{EDIT_LINK}</div>
        </div>
    );
}
