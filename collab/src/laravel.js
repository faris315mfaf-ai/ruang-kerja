/**
 * Collab server → Laravel internal endpoints (routes/notes.php,
 * VerifyCollabSecret): load and store the state of a note document.
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
        loadState(noteId) {
            return call(
                'GET',
                `/internal/catatan/${encodeURIComponent(noteId)}/state`,
            );
        },

        /** state: Uint8Array (Y.encodeStateAsUpdate), content: ProseMirror JSON|null */
        storeState(noteId, { state, content, editorIds }) {
            return call(
                'POST',
                `/internal/catatan/${encodeURIComponent(noteId)}/state`,
                {
                    yjs_state: Buffer.from(state).toString('base64'),
                    body: content,
                    editor_ids: editorIds,
                },
            );
        },
    };
}
