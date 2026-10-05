import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { requestJson } from '@/lib/http';
import type { DriveFileData } from './types';
import { errorMessage } from './upload-transport';

type Created = {
    file?: DriveFileData;
    web_view_link?: string;
    message: string;
};

/**
 * "Dokumen baru" is created synchronously on the server (≤ 10 s) and then
 * opened in Google. The tab is opened during the click (popup blockers
 * allow that) and pointed at the document once it exists.
 */
export function useCreateDocument({ fake = false }: { fake?: boolean } = {}) {
    const [creating, setCreating] = useState(false);

    const create = useCallback(
        async <T extends Created>(
            url: string,
            body: Record<string, unknown>,
        ): Promise<T | null> => {
            setCreating(true);
            const tab = fake ? null : window.open('about:blank', '_blank');

            try {
                const created = await requestJson<T>(url, {
                    method: 'POST',
                    body,
                });
                const link =
                    created.file?.web_view_link ?? created.web_view_link;

                if (tab && link) {
                    tab.opener = null;
                    tab.location.href = link;
                }

                toast.success(
                    fake
                        ? `${created.message} (mode Drive palsu: dokumen tidak dibuka)`
                        : created.message,
                );

                return created;
            } catch (error) {
                tab?.close();
                toast.error(
                    errorMessage(
                        error,
                        'Dokumen gagal dibuat. Coba lagi sebentar lagi.',
                    ),
                );

                return null;
            } finally {
                setCreating(false);
            }
        },
        [fake],
    );

    return { create, creating };
}
