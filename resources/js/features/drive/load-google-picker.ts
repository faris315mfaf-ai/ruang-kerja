/**
 * Loads Google's api.js once and the `picker` module on demand. Only the
 * parts of the Picker API RuangKerja uses are typed here.
 */

export const GOOGLE_API_SCRIPT = 'https://apis.google.com/js/api.js';

export type PickerDocument = {
    id: string;
    name: string;
    mimeType: string;
    url: string;
};

export type PickerCallbackData = {
    action: string;
    docs?: PickerDocument[];
};

export interface PickerView {
    setIncludeFolders(include: boolean): PickerView;
    setSelectFolderEnabled(enabled: boolean): PickerView;
    setEnableDrives(enabled: boolean): PickerView;
}

export interface Picker {
    setVisible(visible: boolean): void;
    dispose(): void;
}

export interface PickerBuilder {
    addView(view: PickerView): PickerBuilder;
    enableFeature(feature: string): PickerBuilder;
    setOAuthToken(token: string): PickerBuilder;
    setDeveloperKey(key: string): PickerBuilder;
    setAppId(appId: string): PickerBuilder;
    setLocale(locale: string): PickerBuilder;
    setTitle(title: string): PickerBuilder;
    setOrigin(origin: string): PickerBuilder;
    setCallback(callback: (data: PickerCallbackData) => void): PickerBuilder;
    build(): Picker;
}

export interface GooglePickerApi {
    DocsView: new (viewId?: string) => PickerView;
    PickerBuilder: new () => PickerBuilder;
    ViewId: { DOCS: string };
    Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
    Action: { PICKED: string; CANCEL: string };
}

type GapiLoadOptions = {
    callback: () => void;
    onerror?: () => void;
    timeout?: number;
    ontimeout?: () => void;
};

export type PickerWindow = {
    gapi?: { load(name: string, options: GapiLoadOptions): void };
    google?: { picker?: GooglePickerApi };
};

export const PICKER_LOAD_ERROR =
    'Google Picker gagal dimuat. Periksa koneksi internet lalu coba lagi.';

let pending: Promise<GooglePickerApi> | null = null;

export function loadGooglePicker(
    doc: Document = document,
    win: PickerWindow = window as unknown as PickerWindow,
): Promise<GooglePickerApi> {
    const ready = win.google?.picker;

    if (ready) {
        return Promise.resolve(ready);
    }

    if (pending) {
        return pending;
    }

    pending = new Promise<GooglePickerApi>((resolve, reject) => {
        const fail = () => {
            pending = null;
            reject(new Error(PICKER_LOAD_ERROR));
        };

        const loadPicker = () => {
            if (!win.gapi) {
                fail();

                return;
            }

            win.gapi.load('picker', {
                callback: () => {
                    const api = win.google?.picker;

                    if (api) {
                        resolve(api);
                    } else {
                        fail();
                    }
                },
                onerror: fail,
                timeout: 15_000,
                ontimeout: fail,
            });
        };

        if (win.gapi) {
            loadPicker();

            return;
        }

        let script = doc.querySelector<HTMLScriptElement>(
            `script[src="${GOOGLE_API_SCRIPT}"]`,
        );

        if (!script) {
            script = doc.createElement('script');
            script.src = GOOGLE_API_SCRIPT;
            script.async = true;
            doc.head.appendChild(script);
        }

        script.addEventListener('load', loadPicker, { once: true });
        script.addEventListener('error', fail, { once: true });
    });

    return pending;
}

/** Test helper: forget a pending load. */
export function resetGooglePickerLoader(): void {
    pending = null;
}

type ShowPickerOptions = {
    token: string;
    developerKey: string;
    appId: string;
    locale?: string;
    multiple?: boolean;
    origin?: string;
    onPicked: (documents: PickerDocument[]) => void;
    onCancel?: () => void;
};

/**
 * Opens the Picker on "My Drive" and Shared Drives. With the drive.file
 * scope, every picked file becomes readable by RuangKerja for this user.
 */
export function showGooglePicker(
    api: GooglePickerApi,
    options: ShowPickerOptions,
): Picker {
    const myDrive = new api.DocsView(api.ViewId.DOCS)
        .setIncludeFolders(true)
        .setSelectFolderEnabled(false);
    const sharedDrives = new api.DocsView(api.ViewId.DOCS)
        .setEnableDrives(true)
        .setIncludeFolders(true);

    let builder = new api.PickerBuilder()
        .addView(myDrive)
        .addView(sharedDrives)
        .enableFeature(api.Feature.SUPPORT_DRIVES)
        .setOAuthToken(options.token)
        .setDeveloperKey(options.developerKey)
        .setAppId(options.appId)
        .setLocale(options.locale ?? 'id')
        .setTitle('Pilih file dari Google Drive')
        .setCallback((data) => {
            if (data.action === api.Action.PICKED) {
                options.onPicked(data.docs ?? []);
            } else if (data.action === api.Action.CANCEL) {
                options.onCancel?.();
            }
        });

    if (options.multiple ?? true) {
        builder = builder.enableFeature(api.Feature.MULTISELECT_ENABLED);
    }

    if (options.origin) {
        builder = builder.setOrigin(options.origin);
    }

    const picker = builder.build();
    picker.setVisible(true);

    return picker;
}
