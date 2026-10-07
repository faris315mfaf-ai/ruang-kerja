import * as Y from 'yjs';

/**
 * Y.XmlFragment <-> ProseMirror JSON without a schema, in the encoding of
 * y-prosemirror / @tiptap/y-tiptap (what the Tiptap Collaboration extension
 * writes): elements are Y.XmlElement(nodeName) with the node attrs as
 * attributes, runs of text are one Y.XmlText whose formatting attributes are
 * the marks ({ bold: {}, link: { href } }; overlapping marks carry a
 * "--hash" suffix). Laravel sanitizes the JSON (RichText whitelist), so
 * unknown nodes are passed through here and dropped there.
 */

/** Name of the shared fragment of the Tiptap Collaboration extension. */
export const FIELD = 'default';

const MARK_SUFFIX = /(.*)(--[a-zA-Z0-9+/=]{8})$/;

function markName(attribute) {
    return MARK_SUFFIX.exec(attribute)?.[1] ?? attribute;
}

function textNodes(text) {
    return text
        .toDelta()
        .filter((part) => typeof part.insert === 'string' && part.insert !== '')
        .map((part) => {
            const marks = Object.entries(part.attributes ?? {})
                .filter(([, attrs]) => attrs !== null && attrs !== undefined)
                .map(([name, attrs]) => {
                    const mark = { type: markName(name) };

                    if (
                        attrs &&
                        typeof attrs === 'object' &&
                        Object.keys(attrs).length > 0
                    ) {
                        mark.attrs = attrs;
                    }

                    return mark;
                });

            return marks.length > 0
                ? { type: 'text', text: part.insert, marks }
                : { type: 'text', text: part.insert };
        });
}

function elementToJson(element) {
    const node = { type: element.nodeName };
    const attrs = element.getAttributes();

    if (Object.keys(attrs).length > 0) {
        node.attrs = attrs;
    }

    const content = childrenToJson(element);

    if (content.length > 0) {
        node.content = content;
    }

    return node;
}

function childrenToJson(parent) {
    return parent.toArray().flatMap((child) => {
        if (child instanceof Y.XmlText) {
            return textNodes(child);
        }

        if (child instanceof Y.XmlElement) {
            return [elementToJson(child)];
        }

        return [];
    });
}

/**
 * ProseMirror document of a Y.Doc (null when it has no content at all).
 */
export function docToJson(ydoc, field = FIELD) {
    const content = childrenToJson(ydoc.getXmlFragment(field));

    return content.length > 0 ? { type: 'doc', content } : null;
}

function marksToAttributes(marks) {
    const attributes = {};

    for (const mark of marks ?? []) {
        if (mark && typeof mark.type === 'string') {
            attributes[mark.type] = mark.attrs ?? {};
        }
    }

    return attributes;
}

function jsonChildrenToTypes(content) {
    const types = [];
    let run = null;

    for (const node of Array.isArray(content) ? content : []) {
        if (!node || typeof node.type !== 'string') {
            continue;
        }

        if (node.type === 'text') {
            if (typeof node.text !== 'string' || node.text === '') {
                continue;
            }

            if (run === null) {
                run = [];
                types.push(run);
            }

            run.push(node);
            continue;
        }

        run = null;
        types.push(node);
    }

    return types.map((item) => {
        if (Array.isArray(item)) {
            const text = new Y.XmlText();
            text.applyDelta(
                item.map((node) => ({
                    insert: node.text,
                    attributes: marksToAttributes(node.marks),
                })),
            );

            return text;
        }

        const element = new Y.XmlElement(item.type);

        for (const [key, value] of Object.entries(item.attrs ?? {})) {
            if (value !== null && value !== undefined) {
                element.setAttribute(key, value);
            }
        }

        element.insert(0, jsonChildrenToTypes(item.content));

        return element;
    });
}

/**
 * Replaces the whole content of the document with `json` (a ProseMirror
 * doc, or null for an empty note) in one transaction, so connected editors
 * receive it as a normal update.
 */
export function replaceDoc(ydoc, json, field = FIELD, origin = null) {
    const fragment = ydoc.getXmlFragment(field);

    ydoc.transact(() => {
        if (fragment.length > 0) {
            fragment.delete(0, fragment.length);
        }

        const content = json && json.type === 'doc' ? json.content : [];
        const types = jsonChildrenToTypes(content);

        // An empty note still needs one paragraph for the editor.
        fragment.insert(
            0,
            types.length > 0 ? types : [new Y.XmlElement('paragraph')],
        );
    }, origin);
}
