import { CheckCircle2, Fingerprint, PlugZap, XCircle } from 'lucide-react';
import { useState } from 'react';
import { EmptyState } from '@/components/empty-state';
import { UserAvatar } from '@/components/shell/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Spinner } from '@/components/ui/spinner';
import { SegmentedTabs } from '@/components/ui/tabs';
import { formatDateTime, formatRelative, formatTime } from '@/lib/format';
import { AdmsInstructions } from './add-device-dialog';
import { DeviceStatusBadge } from './parts';
import { deviceStatus, TIMEZONES, unmappedCount, VERIFY_LABELS } from './lib';
import type { FingerprintDevice, PersonRef } from './types';
import type { FingerprintState } from './use-fingerprint';

const UNMAPPED = '__none__';

/** Device detail side panel: info, connection test, latest logs, PIN mapping. */
export function DeviceSheet({
    device,
    now,
    employees,
    state,
    onOpenChange,
}: {
    device: FingerprintDevice | null;
    now: string;
    employees: PersonRef[];
    state: FingerprintState;
    onOpenChange: (open: boolean) => void;
}) {
    const [tab, setTab] = useState<'log' | 'pin'>('log');

    return (
        <Sheet open={device !== null} onOpenChange={onOpenChange}>
            <SheetContent className="w-full gap-0 sm:max-w-[640px]">
                {device && (
                    <DeviceSheetBody
                        device={device}
                        now={now}
                        employees={employees}
                        state={state}
                        tab={tab}
                        onTab={setTab}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}

function DeviceSheetBody({
    device,
    now,
    employees,
    state,
    tab,
    onTab,
}: {
    device: FingerprintDevice;
    now: string;
    employees: PersonRef[];
    state: FingerprintState;
    tab: 'log' | 'pin';
    onTab: (tab: 'log' | 'pin') => void;
}) {
    const status = deviceStatus(device, now);
    const punches = state.punches.filter(
        (item) => item.device_id === device.id,
    );
    const mappings = state.mappings.filter(
        (item) => item.device_id === device.id,
    );
    const unmapped = unmappedCount(state.mappings, device.id);
    const test = state.tests[device.id];
    const testing = state.testing === device.id;
    const facts = [
        ['Nomor seri', device.serial_number],
        ['Model', device.model ?? '–'],
        ['Firmware', device.firmware ?? '–'],
        ['Alamat IP', device.ip_address ?? '–'],
        ['Lokasi', device.office_location.name],
        [
            'Zona waktu',
            TIMEZONES.find((zone) => zone.value === device.timezone)?.label ??
                device.timezone,
        ],
    ];

    return (
        <>
            <SheetHeader className="border-b border-border">
                <SheetTitle>{device.name}</SheetTitle>
                <SheetDescription className="flex flex-wrap items-center gap-2">
                    <DeviceStatusBadge status={status} />
                    <span>
                        {device.last_push_at
                            ? `push terakhir ${formatRelative(device.last_push_at, now)}`
                            : 'belum pernah mengirim log'}
                    </span>
                </SheetDescription>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                    {facts.map(([label, value]) => (
                        <div key={label} className="flex min-w-0 flex-col">
                            <dt className="text-[14px] text-text-muted">
                                {label}
                            </dt>
                            <dd
                                className={
                                    label === 'Nomor seri' ||
                                    label === 'Alamat IP'
                                        ? 'truncate font-mono text-[15px] font-semibold'
                                        : 'truncate text-[15px] font-semibold'
                                }
                            >
                                {value}
                            </dd>
                        </div>
                    ))}
                </dl>

                <section
                    aria-label="Uji koneksi"
                    className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="flex flex-col">
                            <span className="text-[16px] font-bold">
                                Uji koneksi
                            </span>
                            <span className="text-[14px] text-text-muted">
                                Kirim perintah ke mesin dan tunggu balasannya.
                            </span>
                        </span>
                        <Button
                            variant="outline"
                            disabled={testing || status === 'pending'}
                            onClick={() => void state.testConnection(device)}
                        >
                            {testing ? <Spinner /> : <PlugZap aria-hidden />}
                            {testing ? 'Menguji…' : 'Uji koneksi'}
                        </Button>
                    </div>
                    <p role="status" className="text-[14px] leading-5">
                        {status === 'pending' ? (
                            <span className="text-text-muted">
                                Uji koneksi tersedia setelah mesin mengirim push
                                pertama.
                            </span>
                        ) : test ? (
                            test.ok ? (
                                <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                                    <CheckCircle2
                                        aria-hidden
                                        className="size-4"
                                    />
                                    Terhubung pukul {formatTime(test.at)} ·
                                    respons 182 ms
                                </span>
                            ) : (
                                <span className="inline-flex items-start gap-1.5 font-semibold text-danger">
                                    <XCircle
                                        aria-hidden
                                        className="mt-0.5 size-4 shrink-0"
                                    />
                                    Tidak ada respons. Periksa kabel jaringan
                                    dan alamat server di mesin.
                                </span>
                            )
                        ) : null}
                    </p>
                </section>

                {status === 'pending' ? (
                    <section
                        aria-label="Pengaturan ADMS"
                        className="flex flex-col gap-3"
                    >
                        <h3 className="text-overline text-text-muted">
                            Pengaturan ADMS
                        </h3>
                        <AdmsInstructions serial={device.serial_number} />
                    </section>
                ) : (
                    <section className="flex flex-col gap-4">
                        <SegmentedTabs
                            label="Data mesin"
                            value={tab}
                            onValueChange={onTab}
                            options={[
                                { value: 'log', label: 'Log masuk' },
                                {
                                    value: 'pin',
                                    label: unmapped
                                        ? `Pemetaan PIN · ${unmapped} belum`
                                        : 'Pemetaan PIN',
                                },
                            ]}
                        />
                        {tab === 'log' ? (
                            punches.length === 0 ? (
                                <EmptyState
                                    size="sm"
                                    icon={Fingerprint}
                                    title="Belum ada log"
                                />
                            ) : (
                                <ul className="flex flex-col divide-y divide-divider">
                                    {punches.map((punch) => (
                                        <li
                                            key={punch.id}
                                            className="flex min-h-14 items-center gap-3 py-2"
                                        >
                                            <span className="w-14 shrink-0 font-mono text-[15px] font-semibold tnum">
                                                {formatTime(punch.punched_at)}
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span className="truncate text-[15px] font-semibold">
                                                    {punch.user?.name ?? (
                                                        <span className="text-warning">
                                                            Belum dipetakan
                                                        </span>
                                                    )}
                                                </span>
                                                <span className="text-[13px] text-text-muted">
                                                    PIN {punch.pin} ·{' '}
                                                    {
                                                        VERIFY_LABELS[
                                                            punch.verify_type
                                                        ]
                                                    }{' '}
                                                    ·{' '}
                                                    {formatDateTime(
                                                        punch.punched_at,
                                                    )}
                                                </span>
                                            </span>
                                            <Badge
                                                variant="status"
                                                tone={
                                                    punch.punch_state ===
                                                    'check_in'
                                                        ? 'success'
                                                        : 'info'
                                                }
                                                className="h-7 text-[13px]"
                                            >
                                                {punch.punch_state ===
                                                'check_in'
                                                    ? 'Masuk'
                                                    : 'Pulang'}
                                            </Badge>
                                        </li>
                                    ))}
                                </ul>
                            )
                        ) : (
                            <ul className="flex flex-col divide-y divide-divider">
                                {mappings.map((mapping) => (
                                    <li
                                        key={mapping.pin}
                                        className="grid grid-cols-[1fr_minmax(0,220px)] items-center gap-3 py-2.5"
                                    >
                                        <span className="flex min-w-0 items-center gap-3">
                                            {mapping.user ? (
                                                <UserAvatar
                                                    name={mapping.user.name}
                                                    className="size-8"
                                                />
                                            ) : (
                                                <span
                                                    aria-hidden
                                                    className="flex size-8 shrink-0 items-center justify-center rounded-full bg-warning-soft text-warning"
                                                >
                                                    <Fingerprint className="size-4" />
                                                </span>
                                            )}
                                            <span className="flex min-w-0 flex-col">
                                                <span className="font-mono text-[15px] font-semibold">
                                                    PIN {mapping.pin}
                                                </span>
                                                <span className="truncate text-[13px] text-text-muted">
                                                    di mesin:{' '}
                                                    {mapping.device_name}
                                                </span>
                                            </span>
                                        </span>
                                        <Select
                                            value={mapping.user?.id ?? UNMAPPED}
                                            onValueChange={(value) =>
                                                state.assignPin(
                                                    mapping,
                                                    employees.find(
                                                        (item) =>
                                                            item.id === value,
                                                    ) ?? null,
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                aria-label={`Karyawan untuk PIN ${mapping.pin}`}
                                                className={
                                                    mapping.user
                                                        ? 'w-full'
                                                        : 'w-full border-warning text-warning'
                                                }
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={UNMAPPED}>
                                                    Belum dipetakan
                                                </SelectItem>
                                                {employees.map((employee) => (
                                                    <SelectItem
                                                        key={employee.id}
                                                        value={employee.id}
                                                    >
                                                        {employee.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}
            </div>
        </>
    );
}
