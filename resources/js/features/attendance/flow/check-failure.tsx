import { Link } from '@inertiajs/react';
import {
    AlertCircle,
    Building2,
    ChevronRight,
    FileText,
    Loader2,
    MapPin,
    QrCode,
    RefreshCw,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { GeoPosition } from '@/hooks/use-geolocation';
import { cn } from '@/lib/utils';
import type { CheckRejection, OfficeLocationPoint } from '@/types/attendance';
import { GeofenceMap } from '../map/lazy';

const TITLES: Partial<Record<CheckRejection['reason'], string>> = {
    outside_geofence: 'Di luar radius kantor',
    already_checked_in: 'Sudah check-in',
    already_checked_out: 'Sudah check-out',
    not_checked_in: 'Belum check-in',
    too_early: 'Check-in belum dibuka',
    no_office_location: 'Lokasi kantor belum diatur',
    day_has_request: 'Hari ini tercatat dari pengajuan',
    network: 'Koneksi terputus',
    rate_limited: 'Terlalu banyak percobaan',
    validation: 'Data belum lengkap',
    consent_required: 'Persetujuan diperlukan',
    server: 'Terjadi kesalahan',
    qr_invalid: 'Kode QR tidak dikenali',
    qr_expired: 'Kode QR kedaluwarsa',
    qr_wrong_location: 'Kode QR lokasi lain',
};

/** Rejections where scanning the kiosk again is the next step. */
const RESCAN = ['qr_invalid', 'qr_expired', 'qr_wrong_location'];

type OptionProps = {
    icon: LucideIcon;
    label: string;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
    primary?: boolean;
    busy?: boolean;
    hint?: string;
};

function Option({
    icon: Icon,
    label,
    href,
    onClick,
    disabled,
    primary,
    busy,
    hint,
}: OptionProps) {
    const content = (
        <>
            <span
                aria-hidden
                className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg',
                    primary
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-2 text-text-muted',
                )}
            >
                {busy ? (
                    <Loader2 className="size-5 animate-spin" />
                ) : (
                    <Icon className="size-5" strokeWidth={1.75} />
                )}
            </span>
            <span className="min-w-0 flex-1">
                <span
                    className={cn(
                        'block text-[16px]',
                        primary ? 'font-medium text-primary' : 'text-text',
                    )}
                >
                    {label}
                </span>
                {hint && (
                    <span className="block text-[13px] text-text-muted">
                        {hint}
                    </span>
                )}
            </span>
            <ChevronRight
                className="size-5 shrink-0 text-text-subtle"
                aria-hidden
            />
        </>
    );
    const className =
        'flex min-h-16 w-full items-center gap-3.5 px-4 py-2.5 text-left transition-colors duration-120 ease-brand hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent';

    return (
        <li>
            {href ? (
                <Link href={href} className={className}>
                    {content}
                </Link>
            ) : (
                <button
                    type="button"
                    onClick={onClick}
                    disabled={disabled || busy}
                    className={className}
                >
                    {content}
                </button>
            )}
        </li>
    );
}

type Props = {
    rejection: CheckRejection;
    locations: OfficeLocationPoint[];
    position: GeoPosition | null;
    locating: boolean;
    onRefreshLocation: () => void;
    onRetry: () => void;
    onClose: () => void;
    /** Opens the QR scanner (kiosk check-in). */
    onScanQr?: () => void;
};

