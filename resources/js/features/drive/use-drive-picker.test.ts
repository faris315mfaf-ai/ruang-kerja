import { act, cleanup, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';

const toastError = vi.fn();
vi.mock('sonner', () => ({
    toast: { error: (message: string) => toastError(message) },
}));

const showGooglePicker = vi.fn();
vi.mock('./load-google-picker', () => ({
    loadGooglePicker: () => Promise.resolve({ fake: true }),
    showGooglePicker: (...args: unknown[]) => showGooglePicker(...args),
}));

import { useDrivePicker } from './use-drive-picker';

function respond(body: unknown) {
    globalThis.fetch = vi.fn(() =>
        Promise.resolve(new Response(JSON.stringify(body))),
    ) as typeof fetch;
}

beforeEach(() => {
    window.history.replaceState({}, '', '/workspace/plq?tab=file');
});

afterEach(() => {
    cleanup();
    vi.clearAllMocks();
});

describe('useDrivePicker', () => {
    it('asks to connect Google and returns to the current page afterwards', async () => {
        respond({
            status: 'not_connected',
            message:
                'Hubungkan akun Google Anda dulu untuk memilih file dari Drive.',
            connect_url: '/google/connect',
        });
        const { result } = renderHook(() =>
            useDrivePicker({ onPicked: vi.fn() }),
        );

        await act(() => result.current.open());

        expect(result.current.state).toEqual({
            status: 'needs_connect',
            message:
                'Hubungkan akun Google Anda dulu untuk memilih file dari Drive.',
            connectUrl:
                '/google/connect?return=%2Fworkspace%2Fplq%3Ftab%3Dfile',
        });

        act(() => result.current.dismiss());
        expect(result.current.state.status).toBe('idle');
    });

    it('shows the server message when the Picker is not configured', async () => {
        respond({
            status: 'not_configured',
            message:
                'Google Picker belum diaktifkan. Hubungi admin RuangKerja.',
        });
        const { result } = renderHook(() =>
            useDrivePicker({ onPicked: vi.fn() }),
        );

        await act(() => result.current.open());

        expect(toastError).toHaveBeenCalledWith(
            'Google Picker belum diaktifkan. Hubungi admin RuangKerja.',
        );
        expect(result.current.state.status).toBe('idle');
        expect(showGooglePicker).not.toHaveBeenCalled();
    });

    it('opens the Picker with the user token and forwards picked files', async () => {
        respond({
            status: 'ready',
            access_token: 'ya29.t',
            expires_at: null,
            developer_key: 'key',
            app_id: '123',
            locale: 'id',
        });
        const onPicked = vi.fn();
        const { result } = renderHook(() =>
            useDrivePicker({ onPicked, multiple: false }),
        );

        await act(() => result.current.open());

        expect(result.current.state.status).toBe('open');
        const options = showGooglePicker.mock.calls[0][1] as {
            token: string;
            developerKey: string;
            appId: string;
            multiple: boolean;
            onPicked: (docs: unknown[]) => void;
        };
        expect(options).toMatchObject({
            token: 'ya29.t',
            developerKey: 'key',
            appId: '123',
            multiple: false,
        });

        act(() =>
            options.onPicked([
                {
                    id: 'f1',
                    name: 'Brief',
                    mimeType: 'application/pdf',
                    url: 'u',
                    extra: 1,
                },
            ]),
        );

        expect(onPicked).toHaveBeenCalledWith([
            { id: 'f1', name: 'Brief', mimeType: 'application/pdf', url: 'u' },
        ]);
        expect(result.current.state.status).toBe('idle');
    });

    it('reports network failures', async () => {
        globalThis.fetch = vi.fn(() =>
            Promise.reject(new Error('offline')),
        ) as typeof fetch;
        const { result } = renderHook(() =>
            useDrivePicker({ onPicked: vi.fn() }),
        );

        await act(() => result.current.open());

        expect(toastError).toHaveBeenCalledWith(
            'Tidak bisa menghubungi server. Coba lagi.',
        );
    });
});
