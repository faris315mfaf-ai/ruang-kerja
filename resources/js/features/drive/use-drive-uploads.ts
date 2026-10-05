import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { HttpRequestError } from '@/lib/http';
import {
    runChunkedUpload,
    UploadCancelledError,
    UploadFailedError,
} from './chunked-upload';
import type { UploadPhase } from './chunked-upload';
import { formatFileSize } from './drive-files';
import type { UploadSessionData } from './types';
import { errorMessage, uploadTransport } from './upload-transport';

export type UploadItem = {
    key: string;
    name: string;
    phase: UploadPhase;
    sent: number;
    total: number;
    etaSeconds: number | null;
    message: string | null;
};

type StartOptions = {
    /** POST URL that opens the session. */
    url: string;
    body?: Record<string, unknown>;
    maxBytes: number;
    onDone?: (session: UploadSessionData) => void;
};

let counter = 0;

/**
 * Several chunked uploads at once with progress for the floating panel
 * (mockup WorkspaceFile: "Mengunggah Wireframe-v3.pdf · 64%").
 */
export function useDriveUploads() {
    const [items, setItems] = useState<UploadItem[]>([]);
    const controllers = useRef(new Map<string, AbortController>());

    const patch = useCallback((key: string, values: Partial<UploadItem>) => {
        setItems((current) =>
            current.map((item) =>
                item.key === key ? { ...item, ...values } : item,
            ),
        );
    }, []);

    const dismiss = useCallback((key: string) => {
        controllers.current.get(key)?.abort();
        controllers.current.delete(key);
        setItems((current) => current.filter((item) => item.key !== key));
    }, []);

    const upload = useCallback(
        async (file: File, { url, body, maxBytes, onDone }: StartOptions) => {
            if (file.size > maxBytes) {
                toast.error(
                    `${file.name} terlalu besar. Ukuran file maksimal ${formatFileSize(maxBytes)}.`,
                );

                return;
            }

            if (file.size === 0) {
                toast.error(`${file.name} kosong dan tidak bisa diunggah.`);

                return;
            }

            const key = `upload-${++counter}`;
            const controller = new AbortController();
            controllers.current.set(key, controller);
            setItems((current) => [
                ...current,
                {
                    key,
                    name: file.name,
                    phase: 'uploading',
                    sent: 0,
                    total: file.size,
                    etaSeconds: null,
                    message: null,
                },
            ]);

            try {
                const session = await runChunkedUpload(
                    file,
                    uploadTransport(file, url, body),
                    {
                        signal: controller.signal,
                        onProgress: (progress) => patch(key, progress),
                    },
                );

                patch(key, { phase: 'done', sent: file.size });
                toast.success(`${file.name} terunggah ke Google Drive.`);
                onDone?.(session);
                window.setTimeout(() => dismiss(key), 2500);
            } catch (error) {
                if (error instanceof UploadCancelledError) {
                    dismiss(key);

                    return;
                }

                const message =
                    error instanceof UploadFailedError
                        ? error.message
                        : error instanceof HttpRequestError
                          ? errorMessage(error, 'Gagal mengunggah file.')
                          : 'Gagal mengunggah file. Coba lagi.';

                patch(key, { phase: 'failed', message });
                toast.error(`${file.name}: ${message}`);
            } finally {
                controllers.current.delete(key);
            }
        },
        [dismiss, patch],
    );

    const uploadMany = useCallback(
        (files: FileList | File[] | null, options: StartOptions) => {
            for (const file of Array.from(files ?? [])) {
                void upload(file, options);
            }
        },
        [upload],
    );

    return { items, upload, uploadMany, dismiss };
}
