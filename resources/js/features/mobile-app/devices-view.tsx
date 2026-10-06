import { Link } from '@inertiajs/react';
import {
    CircleAlert,
    RefreshCw,
    ScanFace,
    ShieldCheck,
    Smartphone,
    Trash2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Panel } from '@/components/ui/panel';
import { Switch } from '@/components/ui/switch';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { formatDate, formatRelative } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ConfirmAction } from './confirm-action';
import { NOW } from './fixtures';
import { PLATFORM_LABEL, integrityBadge } from './logic';
import type { Device } from './types';
import type { DevicesState } from './use-devices';

function DeviceGlyph({ device }: { device: Device }) {
    return (
        <span
            aria-hidden
            className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-[14px]',
                device.is_trusted
                    ? 'bg-grad-soft text-link'
                    : 'bg-danger-soft text-danger',
            )}
        >
            <Smartphone className="size-6" />
        </span>
    );
}

function IntegrityPill({ device }: { device: Device }) {
    const badge = integrityBadge(device.integrity_verdict);

    return (
        <Badge
            variant="status"
            tone={badge.tone}
            dot
            className="h-7 text-[14px]"
        >
            {badge.label}
        </Badge>
    );
}

function lastSeen(device: Device): string {
    return device.is_current
        ? 'Aktif sekarang'
        : formatRelative(device.last_seen_at, NOW);
}

/** Failed load (MFondasi "Gagal": plain words + retry). */
function LoadError({ state }: { state: DevicesState }) {
    return (
        <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-panel border border-border bg-surface px-6 py-9 text-center shadow-card"
        >
            <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full bg-danger-soft text-danger"
            >
                <CircleAlert className="size-7" />
            </span>
            <p className="text-[18px] font-bold">
                Daftar perangkat belum termuat
            </p>
            <p className="max-w-sm text-[15px] text-text-muted">
                Koneksi ke server terputus. Data Anda aman, coba muat lagi.
            </p>
            <Button
                variant="outline"
                onClick={state.retryLoad}
                disabled={state.reloading}
            >
                <RefreshCw
                    aria-hidden
                    className={cn(state.reloading && 'animate-spin')}
                />
                {state.reloading ? 'Memuat…' : 'Coba lagi'}
            </Button>
        </div>
    );
}

function NoDevices() {
    return (
        <EmptyState
            size="sm"
            icon={Smartphone}
            title="Belum ada perangkat ponsel"
            description="Pasang RuangKerja dari Play Store atau App Store, lalu masuk dengan akun Google kantor."
        />
    );
}

