/**
 * Meeting minutes of the video room ("Notulen Hidup",
 * docs/fitur/rapat-video-kontrak.md §1.4): document "meeting-minutes.{ulid}"
 * is stored by routes/meetings.php instead of the notes endpoints.
 */
export const MINUTES_DOCUMENT =
    /^meeting-minutes\.([0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26})$/;

/** Laravel path of the state of a document (note id or meeting-minutes.{id}). */
export function statePath(documentName) {
    const minutes = MINUTES_DOCUMENT.exec(documentName);

    return minutes
        ? `/internal/rapat/notulen/${minutes[1]}/state`
        : `/internal/catatan/${encodeURIComponent(documentName)}/state`;
}

/**
 * Collab server → Laravel internal endpoints (routes/notes.php and
 * routes/meetings.php, VerifyCollabSecret): load and store the state of a
 * note or meeting-minutes document.
 */
export function createLaravelClient({
    baseUrl,
    secret,
    fetch = globalThis.fetch,
    timeoutMs = 10000,
}) {
    const root = String(baseUrl).replace(/\/+$/, '');

    async function call(method, path, body) {
        const headers = {
            Accept: 'application/json',
            Authorization: `Bearer ${secret}`,
        };
        const init =
            body === undefined
                ? { method, headers }
                : {
                      method,
                      headers: {
                          ...headers,
                          'Content-Type': 'application/json',
                      },
                      body: JSON.stringify(body),
                  };
        const response = await fetch(`${root}${path}`, {
            ...init,
            signal: AbortSignal.timeout(timeoutMs),
        });

        if (!response.ok) {
            const error = new Error(
                `Laravel ${method} ${path} answered ${response.status}`,
            );
            error.status = response.status;
            throw error;
        }

        return response.json();
    }

    return {
        /** { id, title, yjs_state: base64|null, content: ProseMirror JSON|null } */
        loadState(documentName) {
            return call('GET', statePath(documentName));
        },

        /** state: Uint8Array (Y.encodeStateAsUpdate), content: ProseMirror JSON|null */
        storeState(documentName, { state, content, editorIds }) {
            return call('POST', statePath(documentName), {
                yjs_state: Buffer.from(state).toString('base64'),
                body: content,
                editor_ids: editorIds,
            });
        },
    };
}
