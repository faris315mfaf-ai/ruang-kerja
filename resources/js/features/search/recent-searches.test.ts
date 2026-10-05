import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import {
    clearRecentSearches,
    readRecentSearches,
    rememberSearch,
} from './recent-searches';

describe('recent searches', () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it('keeps the five most recent unique terms, newest first', () => {
        ['satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'DUA'].forEach(
            rememberSearch,
        );

        expect(readRecentSearches()).toEqual([
            'DUA',
            'enam',
            'lima',
            'empat',
            'tiga',
        ]);
    });

    it('ignores very short terms', () => {
        rememberSearch(' a ');

        expect(readRecentSearches()).toEqual([]);
    });

    it('survives broken or blocked storage', () => {
        window.localStorage.setItem('rk:recent-searches', '{oops');
        expect(readRecentSearches()).toEqual([]);

        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('QuotaExceeded');
        });
        expect(rememberSearch('anggaran')).toEqual(['anggaran']);

        clearRecentSearches();
    });
});
