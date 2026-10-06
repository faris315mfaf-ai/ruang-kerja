import { Fingerprint, Plus } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Button } from '@/components/ui/button';
import { KpiCard } from '@/components/ui/kpi-card';
import { Panel } from '@/components/ui/panel';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatRelative, formatTime } from '@/lib/format';
import { cn, focusRing } from '@/lib/utils';
import { AddDeviceDialog } from './add-device-dialog';
import { DeviceSheet } from './device-sheet';
import { deviceStatus, punchesToday, unmappedCount } from './lib';
import { DeviceStatusBadge } from './parts';
import type { FingerprintPageProps } from './types';
import type { FingerprintState } from './use-fingerprint';

/** Desktop/tablet admin of ZKTeco devices (table + detail side panel). */
export function FingerprintDesktop({
    props,
    state,
}: {
    props: FingerprintPageProps;
    state: FingerprintState;
}) {
    const [addOpen, setAddOpen] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected =
        state.devices.find((device) => device.id === selectedId) ?? null;
    const online = state.devices.filter(
        (device) => deviceStatus(device, props.now) === 'online',
    ).length;
    const today = punchesToday(state.punches, props.now);
    const unmapped = unmappedCount(state.mappings);
    const lastPush = state.devices
        .map((device) => device.last_push_at)
        .filter((value): value is string => value !== null)
        .sort()
        .at(-1);

    return (
        <div className="flex flex-col gap-6">
            <section className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-h1">Mesin absensi</h1>
                    <p className="text-[16px] text-text-muted">
                        Mesin fingerprint ZKTeco yang mengirim log lewat ADMS.
                        Log masuk sebagai absensi dengan metode sidik jari.
                    </p>
                </div>
                <Button size="lg" onClick={() => setAddOpen(true)}>
                    <Plus aria-hidden />
                    Tambah mesin
                </Button>
            </section>

            <section
                aria-label="Ringkasan mesin"
                className="grid grid-cols-2 gap-5 xl:grid-cols-4"
            >
                <KpiCard
                    tone="highlight"
                    label="Mesin online"
                    value={`${online}/${state.devices.length}`}
                    note="push dalam 5 menit terakhir"
                />
                <KpiCard
                    label="Log masuk hari ini"
                    value={today.length}
                    note={`dari ${new Set(today.map((item) => item.device_id)).size} mesin`}
                />
                <KpiCard
                    label="PIN belum dipetakan"
                    value={unmapped}
                    valueClassName={unmapped > 0 ? 'text-warning' : undefined}
                    note={
                        unmapped > 0
                            ? 'log-nya belum masuk absensi'
                            : 'semua PIN terpetakan'
                    }
                />
                <KpiCard
                    label="Push terakhir"
                    value={lastPush ? formatTime(lastPush) : '–'}
                    note={
                        lastPush
                            ? formatRelative(lastPush, props.now)
                            : 'belum ada push'
                    }
                />
            </section>

            <Panel flush title="Daftar mesin" className="pb-2">
                {state.devices.length === 0 ? (
                    <div className="px-6 pb-4 md:px-7">
                        <EmptyState
                            size="sm"
                            icon={Fingerprint}
                            title="Belum ada mesin"
                            description="Tambahkan mesin ZKTeco pertama lalu atur alamat server ADMS di mesin."
                            action={
                                <Button
                                    variant="tonal"
                                    onClick={() => setAddOpen(true)}
                                >
                                    <Plus aria-hidden />
                                    Tambah mesin
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6 md:pl-7">
                                    Mesin
                                </TableHead>
                                <TableHead>Lokasi</TableHead>
                                <TableHead className="hidden xl:table-cell">
                                    Alamat IP
                                </TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Push terakhir</TableHead>
                                <TableHead className="text-right">
                                    Pengguna
                                </TableHead>
                                <TableHead className="pr-6 md:pr-7">
                                    <span className="sr-only">Aksi</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {state.devices.map((device) => {
                                const status = deviceStatus(device, props.now);
                                const pending = unmappedCount(
                                    state.mappings,
                                    device.id,
                                );

                                return (
                                    <TableRow key={device.id}>
                                        <TableCell className="pl-6 md:pl-7">
                                            <span className="flex flex-col">
                                                <span className="font-semibold">
                                                    {device.name}
                                                </span>
                                                <span className="font-mono text-[13px] text-text-muted">
                                                    {device.serial_number}
                                                </span>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {device.office_location.name}
                                        </TableCell>
                                        <TableCell className="hidden font-mono text-[14px] xl:table-cell">
                                            {device.ip_address ?? '–'}
                                        </TableCell>
                                        <TableCell>
                                            <DeviceStatusBadge
                                                status={status}
                                            />
                                        </TableCell>
                                        <TableCell className="text-text-muted">
                                            {device.last_push_at
                                                ? formatRelative(
                                                      device.last_push_at,
                                                      props.now,
                                                  )
                                                : 'belum pernah'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="flex flex-col items-end">
                                                <span className="font-semibold tnum">
                                                    {device.users_count}
                                                </span>
                                                {pending > 0 && (
                                                    <span className="text-[13px] font-semibold text-warning">
                                                        {pending} belum
                                                        dipetakan
                                                    </span>
                                                )}
                                            </span>
                                        </TableCell>
                                        <TableCell className="pr-6 text-right md:pr-7">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setSelectedId(device.id)
                                                }
                                                aria-label={`Detail ${device.name}`}
                                                className={cn(
                                                    'inline-flex min-h-11 items-center rounded-control px-3 text-[15px] font-semibold text-link transition-colors duration-120 ease-brand hover:bg-link-soft',
                                                    focusRing,
                                                )}
                                            >
                                                Detail
                                            </button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </Panel>

            <AddDeviceDialog
                open={addOpen}
                onOpenChange={setAddOpen}
                devices={state.devices}
                locations={props.locations}
                processing={state.processing}
                onAdd={state.addDevice}
            />
            <DeviceSheet
                device={selected}
                now={props.now}
                employees={props.employees}
                state={state}
                onOpenChange={(open) => !open && setSelectedId(null)}
            />
        </div>
    );
}
