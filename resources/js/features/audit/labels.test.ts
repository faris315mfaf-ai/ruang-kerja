import { describe, expect, it } from 'vitest';
import {
    actionLabel,
    actionOptions,
    changeSummary,
    diffRows,
    fieldLabel,
    formatValue,
} from './labels';

describe('actionLabel', () => {
    it('translates subject and verb', () => {
        expect(actionLabel('division.updated')).toBe('Divisi diubah');
        expect(actionLabel('team.restored')).toBe('Tim dipulihkan');
        expect(actionLabel('user.created')).toBe('Karyawan dibuat');
        expect(actionLabel('selfie.viewed')).toBe('Selfie dilihat');
    });

    it('handles special and unknown actions', () => {
        expect(actionLabel('user.roles_changed')).toBe('Peran karyawan diubah');
        expect(actionLabel('payroll.exported')).toBe('payroll.exported');
    });
});

describe('actionOptions', () => {
    it('adds a group entry for prefixes with several actions', () => {
        expect(
            actionOptions([
                'division.created',
                'division.updated',
                'user.roles_changed',
            ]),
        ).toEqual([
            { value: 'division.', label: 'Semua aksi divisi', group: true },
            { value: 'division.created', label: 'Divisi dibuat', group: false },
            { value: 'division.updated', label: 'Divisi diubah', group: false },
            {
                value: 'user.roles_changed',
                label: 'Peran karyawan diubah',
                group: false,
            },
        ]);
    });
});

describe('formatValue', () => {
    it('formats empty, booleans and numbers', () => {
        expect(formatValue('parent_id', null)).toBe('–');
        expect(formatValue('is_board', true)).toBe('Ya');
        expect(formatValue('is_board', false)).toBe('Tidak');
        expect(formatValue('level', 5)).toBe('5');
    });

    it('resolves referenced ids and enum labels', () => {
        expect(
            formatValue('head_user_id', '01ABC', { '01ABC': 'Agus Setiawan' }),
        ).toBe('Agus Setiawan');
        expect(formatValue('head_user_id', '01XYZ', {})).toBe('01XYZ');
        expect(formatValue('status', 'resigned')).toBe('Mengundurkan diri');
        expect(formatValue('work_mode', 'field')).toBe('Lapangan');
        expect(formatValue('roles', ['hr', 'kepala_divisi'])).toBe(
            'HR, Kepala Divisi',
        );
        expect(formatValue('roles', [])).toBe('Tanpa peran');
    });

    it('stringifies objects', () => {
        expect(formatValue('settings', { a: 1 })).toBe('{"a":1}');
    });
});

describe('diffRows & changeSummary', () => {
    it('compares before and after', () => {
        const rows = diffRows(
            { name: 'Keuangan', code: 'KEU' },
            { name: 'Keuangan & Pajak', code: 'KEU' },
        );

        expect(rows).toEqual([
            {
                key: 'name',
                label: 'Nama',
                before: 'Keuangan',
                after: 'Keuangan & Pajak',
                changed: true,
            },
            {
                key: 'code',
                label: 'Kode',
                before: 'KEU',
                after: 'KEU',
                changed: false,
            },
        ]);
    });

    it('treats created and deleted rows as fully changed', () => {
        expect(diffRows(null, { name: 'Legal' })[0].changed).toBe(true);
        expect(diffRows({ name: 'Legal' }, null)[0]).toMatchObject({
            before: 'Legal',
            after: null,
        });
    });

    it('summarises changed fields', () => {
        expect(changeSummary({ a: 1 }, { a: 1 })).toBe('–');
        expect(
            changeSummary(null, {
                name: 'x',
                code: 'y',
                level: 1,
                is_board: false,
            }),
        ).toBe('Nama, Kode, Level +1');
    });

    it('falls back to the raw key', () => {
        expect(fieldLabel('custom_flag')).toBe('custom_flag');
    });
});
