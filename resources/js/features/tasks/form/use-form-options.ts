import { useEffect, useState } from 'react';
import { formOptions } from '@/routes/tasks';
import { requestJson } from '../lib/api';
import type { WorkspaceTaskOptions } from '../types';

let cache: Promise<WorkspaceTaskOptions[]> | null = null;

/** Forget cached options (after creating a workspace or changing members). */
export function clearFormOptionsCache(): void {
    cache = null;
}

function load(): Promise<WorkspaceTaskOptions[]> {
    cache ??= requestJson<{ workspaces: WorkspaceTaskOptions[] }>(formOptions())
        .then((response) => response.workspaces)
        .catch((error: unknown) => {
            cache = null;
            throw error;
        });

    return cache;
}

/**
 * Workspaces where the user can create tasks, with columns, labels and
 * members (GET /tugas/opsi-form). Loaded lazily, once per page session.
 */
export function useFormOptions(enabled: boolean) {
    const [options, setOptions] = useState<WorkspaceTaskOptions[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let active = true;

        load()
            .then((workspaces) => {
                if (active) {
                    setOptions(workspaces);
                    setError(null);
                }
            })
            .catch((reason: unknown) => {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : 'Gagal memuat daftar workspace.',
                    );
                }
            });

        return () => {
            active = false;
        };
    }, [enabled]);

    return { options, error };
}
