import { describe, expect, it } from 'vite-plus/test';

import type { Priority } from '../types';
import { prioritySortWeight } from './priority';

describe('prioritySortWeight', () => {
    it('sorts urgent first and none last', () => {
        const sorted = ([0, 3, 1, 4, 2] as Priority[]).sort(
            (a, b) => prioritySortWeight(a) - prioritySortWeight(b),
        );

        expect(sorted).toEqual([1, 2, 3, 4, 0]);
    });
});