/** Face template + biometric consent (delete = revoke consent). */
function FaceData({ state, mobile }: { state: DevicesState; mobile: boolean }) {
    const { template, consent } = state;

    if (!template) {
        return (
            <div className="flex flex-col gap-3">
                <EmptyState
                    size="sm"
                    icon={ScanFace}
                    title="Belum ada data wajah"
                    description="Daftarkan wajah untuk check-in dengan pengenalan wajah di aplikasi ponsel."
                    action={
                        <Button variant="tonal" asChild>
                            <Link href="/absensi/wajah">Daftarkan wajah</Link>
                        </Button>
                    }
                />
                {consent?.revoked_at && (
                    <p className="text-[14px] text-text-muted">
                        Persetujuan biometrik {consent.version} dicabut{' '}
                        {formatDate(consent.revoked_at)}.
                    </p>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <dl className="flex flex-col divide-y divide-divider rounded-[18px] border border-border px-4">
                {[
                    ['Status', 'Terdaftar · hanya untuk check-in'],
                    ['Didaftarkan', formatDate(template.created_at)],
                    ['Model', template.model_version],
                    [
                        'Persetujuan',
                        consent
                            ? `Kebijakan ${consent.version} · ${formatDate(consent.granted_at)}`
                            : '—',
                    ],
                ].map(([term, value]) => (
                    <div
                        key={term}
                        className="flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 py-2 text-[16px]"
                    >
                        <dt className="text-text-muted">{term}</dt>
                        <dd className="font-semibold">{value}</dd>
                    </div>
                ))}
            </dl>
            <p className="flex gap-2 text-[15px] leading-[22px] text-text-muted">
                <ShieldCheck
                    aria-hidden
                    className="mt-0.5 size-5 shrink-0 text-success"
                />
                Disimpan terenkripsi. HR dan atasan tidak bisa melihat data
                wajah Anda.
            </p>
            <div
                className={cn('flex gap-2', mobile ? 'flex-col' : 'flex-wrap')}
            >
                <Button
                    variant="outline"
                    className={cn(mobile && 'w-full')}
                    asChild
                >
                    <Link href="/absensi/wajah">Daftarkan ulang</Link>
                </Button>
                <Button
                    variant="outline"
                    className={cn('text-danger', mobile && 'w-full')}
                    onClick={() => state.setConfirm({ kind: 'face' })}
                >
                    <Trash2 aria-hidden />
                    Hapus data wajah
                </Button>
            </div>
        </div>
    );
}

function Confirm({ state, mobile }: { state: DevicesState; mobile: boolean }) {
    const pending = state.confirm;
    const revoke = pending?.kind === 'revoke' ? pending.device : null;

    return (
        <ConfirmAction
            open={pending !== null}
            onOpenChange={(open) => !open && state.setConfirm(null)}
            mobile={mobile}
            busy={state.busy}
            onConfirm={state.runConfirm}
            title={revoke ? `Cabut ${revoke.name}?` : 'Hapus data wajah?'}
            description={
                revoke
                    ? revoke.is_current
                        ? 'Ini perangkat yang sedang Anda pakai. Sesi berakhir dan Anda harus masuk lagi dengan Google.'
                        : 'Sesi di perangkat itu langsung berakhir dan masuk biometrik dimatikan. Anda bisa masuk lagi kapan saja.'
                    : 'Template wajah dihapus permanen dan persetujuan biometrik dicabut. Check-in wajah tidak bisa dipakai sampai Anda mendaftar lagi.'
            }
            confirmLabel={
                revoke ? 'Cabut perangkat' : 'Hapus & cabut persetujuan'
            }
        />
    );
}

// --- Desktop ---------------------------------------------------------------------

export function DevicesDesktop({
    state,
    header,
    aside,
}: {
    state: DevicesState;
    header: ReactNode;
    aside: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-6">
            {header}
            <div className="flex min-w-0 flex-col gap-6">
                {state.loadError ? (
                    <LoadError state={state} />
                ) : (
                    <Panel
                        title="Perangkat tepercaya"
                        flush
                        action={
                            <span className="text-[15px] text-text-muted">
                                {state.devices.length} perangkat
                            </span>
                        }
                    >
                        {state.devices.length === 0 ? (
                            <div className="px-6 md:px-7">
                                <NoDevices />
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="pl-7">
                                            Perangkat
                                        </TableHead>
                                        <TableHead>Terakhir aktif</TableHead>
                                        <TableHead>Integritas</TableHead>
                                        <TableHead>Masuk biometrik</TableHead>
                                        <TableHead className="pr-7 text-right">
                                            <span className="sr-only">
                                                Aksi
                                            </span>
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {state.devices.map((device) => (
                                        <TableRow key={device.id}>
                                            <TableCell className="pl-7">
                                                <span className="flex items-center gap-3">
                                                    <DeviceGlyph
                                                        device={device}
                                                    />
                                                    <span className="flex min-w-0 flex-col">
                                                        <span className="flex flex-wrap items-center gap-2 font-bold">
                                                            {device.name}
                                                            {device.is_current && (
                                                                <Badge
                                                                    variant="label"
                                                                    tone="link"
                                                                    className="h-6 text-[13px]"
                                                                >
                                                                    Perangkat
                                                                    ini
                                                                </Badge>
                                                            )}
                                                        </span>
                                                        <span className="text-[14px] text-text-muted">
                                                            {
                                                                PLATFORM_LABEL[
                                                                    device
                                                                        .platform
                                                                ]
                                                            }{' '}
                                                            ·{' '}
                                                            {device.os_version}{' '}
                                                            · aplikasi{' '}
                                                            {device.app_version}
                                                        </span>
                                                    </span>
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-text-muted">
                                                {lastSeen(device)}
                                            </TableCell>
                                            <TableCell>
                                                <span className="flex flex-col items-start gap-1">
                                                    <IntegrityPill
                                                        device={device}
                                                    />
                                                    {!device.is_trusted && (
                                                        <span className="text-[13px] text-danger">
                                                            Tidak tepercaya
                                                        </span>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Switch
                                                    checked={
                                                        device.biometric_login
                                                    }
                                                    disabled={
                                                        !device.is_trusted ||
                                                        state.busy
                                                    }
                                                    onCheckedChange={() =>
                                                        state.toggleBiometric(
                                                            device,
                                                        )
                                                    }
                                                    aria-label={`Masuk biometrik di ${device.name}`}
                                                />
                                            </TableCell>
                                            <TableCell className="pr-7 text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        state.setConfirm({
                                                            kind: 'revoke',
                                                            device,
                                                        })
                                                    }
                                                >
                                                    Cabut
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </Panel>
                )}
            </div>
            <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
                <Panel title="Data wajah">
                    <FaceData state={state} mobile={false} />
                </Panel>
                <div className="flex min-w-0 flex-col gap-6">{aside}</div>
            </div>
            <Confirm state={state} mobile={false} />
        </div>
    );
}

// --- Phone -----------------------------------------------------------------------

export function DevicesMobile({
    state,
    header,
}: {
    state: DevicesState;
    header: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-4">
            {header}
            {state.loadError ? (
                <LoadError state={state} />
            ) : (
                <section
                    aria-labelledby="perangkat-tepercaya"
                    className="flex flex-col gap-3"
                >
                    <h2
                        id="perangkat-tepercaya"
                        className="text-[20px] leading-[26px] font-extrabold"
                    >
                        Perangkat tepercaya
                    </h2>
                    {state.devices.length === 0 && <NoDevices />}
                    {state.devices.map((device) => (
                        <article
                            key={device.id}
                            aria-label={device.name}
                            className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-4 shadow-card"
                        >
                            <div className="flex items-start gap-3">
                                <DeviceGlyph device={device} />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <span className="text-[17px] font-bold">
                                        {device.name}
                                    </span>
                                    <span className="text-[14px] text-text-muted">
                                        {PLATFORM_LABEL[device.platform]} ·{' '}
                                        {device.os_version}
                                    </span>
                                    <span className="text-[14px] text-text-muted">
                                        {lastSeen(device)}
                                    </span>
                                </span>
                                {device.is_current && (
                                    <Badge
                                        variant="label"
                                        tone="link"
                                        className="h-6 text-[13px]"
                                    >
                                        Perangkat ini
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <IntegrityPill device={device} />
                                {!device.is_trusted && (
                                    <Badge
                                        variant="label"
                                        tone="danger"
                                        className="h-7 text-[13px]"
                                    >
                                        Tidak tepercaya
                                    </Badge>
                                )}
                            </div>
                            <div className="flex items-center justify-between gap-3 border-t border-divider pt-3">
                                <label className="flex min-h-11 flex-1 items-center justify-between gap-3 text-[16px] font-semibold">
                                    Masuk biometrik
                                    <Switch
                                        size="md"
                                        checked={device.biometric_login}
                                        disabled={
                                            !device.is_trusted || state.busy
                                        }
                                        onCheckedChange={() =>
                                            state.toggleBiometric(device)
                                        }
                                    />
                                </label>
                            </div>
                            <Button
                                variant="outline"
                                className="w-full text-danger"
                                onClick={() =>
                                    state.setConfirm({ kind: 'revoke', device })
                                }
                            >
                                Cabut perangkat
                            </Button>
                        </article>
                    ))}
                </section>
            )}
            <section
                aria-labelledby="data-wajah"
                className="flex flex-col gap-3 rounded-[22px] border border-border bg-surface p-4 shadow-card"
            >
                <h2
                    id="data-wajah"
                    className="text-[20px] leading-[26px] font-extrabold"
                >
                    Data wajah
                </h2>
                <FaceData state={state} mobile />
            </section>
            <Confirm state={state} mobile />
        </div>
    );
}
