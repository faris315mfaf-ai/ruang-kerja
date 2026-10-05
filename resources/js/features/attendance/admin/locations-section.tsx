import { router, useForm } from '@inertiajs/react';
import { Building2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import locationRoutes from '@/routes/admin/attendance/locations';
import { LocationPickerMap } from '../map/lazy';
import { SectionCard } from './section-card';
import type { AdminLocation, AttendanceSettingsProps } from './types';

type Props = Pick<AttendanceSettingsProps, 'locations' | 'geofence'>;

const NEW = 'new';

type LocationForm = {
    name: string;
    address: string;
    latitude: string;
    longitude: string;
    radius_m: number;
    is_active: boolean;
};

function toForm(
    location: AdminLocation | undefined,
    defaultRadius: number,
): LocationForm {
    return {
        name: location?.name ?? '',
        address: location?.address ?? '',
        latitude: (location?.latitude ?? -6.2).toFixed(7),
        longitude: (location?.longitude ?? 106.816666).toFixed(7),
        radius_m: location?.radiusM ?? defaultRadius,
        is_active: location?.isActive ?? true,
    };
}

/** Office locations with a map to place the point and radius (Leaflet + OSM). */
export function LocationsSection({ locations, geofence }: Props) {
    const [selected, setSelected] = useState<string>(locations[0]?.id ?? NEW);
    const current = locations.find((location) => location.id === selected);
    const form = useForm<LocationForm>(toForm(current, geofence.defaultRadius));

    const select = (id: string) => {
        setSelected(id);
        form.setDefaults(
            toForm(
                locations.find((location) => location.id === id),
                geofence.defaultRadius,
            ),
        );
        form.setData(
            toForm(
                locations.find((location) => location.id === id),
                geofence.defaultRadius,
            ),
        );
        form.clearErrors();
    };

    const { setData } = form;
    const movePin = useCallback(
        (latitude: number, longitude: number) => {
            setData((data) => ({
                ...data,
                latitude: latitude.toFixed(7),
                longitude: longitude.toFixed(7),
            }));
        },
        [setData],
    );

    const latitude = Number(form.data.latitude);
    const longitude = Number(form.data.longitude);
    const validPoint =
        Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        Math.abs(latitude) <= 90 &&
        Math.abs(longitude) <= 180;

    const submit = () => {
        const options = {
            preserveScroll: true,
            onSuccess: () => {
                if (!current) {
                    setSelected(NEW);
                }
            },
        };

        if (current) {
            form.put(locationRoutes.update.url(current.id), options);
        } else {
            form.post(locationRoutes.store.url(), {
                ...options,
                onSuccess: () => form.reset(),
            });
        }
    };

    const remove = () => {
        if (
            current &&
            window.confirm(
                `Hapus lokasi ${current.name}? Check-in tidak lagi diterima di sini.`,
            )
        ) {
            router.delete(locationRoutes.destroy.url(current.id), {
                preserveScroll: true,
                onSuccess: () => select(NEW),
            });
        }
    };

    return (
        <SectionCard
            id="lokasi"
            title="Lokasi kantor"
            description="Check-in GPS hanya diterima di dalam radius lokasi yang aktif."
            actions={
                <Button variant="outline" size="sm" onClick={() => select(NEW)}>
                    <Plus aria-hidden />
                    Tambah lokasi
                </Button>
            }
        >
            <div className="grid gap-4 p-4 xl:grid-cols-[230px_minmax(0,1fr)_340px]">
                <div className="space-y-2">
                    <ul className="space-y-2" aria-label="Daftar lokasi">
                        {locations.map((location) => (
                            <li key={location.id}>
                                <button
                                    type="button"
                                    onClick={() => select(location.id)}
                                    aria-current={
                                        selected === location.id
                                            ? 'true'
                                            : undefined
                                    }
                                    className={cn(
                                        'flex w-full items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left transition-colors duration-120 ease-brand outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
                                        selected === location.id
                                            ? 'border-primary/40 bg-primary/8'
                                            : 'border-border hover:bg-surface-2',
                                    )}
                                >
                                    <Building2
                                        className="mt-0.5 size-4 shrink-0 text-text-muted"
                                        strokeWidth={1.75}
                                        aria-hidden
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate text-meta font-medium text-text">
                                            {location.name}
                                        </span>
                                        <span className="block text-meta text-text-muted">
                                            {location.radiusM} m ·{' '}
                                            {location.employeesCount} karyawan
                                        </span>
                                    </span>
                                    <span
                                        className={cn(
                                            'mt-1.5 size-2 shrink-0 rounded-full',
                                            location.isActive
                                                ? 'bg-success'
                                                : 'bg-text-subtle',
                                        )}
                                        aria-label={
                                            location.isActive
                                                ? 'Aktif'
                                                : 'Nonaktif'
                                        }
                                    />
                                </button>
                            </li>
                        ))}
                        {selected === NEW && (
                            <li className="rounded-lg border border-dashed border-primary/50 px-3 py-2.5 text-meta text-primary">
                                Lokasi baru
                            </li>
                        )}
                    </ul>
                    <p className="rounded-lg bg-surface-2 p-3 text-meta leading-5 text-text-muted">
                        Karyawan WFH dan Lapangan tetap check-in dengan GPS +
                        selfie, tanpa batas radius.
                    </p>
                </div>

                <div className="overflow-hidden rounded-lg border border-border">
                    {validPoint ? (
                        <LocationPickerMap
                            latitude={latitude}
                            longitude={longitude}
                            radiusM={form.data.radius_m}
                            onChange={movePin}
                            className="h-[360px] w-full"
                        />
                    ) : (
                        <div className="flex h-[360px] items-center justify-center bg-surface-2 text-[15px] text-text-muted">
                            Koordinat tidak valid
                        </div>
                    )}
                    <p className="border-t border-border px-3 py-2 text-meta text-text-muted">
                        Seret pin atau klik peta untuk memindahkan titik pusat.
                    </p>
                </div>

                <form
                    className="space-y-3"
                    onSubmit={(event) => {
                        event.preventDefault();
                        submit();
                    }}
                >
                    <div className="space-y-1.5">
                        <Label htmlFor="location-name">Nama</Label>
                        <Input
                            id="location-name"
                            value={form.data.name}
                            onChange={(e) =>
                                form.setData('name', e.target.value)
                            }
                            placeholder="Kantor Pusat"
                        />
                        <InputError message={form.errors.name} />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="location-address">Alamat</Label>
                        <Textarea
                            id="location-address"
                            rows={2}
                            value={form.data.address}
                            onChange={(e) =>
                                form.setData('address', e.target.value)
                            }
                        />
                        <InputError message={form.errors.address} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="location-lat">Latitude</Label>
                            <Input
                                id="location-lat"
                                inputMode="decimal"
                                className="font-mono"
                                value={form.data.latitude}
                                onChange={(e) =>
                                    form.setData('latitude', e.target.value)
                                }
                            />
                            <InputError message={form.errors.latitude} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="location-lng">Longitude</Label>
                            <Input
                                id="location-lng"
                                inputMode="decimal"
                                className="font-mono"
                                value={form.data.longitude}
                                onChange={(e) =>
                                    form.setData('longitude', e.target.value)
                                }
                            />
                            <InputError message={form.errors.longitude} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="location-radius">Radius</Label>
                            <span className="text-[15px] font-medium text-text tnum">
                                {form.data.radius_m} m
                            </span>
                        </div>
                        <input
                            id="location-radius"
                            type="range"
                            min={geofence.minRadius}
                            max={geofence.maxRadius}
                            step={10}
                            value={form.data.radius_m}
                            onChange={(e) =>
                                form.setData('radius_m', Number(e.target.value))
                            }
                            className="w-full accent-primary"
                        />
                        <div className="flex justify-between text-[12px] text-text-subtle">
                            <span>{geofence.minRadius} m</span>
                            <span>{geofence.maxRadius} m</span>
                        </div>
                        <InputError message={form.errors.radius_m} />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
                        <div>
                            <p
                                className="text-meta font-medium text-text"
                                id="location-active-label"
                            >
                                Lokasi aktif
                            </p>
                            <p className="text-meta text-text-muted">
                                Nonaktifkan untuk menutup check-in di sini.
                            </p>
                        </div>
                        <Switch
                            checked={form.data.is_active}
                            onCheckedChange={(value) =>
                                form.setData('is_active', value)
                            }
                            aria-labelledby="location-active-label"
                        />
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                        {current ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-danger"
                                onClick={remove}
                            >
                                <Trash2 aria-hidden />
                                Hapus
                            </Button>
                        ) : (
                            <span />
                        )}
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => select(selected)}
                                disabled={!form.isDirty}
                            >
                                Batal
                            </Button>
                            <Button
                                type="submit"
                                size="sm"
                                disabled={form.processing}
                            >
                                Simpan lokasi
                            </Button>
                        </div>
                    </div>
                </form>
            </div>
        </SectionCard>
    );
}
