import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import * as Y from 'yjs';
import { createLaravelClient } from '../src/laravel.js';
import { createNotesExtension } from '../src/notes-extension.js';
import { docToJson, replaceDoc } from '../src/prosemirror.js';

const SECRET = 'test-secret-test-secret-test-secret-123';
const NOTE = '01JAAAAAAAAAAAAAAAAAAAAAAA';
const USER = '01JBBBBBBBBBBBBBBBBBBBBBBB';
const NOW = 1_800_000_000;
const silent = { error() {} };

function token(payload) {
    const body = Buffer.from(JSON.stringify({ note: NOTE, user: USER, name: 'Hana', edit: true, exp: NOW + 60, ...payload })).toString('base64url');

    return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

/** fetch double that records calls and answers from a route table. */
function fakeFetch(routes) {
    const calls = [];
    const fetch = async (url, init) => {
        calls.push({ url, method: init.method, headers: init.headers, body: init.body ? JSON.parse(init.body) : undefined });
        const answer = routes[`${init.method} ${new URL(url).pathname}`] ?? { status: 404, body: {} };

        return new Response(JSON.stringify(answer.body), { status: answer.status ?? 200 });
    };

    return { fetch, calls };
}

const sample = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Isi catatan' }] }] };

test('authenticates with a token for this note and makes viewers read-only', async () => {
    const extension = createNotesExtension({ laravel: {}, secret: SECRET, now: () => NOW });
    const editConfig = { readOnly: false };
    const viewConfig = { readOnly: false };

    const context = await extension.onAuthenticate({ token: token(), documentName: NOTE, connectionConfig: editConfig });
    await extension.onAuthenticate({ token: token({ edit: false }), documentName: NOTE, connectionConfig: viewConfig });

    assert.deepEqual(context.user, { id: USER, name: 'Hana', canEdit: true });
    assert.equal(editConfig.readOnly, false);
    assert.equal(viewConfig.readOnly, true);
});

test('refuses a token issued for another note', async () => {
    const extension = createNotesExtension({ laravel: {}, secret: SECRET, now: () => NOW });

    await assert.rejects(
        extension.onAuthenticate({ token: token({ note: '01JCCCCCCCCCCCCCCCCCCCCCCC' }), documentName: NOTE, connectionConfig: {} }),
        /another note/,
    );
});

test('loads the stored Yjs state through the internal endpoint with the secret', async () => {
    const source = new Y.Doc();
    replaceDoc(source, sample);
    const { fetch, calls } = fakeFetch({
        [`GET /internal/catatan/${NOTE}/state`]: { body: { id: NOTE, yjs_state: Buffer.from(Y.encodeStateAsUpdate(source)).toString('base64'), content: null } },
    });
    const laravel = createLaravelClient({ baseUrl: 'https://app.test/', secret: SECRET, fetch });
    const extension = createNotesExtension({ laravel, secret: SECRET });
    const document = new Y.Doc();

    await extension.onLoadDocument({ document, documentName: NOTE });

    assert.deepEqual(docToJson(document), sample);
    assert.equal(calls[0].url, `https://app.test/internal/catatan/${NOTE}/state`);
    assert.equal(calls[0].headers.Authorization, `Bearer ${SECRET}`);
});

test('rebuilds the document from the snapshot when Laravel dropped the state', async () => {
    const { fetch } = fakeFetch({
        [`GET /internal/catatan/${NOTE}/state`]: { body: { id: NOTE, yjs_state: null, content: sample } },
    });
    const extension = createNotesExtension({ laravel: createLaravelClient({ baseUrl: 'https://app.test', secret: SECRET, fetch }), secret: SECRET });
    const document = new Y.Doc();

    await extension.onLoadDocument({ document, documentName: NOTE });

    assert.deepEqual(docToJson(document), sample);
});

test('stores state, snapshot and the editors since the last store', async () => {
    const { fetch, calls } = fakeFetch({ [`POST /internal/catatan/${NOTE}/state`]: { body: { stored: true } } });
    const extension = createNotesExtension({ laravel: createLaravelClient({ baseUrl: 'https://app.test', secret: SECRET, fetch }), secret: SECRET });
    const document = new Y.Doc();
    replaceDoc(document, sample);

    await extension.onChange({ documentName: NOTE, context: { user: { id: USER } } });
    await extension.onStoreDocument({ document, documentName: NOTE });
    await extension.onStoreDocument({ document, documentName: NOTE });

    const [first, second] = calls;
    assert.equal(first.method, 'POST');
    assert.deepEqual(first.body.body, sample);
    assert.deepEqual(first.body.editor_ids, [USER]);
    assert.deepEqual(second.body.editor_ids, []);

    const copy = new Y.Doc();
    Y.applyUpdate(copy, Buffer.from(first.body.yjs_state, 'base64'));
    assert.deepEqual(docToJson(copy), sample);
});

test('keeps the editors when Laravel refuses the store', async () => {
    const { fetch, calls } = fakeFetch({ [`POST /internal/catatan/${NOTE}/state`]: { status: 500, body: {} } });
    const extension = createNotesExtension({ laravel: createLaravelClient({ baseUrl: 'https://app.test', secret: SECRET, fetch }), secret: SECRET, logger: silent });
    const document = new Y.Doc();
    replaceDoc(document, sample);

    await extension.onChange({ documentName: NOTE, context: { user: { id: USER } } });
    await assert.rejects(extension.onStoreDocument({ document, documentName: NOTE }), /500/);
    await assert.rejects(extension.onStoreDocument({ document, documentName: NOTE }), /500/);

    assert.deepEqual(calls[1].body.editor_ids, [USER]);
});
