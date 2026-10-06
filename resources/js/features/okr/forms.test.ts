import { describe, expect, it } from 'vitest';
import { draftFromKr, draftToPayload } from './lib';
import type { ObjectiveDraft } from './objective-form-dialog';
import { ownersFor, validateObjectiveDraft } from './objective-form-dialog';

const objectiveDraft = (
    over: Partial<ObjectiveDraft> = {},
): ObjectiveDraft => ({
    division_id: 'div-ops',
    quarter: '2026-Q4',
    title: 'Migrasi sistem gudang',
    description: '',
    owner_id: 'u-dimas',
    status: 'active',
    ...over,
});

describe('objective form', () => {
    it('validates a new objective like ObjectiveRequest', () => {
        expect(validateObjectiveDraft(objectiveDraft(), true)).toEqual({});
        expect(
            validateObjectiveDraft(
                objectiveDraft({ division_id: '', title: 'Ok', owner_id: '' }),
                true,
            ),
        ).toEqual({
            division_id: 'Pilih divisi.',
            title: 'Tulis objective minimal 5 karakter.',
            owner_id: 'Pilih pemilik.',
        });
        // Editing keeps the division: no division error.
        expect(
            validateObjectiveDraft(objectiveDraft({ division_id: '' }), false),
        ).toEqual({});
        expect(
            validateObjectiveDraft(
                objectiveDraft({ description: 'x'.repeat(2001) }),
                false,
            ).description,
        ).toBe('Deskripsi maksimal 2.000 karakter.');
    });

    it('offers the owners of the chosen division', () => {
        const people = [
            { id: 'a', name: 'Dimas', division_id: 'div-ops' },
            { id: 'b', name: 'Yudi', division_id: 'div-prg' },
        ];

        expect(ownersFor(people, 'div-ops').map((p) => p.id)).toEqual(['a']);
        expect(ownersFor(people, '')).toEqual([]);
        // Edit form: people without a division are the objective's division.
        expect(ownersFor([{ id: 'c', name: 'Sari' }], 'div-ops')).toHaveLength(
            1,
        );
    });
});

describe('key result payload', () => {
    it('parses Indonesian numbers and drops the label of other units', () => {
        const draft = {
            ...draftFromKr(null, 'u-sari'),
            title: '  Lead time tugas ',
            unit: 'days' as const,
            unit_label: 'abaikan',
            start_value: '6,5',
            target_value: '4',
            current_value: '1.250,25',
            weight: '30',
        };

        expect(draftToPayload(draft)).toEqual({
            title: 'Lead time tugas',
            unit: 'days',
            unit_label: '',
            start_value: 6.5,
            target_value: 4,
            current_value: 1250.25,
            weight: 30,
            owner_id: 'u-sari',
        });
        expect(
            draftToPayload({ ...draft, unit: 'number', unit_label: ' bug ' })
                .unit_label,
        ).toBe('bug');
    });
});
