import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import {
    GOOGLE_API_SCRIPT,
    PICKER_LOAD_ERROR,
    loadGooglePicker,
    resetGooglePickerLoader,
    showGooglePicker,
} from './load-google-picker';
import type {
    GooglePickerApi,
    PickerCallbackData,
    PickerWindow,
} from './load-google-picker';

function fakePickerApi() {
    const calls: Array<[string, unknown]> = [];
    let callback: ((data: PickerCallbackData) => void) | null = null;
    const picker = { setVisible: vi.fn(), dispose: vi.fn() };

    class DocsView {
        setIncludeFolders(value: boolean) {
            calls.push(['includeFolders', value]);

            return this;
        }

        setSelectFolderEnabled(value: boolean) {
            calls.push(['selectFolder', value]);

            return this;
        }

        setEnableDrives(value: boolean) {
            calls.push(['enableDrives', value]);

            return this;
        }
    }

    class PickerBuilder {
        addView() {
            return this;
        }

        enableFeature(feature: string) {
            calls.push(['feature', feature]);

            return this;
        }

        setOAuthToken(token: string) {
            calls.push(['token', token]);

            return this;
        }

        setDeveloperKey(key: string) {
            calls.push(['key', key]);

            return this;
        }

        setAppId(appId: string) {
            calls.push(['appId', appId]);

            return this;
        }

        setLocale(locale: string) {
            calls.push(['locale', locale]);

            return this;
        }

        setTitle() {
            return this;
        }

        setOrigin(origin: string) {
            calls.push(['origin', origin]);

            return this;
        }

        setCallback(fn: (data: PickerCallbackData) => void) {
            callback = fn;

            return this;
        }

        build() {
            return picker;
        }
    }

    const api: GooglePickerApi = {
        DocsView,
        PickerBuilder,
        ViewId: { DOCS: 'all' },
        Feature: { MULTISELECT_ENABLED: 'multi', SUPPORT_DRIVES: 'drives' },
        Action: { PICKED: 'picked', CANCEL: 'cancel' },
    };

    return {
        api,
        calls,
        picker,
        fire: (data: PickerCallbackData) => callback?.(data),
    };
}

afterEach(() => {
    resetGooglePickerLoader();
    document.head.innerHTML = '';
});

describe('loadGooglePicker', () => {
    it('injects api.js once and resolves after gapi loads the picker', async () => {
        const { api } = fakePickerApi();
        const win: PickerWindow = {};

        const first = loadGooglePicker(document, win);
        const second = loadGooglePicker(document, win);

        const scripts = document.querySelectorAll(
            `script[src="${GOOGLE_API_SCRIPT}"]`,
        );
        expect(scripts).toHaveLength(1);
        expect(second).toBe(first);

        win.gapi = {
            load: (name, options) => {
                expect(name).toBe('picker');
                win.google = { picker: api };
                options.callback();
            },
        };
        scripts[0].dispatchEvent(new Event('load'));

        await expect(first).resolves.toBe(api);
    });

    it('resolves immediately when the picker is already there', async () => {
        const { api } = fakePickerApi();

        await expect(
            loadGooglePicker(document, { google: { picker: api } }),
        ).resolves.toBe(api);
        expect(document.querySelector('script')).toBeNull();
    });

    it('rejects with an Indonesian message and can retry after a failure', async () => {
        const win: PickerWindow = {};
        const attempt = loadGooglePicker(document, win);

        document
            .querySelector(`script[src="${GOOGLE_API_SCRIPT}"]`)
            ?.dispatchEvent(new Event('error'));

        await expect(attempt).rejects.toThrow(PICKER_LOAD_ERROR);

        const { api } = fakePickerApi();
        win.gapi = {
            load: (_name, options) => {
                win.google = { picker: api };
                options.callback();
            },
        };

        await expect(loadGooglePicker(document, win)).resolves.toBe(api);
    });
});

describe('showGooglePicker', () => {
    it('opens a multi-select picker with the user token and reports picked files', () => {
        const { api, calls, picker, fire } = fakePickerApi();
        const onPicked = vi.fn();
        const onCancel = vi.fn();

        showGooglePicker(api, {
            token: 'ya29.t',
            developerKey: 'key',
            appId: '123',
            origin: 'https://ruangkerja.test',
            onPicked,
            onCancel,
        });

        expect(picker.setVisible).toHaveBeenCalledWith(true);
        expect(calls).toEqual(
            expect.arrayContaining([
                ['token', 'ya29.t'],
                ['key', 'key'],
                ['appId', '123'],
                ['locale', 'id'],
                ['feature', 'drives'],
                ['feature', 'multi'],
                ['origin', 'https://ruangkerja.test'],
                ['enableDrives', true],
            ]),
        );

        const docs = [
            { id: 'f1', name: 'Brief', mimeType: 'application/pdf', url: 'u' },
        ];
        fire({ action: 'picked', docs });
        fire({ action: 'cancel' });
        fire({ action: 'loaded' });

        expect(onPicked).toHaveBeenCalledWith(docs);
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('can limit the selection to one file', () => {
        const { api, calls } = fakePickerApi();

        showGooglePicker(api, {
            token: 't',
            developerKey: 'k',
            appId: '1',
            multiple: false,
            onPicked: vi.fn(),
        });

        expect(calls).not.toContainEqual(['feature', 'multi']);
    });
});
