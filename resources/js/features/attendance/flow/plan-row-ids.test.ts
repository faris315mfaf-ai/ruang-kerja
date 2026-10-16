import { describe, expect, it } from 'vite-plus/test';
import { resizeRowIds } from './plan-row-ids';

describe('resizeRowIds', () => {
    it('keeps existing ids and appends unique new ones', () => {
        const two = resizeRowIds([], 2);
        const three = resizeRowIds(two, 3);

        expect(three.slice(0, 2)).toEqual(two);
        expect(new Set(three).size).toBe(3);
    });

    it('truncates from the end', () => {
        expect(resizeRowIds(['a', 'b', 'c'], 1)).toEqual(['a']);
    });
});
