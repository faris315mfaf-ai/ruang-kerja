import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as Y from 'yjs';
import { docToJson, replaceDoc } from '../src/prosemirror.js';

const doc = {
    type: 'doc',
    content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'SOP onboarding' }] },
        {
            type: 'paragraph',
            content: [
                { type: 'text', text: 'Hari pertama ' },
                { type: 'text', text: 'wajib', marks: [{ type: 'bold' }] },
                { type: 'text', text: ' baca ' },
                { type: 'text', text: 'panduan', marks: [{ type: 'link', attrs: { href: 'https://example.test' } }] },
                { type: 'mention', attrs: { id: '01JBBBBBBBBBBBBBBBBBBBBBBB', label: 'Hana' } },
            ],
        },
        {
            type: 'taskList',
            content: [{ type: 'taskItem', attrs: { checked: true }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Akun email' }] }] }],
        },
    ],
};

test('round-trips a document through a Y.Doc', () => {
    const ydoc = new Y.Doc();
    replaceDoc(ydoc, doc);

    assert.deepEqual(docToJson(ydoc), doc);
});

test('survives encoding as a Yjs update (what Laravel stores)', () => {
    const source = new Y.Doc();
    replaceDoc(source, doc);
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(source));

    assert.deepEqual(docToJson(copy), doc);
});

test('replacing content syncs to another replica as a normal update', () => {
    const a = new Y.Doc();
    const b = new Y.Doc();
    a.on('update', (update) => Y.applyUpdate(b, update));
    replaceDoc(a, doc);

    const restored = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Versi lama' }] }] };
    replaceDoc(a, restored);

    assert.deepEqual(docToJson(b), restored);
});

test('an empty note keeps one paragraph for the editor', () => {
    const ydoc = new Y.Doc();
    replaceDoc(ydoc, null);

    assert.deepEqual(docToJson(ydoc), { type: 'doc', content: [{ type: 'paragraph' }] });
});

test('strips the hash of overlapping marks', () => {
    const ydoc = new Y.Doc();
    const text = new Y.XmlText();
    const paragraph = new Y.XmlElement('paragraph');
    ydoc.getXmlFragment('default').insert(0, [paragraph]);
    paragraph.insert(0, [text]);
    text.insert(0, 'hai', { 'comment--abcd1234': { id: 'c1' } });

    assert.deepEqual(docToJson(ydoc).content[0].content[0].marks, [{ type: 'comment', attrs: { id: 'c1' } }]);
});
