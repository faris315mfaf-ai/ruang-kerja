import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import type { DeviceDraft } from './lib';
import { deviceStatus, mapPin, normalizeSerial } from './lib';
import type {
    FingerprintDevice,
    FingerprintPageProps,
    PersonRef,
} from './types';

/**
 * Local state of the fingerprint admin preview: add devices, map PINs and
 * test connections (simulated). The real page posts and gets fresh props.
 */
export function useFingerprint(initial: FingerprintPageProps) {
    const [devices, setDevices] = useState(initial.devices);
    const [punches, setPunches] = useState(initial.punches);
    const [mappings, setMappings] = useState(initial.mappings);
    const [testing, setTesting] = useState<string | null>(null);
    const [tests, setTests] = useState<
        Record<string, { ok: boolean; at: string }>
    >({});
    const { processing, run } = useFakeMutation();

    const addDevice = useCallback(
        async (draft: DeviceDraft): Promise<FingerprintDevice | null> => {
            const device: FingerprintDevice = {
                id: `dev-${Date.now()}`,
                name: draft.name.trim(),
                serial_number: normalizeSerial(draft.serial_number),
                model: null,
                firmware: null,
                office_location:
                    initial.locations.find(
                        (item) => item.id === draft.location_id,
                    ) ?? initial.locations[0],
                ip_address: null,
                timezone: draft.timezone,
                last_push_at: null,
                users_count: 0,
                created_at: new Date().toISOString(),
            };
            const ok = await run(
                () => setDevices((current) => [...current, device]),
                {
                    success: 'Mesin ditambahkan · menunggu push pertama',
                },
            );

            return ok ? device : null;
        },
        [initial.locations, run],
    );

    const assignPin = useCallback(
        (
            target: { device_id: string; pin: string },
            user: PersonRef | null,
        ) => {
            const next = mapPin(mappings, punches, target, user);

            setMappings(next.mappings);
            setPunches(next.punches);
            toast.success(
                user
                    ? `PIN ${target.pin} dipetakan ke ${user.name}`
                    : `Pemetaan PIN ${target.pin} dilepas`,
            );
        },
        [mappings, punches],
    );

    const testConnection = useCallback(
        async (device: FingerprintDevice) => {
            const ok = deviceStatus(device, initial.now) === 'online';

            setTesting(device.id);
            await run(
                () =>
                    setTests((current) => ({
                        ...current,
                        [device.id]: { ok, at: new Date().toISOString() },
                    })),
                {
                    delay: 1200,
                    success: ok ? `${device.name} terhubung` : undefined,
                    fail: !ok,
                    error: `${device.name} tidak merespons`,
                },
            );
            if (!ok) {
                setTests((current) => ({
                    ...current,
                    [device.id]: { ok: false, at: new Date().toISOString() },
                }));
            }
            setTesting(null);
        },
        [initial.now, run],
    );

    return {
        devices,
        punches,
        mappings,
        processing,
        testing,
        tests,
        addDevice,
        assignPin,
        testConnection,
    };
}

export type FingerprintState = ReturnType<typeof useFingerprint>;
