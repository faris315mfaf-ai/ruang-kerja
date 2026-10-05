import { describe, expect, it } from 'vitest';
import { withCurrentPerson } from './person-options';

const active = [{ value: 'u1', label: 'Agus' }];

describe('withCurrentPerson', () => {
    it('keeps the list when the current person is active or absent', () => {
        expect(withCurrentPerson(active, null)).toBe(active);
        expect(withCurrentPerson(active, { id: 'u1', name: 'Agus' })).toBe(
            active,
        );
    });

    it('prepends an inactive current person', () => {
        expect(withCurrentPerson(active, { id: 'u2', name: 'Sari' })).toEqual([
            { value: 'u2', label: 'Sari', description: 'Nonaktif' },
            ...active,
        ]);
    });
});
