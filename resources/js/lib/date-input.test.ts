import { describe, expect, it } from 'vite-plus/test';

import {
    clampIsoDay,
    dateInputMessage,
    dateRangeError,
    isIsoDay,
    maskDateDraft,
    parseDateInput,
    resolveDateInput,
    shiftIsoDay,
} from './date-input';

describe('parseDateInput', () => {
    it.each([
        ['30/10/2026', '2026-10-30'],
        ['3/1/2026', '2026-01-03'],
        ['03/01/2026', '2026-01-03'],
        ['30-10-2026', '2026-10-30'],
        ['30.10.2026', '2026-10-30'],
        ['30 10 2026', '2026-10-30'],
        [' 30 / 10 / 2026 ', '2026-10-30'],
        ['30102026', '2026-10-30'],
        ['2026-10-30', '2026-10-30'],
        ['29/02/2028', '2028-02-29'],
    ])('reads "%s" as %s (day first)', (text, expected) => {
        expect(parseDateInput(text)).toBe(expected);
    });

    it('returns an empty string for blank text', () => {
        expect(parseDateInput('')).toBe('');
        expect(parseDateInput('   ')).toBe('');
    });

    it.each([
        '31/02/2026',
        '29/02/2026',
        '00/10/2026',
        '30/13/2026',
        '30/10/26',
        '10/30/2026',
        'Senin, 30/10/2026',
        '2026-02-30',
        'besok',
        '30/10',
    ])('rejects "%s"', (text) => {
        expect(parseDateInput(text)).toBeNull();
    });
});

describe('isIsoDay', () => {
    it('accepts only real calendar dates', () => {
        expect(isIsoDay('2026-10-30')).toBe(true);
        expect(isIsoDay('2026-02-29')).toBe(false);
        expect(isIsoDay('2026-10-30T00:00:00Z')).toBe(false);
        expect(isIsoDay('')).toBe(false);
        expect(isIsoDay(null)).toBe(false);
    });
});

describe('ranges', () => {
    it('reports values before min or after max', () => {
        expect(dateRangeError('2026-10-01', '2026-10-05')).toBe('before_min');
        expect(dateRangeError('2026-10-31', undefined, '2026-10-30')).toBe(
            'after_max',
        );
        expect(dateRangeError('2026-10-05', '2026-10-05', '2026-10-05')).toBe(
            null,
        );
        expect(dateRangeError('2026-10-05', '', '')).toBe(null);
    });

    it('clamps stepped dates', () => {
        expect(clampIsoDay('2026-10-01', '2026-10-05')).toBe('2026-10-05');
        expect(clampIsoDay('2026-11-01', null, '2026-10-30')).toBe(
            '2026-10-30',
        );
        expect(clampIsoDay('2026-10-10', '2026-10-05', '2026-10-30')).toBe(
            '2026-10-10',
        );
    });
});

describe('shiftIsoDay', () => {
    it('moves across month and year boundaries', () => {
        expect(shiftIsoDay('2026-10-31', 1)).toBe('2026-11-01');
        expect(shiftIsoDay('2027-01-01', -1)).toBe('2026-12-31');
        expect(shiftIsoDay('2028-02-28', 1)).toBe('2028-02-29');
    });
});

describe('resolveDateInput', () => {
    const range = { min: '2026-10-05', max: '2026-10-30', allowEmpty: true };

    it('returns the parsed value inside the range', () => {
        expect(resolveDateInput('6/10/2026', range)).toEqual({
            value: '2026-10-06',
        });
    });

    it('names the problem otherwise', () => {
        expect(resolveDateInput('1/10/2026', range)).toEqual({
            problem: 'before_min',
        });
        expect(resolveDateInput('31/10/2026', range)).toEqual({
            problem: 'after_max',
        });
        expect(resolveDateInput('99/99/9999', range)).toEqual({
            problem: 'invalid',
        });
    });

    it('allows emptying only when the field is clearable', () => {
        expect(resolveDateInput('', range)).toEqual({ value: '' });
        expect(resolveDateInput('', { ...range, allowEmpty: false })).toEqual({
            problem: 'required',
        });
    });
});

describe('dateInputMessage', () => {
    it('explains each problem in Indonesian with the day name', () => {
        expect(dateInputMessage('invalid')).toBe(
            'Tanggal tidak valid. Contoh: 30/10/2026.',
        );
        expect(dateInputMessage('required')).toBe('Tanggal wajib diisi.');
        expect(dateInputMessage('before_min', '2026-10-05')).toBe(
            'Tanggal paling awal Senin, 05/10/2026.',
        );
        expect(dateInputMessage('after_max', null, '2026-10-30')).toBe(
            'Tanggal paling lambat Jumat, 30/10/2026.',
        );
    });
});

describe('maskDateDraft', () => {
    it('adds a slash after the day and the month', () => {
        expect(maskDateDraft('3', '30')).toBe('30/');
        expect(maskDateDraft('30/1', '30/10')).toBe('30/10/');
        expect(maskDateDraft('3/1', '3/12')).toBe('3/12/');
    });

    it('does not double a typed slash or touch deletions', () => {
        expect(maskDateDraft('30/', '30//')).toBe('30/');
        expect(maskDateDraft('30/', '30')).toBe('30');
        expect(maskDateDraft('30/10/2', '30/10/20')).toBe('30/10/20');
        expect(maskDateDraft('', '30102026')).toBe('30102026');
    });
});
