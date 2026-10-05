import { router } from '@inertiajs/react';
import { useState } from 'react';
import { toast } from 'sonner';
import NotificationSettingsController from '@/actions/App/Http/Controllers/Notifications/NotificationSettingsController';
import TestNotificationController from '@/actions/App/Http/Controllers/Notifications/TestNotificationController';
import { setSaveStatus } from '@/features/notifications/settings/save-status';
import type {
    ChannelKey,
    MatrixRow,
    NotificationSettingsProps,
    NotificationSettingsValues,
} from '@/features/notifications/settings/types';
import { HttpRequestError, requestJson } from '@/lib/http';

export const DIGEST_EVENT = 'digest.daily';

function errorMessage(error: unknown): string {
    if (error instanceof HttpRequestError && error.status === 422) {
        const body = error.body as { message?: string } | null;

        if (body?.message) {
            return body.message;
        }
    }

    return 'Perubahan gagal disimpan. Periksa koneksi lalu coba lagi.';
}

/** Shared state + autosave for the desktop matrix and the mobile accordion. */
export function useNotificationSettings(props: NotificationSettingsProps) {
    const [matrix, setMatrix] = useState<MatrixRow[]>(props.matrix);
    const [settings, setSettings] = useState<NotificationSettingsValues>(
        props.settings,
    );
    const [sendingTest, setSendingTest] = useState(false);

    const save = async (
        request: () => Promise<unknown>,
        revert: () => void,
    ) => {
        setSaveStatus('saving');

        try {
            await request();
            setSaveStatus('saved');
        } catch (error) {
            revert();
            setSaveStatus('error');
            toast.error(errorMessage(error));
        }
    };

    const savePreference = (
        event: string,
        channel: ChannelKey,
        enabled: boolean,
    ) =>
        requestJson(NotificationSettingsController.preference.url(), {
            method: 'PATCH',
            body: { event, channel, enabled },
        });

    const setCell = (event: string, channel: ChannelKey, enabled: boolean) =>
        setMatrix((rows) =>
            rows.map((row) =>
                row.event === event
                    ? {
                          ...row,
                          channels: {
                              ...row.channels,
                              [channel]: { ...row.channels[channel], enabled },
                          },
                      }
                    : row,
            ),
        );

    const togglePreference = (
        event: string,
        channel: ChannelKey,
        enabled: boolean,
    ) => {
        setCell(event, channel, enabled);
        void save(
            () => savePreference(event, channel, enabled),
            () => setCell(event, channel, !enabled),
        );
    };

    const setDigestEnabled = (enabled: boolean) => {
        setSettings((current) => ({ ...current, digest_enabled: enabled }));
        void save(
            () => savePreference(DIGEST_EVENT, 'email', enabled),
            () =>
                setSettings((current) => ({
                    ...current,
                    digest_enabled: !enabled,
                })),
        );
    };

    const updateSettings = (
        patch: Partial<Omit<NotificationSettingsValues, 'digest_enabled'>>,
    ) => {
        const previous = settings;
        setSettings((current) => ({ ...current, ...patch }));
        void save(
            () =>
                requestJson(NotificationSettingsController.update.url(), {
                    method: 'PATCH',
                    body: patch,
                }),
            () => setSettings(previous),
        );
    };

    const sendTest = () => {
        router.visit(TestNotificationController.store(), {
            preserveScroll: true,
            preserveState: true,
            only: ['inbox'],
            onStart: () => setSendingTest(true),
            onFinish: () => setSendingTest(false),
            onError: () => toast.error('Notifikasi uji gagal dikirim.'),
            onHttpException: (response) => {
                toast.error(
                    response.status === 429
                        ? 'Terlalu sering. Coba lagi dalam satu menit.'
                        : 'Notifikasi uji gagal dikirim.',
                );

                return false;
            },
        });
    };

    return {
        matrix,
        settings,
        togglePreference,
        setDigestEnabled,
        updateSettings,
        sendTest,
        sendingTest,
    };
}

export type NotificationSettingsState = ReturnType<
    typeof useNotificationSettings
>;

/** "In-app, Email" summary for the mobile accordion. */
export function enabledSummary(
    row: MatrixRow,
    labels: Record<ChannelKey, string>,
): string {
    const enabled = (Object.keys(row.channels) as ChannelKey[])
        .filter((channel) => row.channels[channel].enabled)
        .map((channel) => labels[channel]);

    return enabled.length > 0 ? enabled.join(', ') : 'Nonaktif';
}

/** "07:30" → "07.30" (DESIGN.md §8). */
export function displayTime(time: string): string {
    return time.replace(':', '.');
}
