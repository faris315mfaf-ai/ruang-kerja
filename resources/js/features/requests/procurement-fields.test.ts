import { describe, expect, it } from 'vitest';
import { procurementTotal } from './procurement-fields';

describe('procurementTotal', () => {
    it('multiplies quantity and unit price', () => {
        expect(procurementTotal('2', '15000000')).toBe(30000000);
        expect(procurementTotal('1', '0')).toBe(0);
    });

    it('is null while the input is incomplete or invalid', () => {
        expect(procurementTotal('', '1000')).toBeNull();
        expect(procurementTotal('2', '')).toBeNull();
        expect(procurementTotal('0', '1000')).toBeNull();
        expect(procurementTotal('1.5', '1000')).toBeNull();
        expect(procurementTotal('2', '-5')).toBeNull();
    });
});
