import { Fingerprint, MapPin, Monitor, Users } from 'lucide-react';
import { EmptyState } from '@/components/empty-state';
import { KpiCard } from '@/components/ui/kpi-card';
import { formatRelative } from '@/lib/format';
import { deviceStatus, punchesToday, unmappedCount } from './lib';
import { DeviceStatusBadge } from './parts';
import type { FingerprintPageProps } from './types';
import type { FingerprintState } from './use-fingerprint';

/**
 * Phone: read-only list (docs/PLATFORM.md ◐). Adding devices, PIN mapping and
 * connection tests stay on desktop.
 */
export function FingerprintMobile({
    props,
    state,
}: {
    props: FingerprintPageProps;
    state: FingerprintState;
}) {
    const online = state.devices.filter(
        (device) => deviceStatus(device, props.now) === 'online',
    ).length;
    const unmapped = unmappedCount(state.mappings);

    return (
        <div className="flex flex-col gap-4">
            <p
                role="note"
                className="flex items-start gap-3 rounded-card border border-border bg-link-soft p-4 text-[15px] leading-[22px] text-link"
            >
                <Monitor aria-hidden className="mt-0.5 size-5 shrink-0" />
                <span>
                    <b className="font-bold">Kelola di desktop.</b> Tambah
                    mesin, pemetaan PIN, dan uji koneksi tersedia dari komputer.
                </span>
            </p>

            <section
                aria-label="Ringkasan mesin"
                className="grid grid-cols-2 gap-3"
            >
                <KpiCard
                    tone="highlight"
                    label="Online"
                    value={`${online}/${state.devices.length}`}
                    note="mesin"
                />
                <KpiCard
                    label="Log hari ini"
                    value={punchesToday(state.punches, props.now).length}
                    note={
                        unmapped > 0
                            ? `${unmapped} PIN belum dipetakan`
                            : 'semua terpetakan'
                    }
                />
            </section>

            {state.devices.length === 0 ? (
                <EmptyState
                    icon={Fingerprint}
                    title="Belum ada mesin"
                    description="Tambahkan mesin dari komputer."
                />
            ) : (
                <ul className="flex flex-col gap-3">
                    {state.devices.map((device) => {
                        const pending = unmappedCount(
                            state.mappings,
                            device.id,
                        );

                        return (
                            <li
                                key={device.id}
                                className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <span className="flex min-w-0 flex-col">
                                        <span className="text-[17px] font-bold">
                                            {device.name}
                                        </span>
                                        <span className="font-mono text-[13px] text-text-muted">
                                            {device.serial_number}
                                        </span>
                                    </span>
                                    <DeviceStatusBadge
                                        status={deviceStatus(device, props.now)}
                                    />
                                </div>
                                <span className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-text-muted">
                                    <span className="inline-flex items-center gap-1.5">
                                        <MapPin
                                            aria-hidden
                                            className="size-4"
                                        />
                                        {device.office_location.name}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <Users aria-hidden className="size-4" />
                                        {device.users_count} pengguna
                                    </span>
                                </span>
                                <span className="text-[14px] text-text-muted">
                                    {device.last_push_at
                                        ? `Push terakhir ${formatRelative(device.last_push_at, props.now)}`
                                        : 'Menunggu push pertama'}
                                    {pending > 0 && (
                                        <span className="font-semibold text-warning">
                                            {' '}
                                            · {pending} PIN belum dipetakan
                                        </span>
                                    )}
                                </span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
