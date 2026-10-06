import { timingSafeEqual } from 'node:crypto';
import * as Y from 'yjs';
import { docToJson, replaceDoc } from './prosemirror.js';
import { verifyToken } from './token.js';

const NOTE_ID = /^[0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{26}$/;
const MAX_BODY_BYTES = 2_000_000;

function sameSecret(given, secret) {
    const a = Buffer.from(String(given));
    const b = Buffer.from(String(secret));

    return a.length === b.length && timingSafeEqual(a, b);
}

function readJson(request) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;

        request.on('data', (chunk) => {
            size += chunk.length;

            if (size > MAX_BODY_BYTES) {
                reject(Object.assign(new Error('payload too large'), { status: 413 }));
                request.destroy();

                return;
            }

            chunks.push(chunk);
        });
        request.on('end', () => {
            try {
                const text = Buffer.concat(chunks).toString('utf8');
                resolve(text === '' ? {} : JSON.parse(text));
            } catch {
                reject(Object.assign(new Error('invalid json'), { status: 400 }));
            }
        });
        request.on('error', reject);
    });
}

function send(response, status, body) {
    response.writeHead(status, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(body));
}

/**
 * Hocuspocus extension of RuangKerja notes:
 *
 * - onAuthenticate: the Laravel token (2 min) must be for this document;
 *   without edit rights the connection is read-only.
 * - onLoadDocument: Yjs state from Laravel, or the document rebuilt from
 *   the stored ProseMirror snapshot when Laravel dropped the state
 *   (restore, save fallback, notes created outside the editor).
 * - onChange / onStoreDocument: remembers who edited and pushes state +
 *   snapshot to Laravel (debounced by the server configuration).
 * - onRequest: GET /health and the internal Laravel → collab endpoints
 *   POST /internal/documents/{id}/replace|reconnect (Bearer secret).
 */
export function createNotesExtension({ laravel, secret, logger = console, now }) {
    /** documentName → ids of people who changed it since the last store. */
    const editors = new Map();

    return {
        extensionName: 'ruangkerja-notes',

        async onAuthenticate({ token, documentName, connectionConfig }) {
            const payload = verifyToken(token, secret, now?.());

            if (payload.note !== documentName) {
                throw new Error('token is for another note');
            }

            if (!payload.edit) {
                connectionConfig.readOnly = true;
            }

            return { user: { id: payload.user, name: payload.name, canEdit: payload.edit } };
        },

        async onLoadDocument({ document, documentName }) {
            const stored = await laravel.loadState(documentName);

            if (stored.yjs_state) {
                Y.applyUpdate(document, Buffer.from(stored.yjs_state, 'base64'));
            } else if (stored.content) {
                replaceDoc(document, stored.content);
            }

            return document;
        },

        async onChange({ documentName, context }) {
            const id = context?.user?.id;

            if (typeof id === 'string') {
                if (!editors.has(documentName)) {
                    editors.set(documentName, new Set());
                }

                editors.get(documentName).add(id);
            }
        },

        async onStoreDocument({ document, documentName }) {
            const ids = [...(editors.get(documentName) ?? [])];
            editors.delete(documentName);

            try {
                await laravel.storeState(documentName, {
                    state: Y.encodeStateAsUpdate(document),
                    content: docToJson(document),
                    editorIds: ids,
                });
            } catch (error) {
                // Keep the editors for the next attempt.
                const pending = editors.get(documentName) ?? new Set();
                ids.forEach((id) => pending.add(id));
                editors.set(documentName, pending);
                logger.error(`[collab] store ${documentName} failed: ${error.message}`);
                throw error;
            }
        },

        async onRequest({ request, response, instance }) {
            const url = new URL(request.url ?? '/', 'http://collab.local');

            if (url.pathname === '/health') {
                send(response, 200, { ok: true, documents: instance.getDocumentsCount() });
                throw null;
            }

            const match = /^\/internal\/documents\/([^/]+)\/(replace|reconnect)$/.exec(url.pathname);

            if (!match) {
                return;
            }

            const [, id, action] = match;
            const auth = String(request.headers.authorization ?? '');

            if (request.method !== 'POST') {
                send(response, 405, { message: 'method not allowed' });
                throw null;
            }

            if (!secret || !auth.startsWith('Bearer ') || !sameSecret(auth.slice(7), secret)) {
                send(response, 401, { message: 'unauthorized' });
                throw null;
            }

            if (!NOTE_ID.test(id)) {
                send(response, 404, { message: 'unknown document' });
                throw null;
            }

            try {
                const body = await readJson(request);
                const loaded = instance.documents.has(id);

                if (loaded && action === 'replace') {
                    const connection = await instance.openDirectConnection(id, { source: 'laravel' });
                    await connection.transact((document) => replaceDoc(document, body.content ?? null));
                    await connection.disconnect();
                }

                if (loaded && action === 'reconnect') {
                    instance.closeConnections(id);
                }

                send(response, 200, { loaded });
            } catch (error) {
                send(response, error.status ?? 500, { message: error.message });
            }

            throw null;
        },
    };
}
