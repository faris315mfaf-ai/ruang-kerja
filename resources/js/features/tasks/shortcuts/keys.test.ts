import { describe, expect, it } from 'vite-plus/test';
import { shortcutFor, stepId, toggleAssignee } from './keys';

const key = (k: string, extra: Partial<KeyboardEvent> = {}) => ({
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    ...extra,
});

describe('shortcutFor', () => {
    it('maps Linear keys', () => {
        expect(shortcutFor(key('j'))).toBe('next');
        expect(shortcutFor(key('K'))).toBe('previous');
        expect(shortcutFor(key('a'))).toBe('assign-me');
        expect(shortcutFor(key('s'))).toBe('status');
        expect(shortcutFor(key('p'))).toBe('priority');
        expect(shortcutFor(key('d'))).toBe('due');
        expect(shortcutFor(key('?', { shiftKey: true }))).toBe('help');
    });

    it('ignores modified keys and unknown keys', () => {
        expect(shortcutFor(key('s', { metaKey: true }))).toBeNull();
        expect(shortcutFor(key('j', { ctrlKey: true }))).toBeNull();
        expect(shortcutFor(key('J', { shiftKey: true }))).toBeNull();
        expect(shortcutFor(key('x'))).toBeNull();
    });
});

describe('stepId', () => {
    const ids = ['a', 'b', 'c'];

    it('walks and clamps', () => {
        expect(stepId(ids, 'a', 1)).toBe('b');
        expect(stepId(ids, 'c', 1)).toBe('c');
        expect(stepId(ids, 'a', -1)).toBe('a');
    });

    it('starts at an end when nothing is selected', () => {
        expect(stepId(ids, null, 1)).toBe('a');
        expect(stepId(ids, 'gone', -1)).toBe('c');
        expect(stepId([], null, 1)).toBeNull();
    });
});

describe('toggleAssignee', () => {
    it('adds or removes the viewer', () => {
        expect(toggleAssignee(['x'], 'me')).toEqual(['x', 'me']);
        expect(toggleAssignee(['x', 'me'], 'me')).toEqual(['x']);
    });
});
