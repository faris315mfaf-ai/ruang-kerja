import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { HocuspocusProvider } from '@hocuspocus/provider';
import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { createLaravelClient } from '../src/laravel.js';
import { createNotesExtension } from '../src/notes-extension.js';
import { docToJson } from '../src/prosemirror.js';

/*
 * Two editing sessions against a real Hocuspocus server and a stand-in for
 * the Laravel internal endpoints: changes reach the other session, viewers
 * stay read-only, a bad token is refused and the state is stored.
 */
const SECRET = 'integration-secret-integration-secret-1';
const NOTE = '01JAAAAAAAAAAAAAAAAAAAAAAA';
const HANA = '01JBBBBBBBBBBBBBBBBBBBBBBB';
const DEWI = '01JCCCCCCCCCCCCCCCCCCCCCCC';
const content = {
    type: 'doc',
    content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Isi awal' }] },
    ],
};

const stored = [];
let laravel;
let collab;
let url;

function token(user, edit = true, note = NOTE) {
    const body = Buffer.from(
        JSON.stringify({
            note,
            user,
            name: user === HANA ? 'Hana' : 'Dewi',
            edit,
            exp: Math.floor(Date.now() / 1000) + 60,
        }),
    ).toString('base64url');

    return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}

function waitFor(check, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const started = Date.now();
        const tick = () => {
            if (check()) {
                resolve();
            } else if (Date.now() - started > timeout) {
                reject(new Error('timed out'));
            } else {
                setTimeout(tick, 20);
            }
        };
        tick();
    });
}

function connect(user, edit = true, note = NOTE) {
    const provider = new HocuspocusProvider({
        url,
        name: note,
        token: token(user, edit, note),
        document: new Y.Doc(),
    });
    provider.awareness?.setLocalStateField('user', { id: user });

    return provider;
}

before(async () => {
    laravel = createServer((request, response) => {
        const chunks = [];
        request.on('data', (chunk) => chunks.push(chunk));
        request.on('end', () => {
            if (request.headers.authorization !== `Bearer ${SECRET}`) {
                response.writeHead(401).end('{}');

                return;
            }

            response.setHeader('Content-Type', 'application/json');

            if (request.method === 'GET') {
                response.end(
                    JSON.stringify({ id: NOTE, yjs_state: null, content }),
                );

                return;
            }

            stored.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            response.end(JSON.stringify({ stored: true }));
        });
    });
    await new Promise((resolve) => laravel.listen(0, '127.0.0.1', resolve));

    collab = new Server({
        port: 0,
        address: '127.0.0.1',
        quiet: true,
        stopOnSignals: false,
        debounce: 50,
        maxDebounce: 200,
        extensions: [
            createNotesExtension({
                laravel: createLaravelClient({
                    baseUrl: `http://127.0.0.1:${laravel.address().port}`,
                    secret: SECRET,
                }),
                secret: SECRET,
                logger: { error() {} },
            }),
        ],
    });
    await collab.listen();
    url = `ws://127.0.0.1:${collab.address.port}`;
});

after(async () => {
    await collab.destroy();
    await new Promise((resolve) => laravel.close(resolve));
});

void test('two sessions edit the same note and the state is stored', async () => {
    const hana = connect(HANA);
    const dewi = connect(DEWI);

    await waitFor(() => hana.isSynced && dewi.isSynced);
    assert.deepEqual(docToJson(dewi.document), content);

    const paragraph = hana.document.getXmlFragment('default').get(0);
    paragraph.get(0).insert(8, ' dari Hana');

    await waitFor(
        () =>
            docToJson(dewi.document)?.content[0].content[0].text ===
            'Isi awal dari Hana',
    );
    await waitFor(() => stored.some((body) => body.editor_ids.includes(HANA)));

    const last = stored.at(-1);
    assert.equal(last.body.content[0].content[0].text, 'Isi awal dari Hana');
    assert.ok(typeof last.yjs_state === 'string' && last.yjs_state.length > 0);

    // Presence: each session sees the other one.
    await waitFor(() => (hana.awareness?.getStates().size ?? 0) >= 2);

    hana.destroy();
    dewi.destroy();
});

void test('a read-only session cannot change the document', async () => {
    const reader = connect(DEWI, false);
    const writer = connect(HANA);

    await waitFor(() => reader.isSynced && writer.isSynced);
    reader.document.getXmlFragment('default').get(0).get(0).insert(0, 'X ');
    await new Promise((resolve) => setTimeout(resolve, 300));

    assert.ok(
        !docToJson(writer.document).content[0].content[0].text.startsWith('X '),
    );

    reader.destroy();
    writer.destroy();
});

void test('Laravel replaces the open document (restore) only with the secret', async () => {
    const hana = connect(HANA);
    await waitFor(() => hana.isSynced);
    const http = `http://127.0.0.1:${collab.address.port}`;
    const restored = {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Versi lama' }],
            },
        ],
    };

    const refused = await fetch(`${http}/internal/documents/${NOTE}/replace`, {
        method: 'POST',
        headers: {
            Authorization: 'Bearer wrong',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: restored }),
    });
    assert.equal(refused.status, 401);

    const accepted = await fetch(`${http}/internal/documents/${NOTE}/replace`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SECRET}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: restored }),
    });
    assert.deepEqual(await accepted.json(), { loaded: true });
    await waitFor(
        () =>
            docToJson(hana.document)?.content[0].content[0].text ===
            'Versi lama',
    );

    const unknown = await fetch(
        `${http}/internal/documents/01JZZZZZZZZZZZZZZZZZZZZZZZ/replace`,
        {
            method: 'POST',
            headers: { Authorization: `Bearer ${SECRET}` },
        },
    );
    assert.deepEqual(await unknown.json(), { loaded: false });

    hana.destroy();
});

void test('refuses a token for another note', async () => {
    let failed = false;
    const provider = new HocuspocusProvider({
        url,
        name: NOTE,
        token: token(HANA, true, '01JDDDDDDDDDDDDDDDDDDDDDDD'),
        document: new Y.Doc(),
        onAuthenticationFailed: () => {
            failed = true;
        },
    });

    await waitFor(() => failed);
    assert.equal(provider.isSynced, false);
    provider.destroy();
});