/** Mockup CheckinGagal (outside the geofence) and other refusals. */
export function CheckFailure({
    rejection,
    locations,
    position,
    locating,
    onRefreshLocation,
    onRetry,
    onClose,
    onScanQr,
}: Props) {
    const outside = rejection.reason === 'outside_geofence';
    const accuracy =
        rejection.context.accuracy_m ??
        (position ? Math.round(position.accuracy) : null);
    const radius = rejection.context.radius_m;
    const retryable = [
        'network',
        'rate_limited',
        'server',
        'validation',
        'no_office_location',
    ].includes(rejection.reason);
    const mapLocations = rejection.context.location
        ? locations.filter(
              (location) => location.id === rejection.context.location?.id,
          )
        : locations;

    return (
        <div className="flex flex-col gap-5">
            {outside && position && (
                <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-card">
                    <GeofenceMap
                        locations={
                            mapLocations.length > 0 ? mapLocations : locations
                        }
                        position={position}
                        showDistance
                        showLabels
                        className="h-[200px] w-full"
                    />
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm text-text-muted">
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="size-3 rounded-full border border-dashed border-primary"
                            />
                            Radius {radius} m
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                aria-hidden
                                className="size-3 rounded-full bg-info"
                            />
                            Posisi Anda
                        </span>
                        {accuracy !== null && (
                            <span className="ml-auto">
                                Akurasi ±{accuracy} m
                            </span>
                        )}
                    </div>
                </div>
            )}

            <div
                role="alert"
                className="flex gap-3 rounded-xl border border-danger/25 bg-danger/8 p-4"
            >
                <AlertCircle
                    className="mt-0.5 size-6 shrink-0 text-danger"
                    strokeWidth={1.75}
                    aria-hidden
                />
                <div className="space-y-1">
                    <p className="text-[17px] font-semibold text-danger">
                        {TITLES[rejection.reason] ?? 'Belum bisa diproses'}
                    </p>
                    <p className="text-[15px] leading-6 text-text">
                        {rejection.message}
                    </p>
                </div>
            </div>

            {outside ? (
                <section aria-labelledby="other-ways" className="space-y-2">
                    <h3
                        id="other-ways"
                        className="px-1 text-[15px] text-text-muted"
                    >
                        Pilih cara lain
                    </h3>
                    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                        <Option
                            icon={RefreshCw}
                            label="Perbarui lokasi"
                            onClick={onRefreshLocation}
                            busy={locating}
                            primary
                        />
                        <Option
                            icon={QrCode}
                            label="Pindai QR di kiosk"
                            onClick={onScanQr}
                            disabled={!onScanQr}
                        />
                        <Option
                            icon={Building2}
                            label="Ajukan dinas luar"
                            href="/pengajuan/baru?kategori=dinas"
                        />
                        <Option
                            icon={FileText}
                            label="Ajukan koreksi absensi"
                            href="/pengajuan/baru?kategori=koreksi"
                        />
                    </ul>
                </section>
            ) : (
                <div className="grid gap-2">
                    {RESCAN.includes(rejection.reason) && onScanQr && (
                        <Button
                            type="button"
                            onClick={onScanQr}
                            className="h-12 text-base"
                        >
                            <QrCode aria-hidden />
                            Pindai ulang
                        </Button>
                    )}
                    {retryable && (
                        <Button
                            type="button"
                            onClick={onRetry}
                            className="h-12 text-base"
                        >
                            Coba lagi
                        </Button>
                    )}
                    {(rejection.reason === 'not_checked_in' ||
                        rejection.reason === 'already_checked_out') && (
                        <Button
                            asChild
                            variant="outline"
                            className="h-12 text-base"
                        >
                            <Link href="/pengajuan/baru?kategori=koreksi">
                                Ajukan koreksi absensi
                            </Link>
                        </Button>
                    )}
                    <Button
                        type="button"
                        variant={
                            retryable || RESCAN.includes(rejection.reason)
                                ? 'ghost'
                                : 'default'
                        }
                        onClick={onClose}
                        className="h-12 text-base"
                    >
                        Kembali ke absensi
                    </Button>
                </div>
            )}

            {outside && accuracy !== null && accuracy > 50 && (
                <p className="flex gap-3 rounded-xl bg-surface-2 p-4 text-[15px] leading-6 text-text-muted">
                    <MapPin
                        className="mt-0.5 size-5 shrink-0"
                        strokeWidth={1.75}
                        aria-hidden
                    />
                    <span>
                        <strong className="font-semibold text-text">
                            Akurasi GPS ±{accuracy} m.
                        </strong>{' '}
                        Nyalakan mode akurasi tinggi dan coba di dekat jendela.
                    </span>
                </p>
            )}
        </div>
    );
}
