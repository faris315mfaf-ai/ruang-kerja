import { useState } from 'react';
import { useFakeMutation } from '@/features/prototype/use-fake-mutation';
import { DEVICES, FACE_CONSENT, FACE_TEMPLATE, NOW } from './fixtures';
import { sortDevices } from './logic';
import type { Device, FaceConsent, FaceTemplate, PreviewState } from './types';

export type PendingConfirm =
    | { kind: 'revoke'; device: Device }
    | { kind: 'face' }
    | null;

/**
 * Data & mutations of Pengaturan › Perangkat, shared by the desktop table
 * and the phone list (docs/PLATFORM.md §5 rule 2).
 */
export function useDevices(state: PreviewState) {
    const [devices, setDevices] = useState<Device[]>(() =>
        state === 'kosong' ? [] : sortDevices(DEVICES),
    );
    const [template, setTemplate] = useState<FaceTemplate | null>(
        state === 'kosong' ? null : FACE_TEMPLATE,
    );
    const [consent, setConsent] = useState<FaceConsent | null>(
        state === 'kosong' ? null : FACE_CONSENT,
    );
    const [loadError, setLoadError] = useState(state === 'galat');
    const [confirm, setConfirm] = useState<PendingConfirm>(null);
    const mutation = useFakeMutation();
    const reload = useFakeMutation();

    const retryLoad = () =>
        void reload.run(() => setLoadError(false), {
            success: 'Daftar perangkat dimuat',
        });

    const runConfirm = () => {
        if (!confirm) {
            return;
        }

        if (confirm.kind === 'revoke') {
            const { device } = confirm;

            void mutation.run(
                () => {
                    setDevices((current) =>
                        current.filter((item) => item.id !== device.id),
                    );
                    setConfirm(null);
                },
                {
                    success: device.is_current
                        ? `${device.name} dicabut. Anda akan keluar di perangkat ini.`
                        : `${device.name} dicabut dan sesinya diakhiri`,
                },
            );

            return;
        }

        void mutation.run(
            () => {
                setTemplate(null);
                setConsent((current) =>
                    current ? { ...current, revoked_at: NOW } : current,
                );
                setConfirm(null);
            },
            { success: 'Data wajah dihapus, persetujuan biometrik dicabut' },
        );
    };

    const toggleBiometric = (device: Device) =>
        void mutation.run(
            () =>
                setDevices((current) =>
                    current.map((item) =>
                        item.id === device.id
                            ? {
                                  ...item,
                                  biometric_login: !item.biometric_login,
                              }
                            : item,
                    ),
                ),
            {
                success: device.biometric_login
                    ? `Masuk biometrik dimatikan di ${device.name}`
                    : `Masuk biometrik aktif di ${device.name}`,
                delay: 400,
            },
        );

    return {
        devices,
        template,
        consent,
        loadError,
        reloading: reload.processing,
        retryLoad,
        confirm,
        setConfirm,
        runConfirm,
        busy: mutation.processing,
        toggleBiometric,
    };
}

export type DevicesState = ReturnType<typeof useDevices>;
