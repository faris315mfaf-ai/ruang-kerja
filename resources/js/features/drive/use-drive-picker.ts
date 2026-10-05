import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { pickerToken } from '@/routes/google';
import { connectUrl } from './drive-files';
import { loadGooglePicker, showGooglePicker } from './load-google-picker';
import type { PickedDriveFile, PickerTokenResponse } from './types';

export type DrivePickerState =
    | { status: 'idle' | 'loading' | 'open' }
    | { status: 'needs_connect'; message: string; connectUrl: string };

type Options = {
    onPicked: (files: PickedDriveFile[]) => void;
    multiple?: boolean;
};

const NETWORK_ERROR = 'Tidak bisa menghubungi server. Coba lagi.';

/**
 * Asks the server for a short-lived Google token, loads Google Picker and
 * opens it. When the user has no (valid) Google connection the state
 * becomes `needs_connect` so the UI can offer "Hubungkan akun Google".
 */
export function useDrivePicker({ onPicked, multiple = true }: Options) {
    const [state, setState] = useState<DrivePickerState>({ status: 'idle' });

    const dismiss = useCallback(() => setState({ status: 'idle' }), []);

    const open = useCallback(async () => {
        setState({ status: 'loading' });

        let data: PickerTokenResponse;

        try {
            const response = await fetch(pickerToken.url(), {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                credentials: 'same-origin',
            });
            data = (await response.json()) as PickerTokenResponse;
        } catch {
            toast.error(NETWORK_ERROR);
            setState({ status: 'idle' });

            return;
        }

        if (
            data.status === 'not_connected' ||
            data.status === 'reconnect_required'
        ) {
            setState({
                status: 'needs_connect',
                message: data.message,
                connectUrl: connectUrl(
                    data.connect_url,
                    window.location.pathname + window.location.search,
                ),
            });

            return;
        }

        if (data.status !== 'ready') {
            toast.error(data.message);
            setState({ status: 'idle' });

            return;
        }

        try {
            const api = await loadGooglePicker();

            showGooglePicker(api, {
                token: data.access_token,
                developerKey: data.developer_key,
                appId: data.app_id,
                locale: data.locale,
                multiple,
                origin: window.location.origin,
                onPicked: (documents) => {
                    setState({ status: 'idle' });
                    onPicked(
                        documents.map((document) => ({
                            id: document.id,
                            name: document.name,
                            mimeType: document.mimeType,
                            url: document.url,
                        })),
                    );
                },
                onCancel: () => setState({ status: 'idle' }),
            });
            setState({ status: 'open' });
        } catch (error) {
            toast.error(error instanceof Error ? error.message : NETWORK_ERROR);
            setState({ status: 'idle' });
        }
    }, [multiple, onPicked]);

    return { state, open, dismiss };
}
