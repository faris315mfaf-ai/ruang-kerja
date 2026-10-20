import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

const post = vi.hoisted(() => vi.fn());

vi.mock('@inertiajs/react', () => ({
    router: { post },
}));
vi.mock('@/routes/hr/assignments', () => ({
    store: { url: () => '/hr/penugasan' },
}));

import { AssignForm, canSubmitAssignment, submitLabel } from './assign-form';
import type { AssignmentPickers } from './types';

const pickers: AssignmentPickers = {
    people: [
        {
            id: '01hrpeople0000000000000001',
            name: 'Bayu Saputra',
            division: 'Operasional',
        },
    ],
    divisions: [
        { id: '01hrdivision00000000000001', name: 'Keuangan', people: 8 },
    ],
    teams: [],
};

const submit = () => screen.getByRole('button', { name: /^Tugaskan/ });

describe('AssignForm (Tugaskan pegawai)', () => {
    afterEach(() => {
        cleanup();
        post.mockReset();
    });

    it('needs recipients and a title before it can be sent', () => {
        expect(canSubmitAssignment([], 'Isi survei')).toBe(false);
        expect(canSubmitAssignment([{ type: 'user', id: 'a' }], '   ')).toBe(
            false,
        );
        expect(
            canSubmitAssignment([{ type: 'user', id: 'a' }], 'Isi survei'),
        ).toBe(true);
        expect(submitLabel(9, false)).toBe('Tugaskan 9 orang');
        expect(submitLabel(9, true)).toBe('Tugaskan ± 9 orang');
        expect(submitLabel(0, false)).toBe('Tugaskan');
    });

    it('keeps the submit disabled until a recipient and a title are set', () => {
        render(
            <AssignForm
                pickers={pickers}
                limits={{ recipients: 200, checklist: 20 }}
                today="2026-10-20"
            />,
        );

        expect(submit().hasAttribute('disabled')).toBe(true);

        fireEvent.change(screen.getByLabelText('Judul tugas'), {
            target: { value: 'Isi survei kepuasan kerja' },
        });
        expect(submit().hasAttribute('disabled')).toBe(true);

        const combobox = screen.getByRole('combobox', {
            name: 'Tambah penerima',
        });
        fireEvent.focus(combobox);
        fireEvent.change(combobox, { target: { value: 'keu' } });
        fireEvent.mouseDown(
            screen.getByRole('option', { name: /Divisi Keuangan/ }),
        );

        expect(screen.getByText('8 orang menerima tugas ini.')).toBeTruthy();
        expect(submit().hasAttribute('disabled')).toBe(false);
        expect(submit().textContent).toBe('Tugaskan 8 orang');

        fireEvent.click(submit());
        expect(post).toHaveBeenCalledTimes(1);
        expect(post.mock.calls[0][0]).toBe('/hr/penugasan');
        expect(post.mock.calls[0][1]).toMatchObject({
            division_ids: ['01hrdivision00000000000001'],
            user_ids: [],
            mode: 'per_person',
            title: 'Isi survei kepuasan kerja',
            priority: 3,
            checklist: [],
        });
    });

    it('removes a recipient chip with its × button', () => {
        render(
            <AssignForm
                pickers={pickers}
                limits={{ recipients: 200, checklist: 20 }}
                today="2026-10-20"
            />,
        );
        const combobox = screen.getByRole('combobox', {
            name: 'Tambah penerima',
        });
        fireEvent.focus(combobox);
        fireEvent.change(combobox, { target: { value: 'bayu' } });
        fireEvent.mouseDown(
            screen.getByRole('option', { name: /Bayu Saputra/ }),
        );

        fireEvent.click(
            screen.getByRole('button', { name: 'Hapus Bayu Saputra' }),
        );
        expect(
            screen.queryByRole('button', { name: 'Hapus Bayu Saputra' }),
        ).toBeNull();
    });
});
