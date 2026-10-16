import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { WorkPointsEditor } from './work-points-editor';

afterEach(cleanup);

describe('WorkPointsEditor', () => {
    it('is the Rencana kerja at check-in', () => {
        render(
            <WorkPointsEditor
                kind="plan"
                points={['']}
                onChange={vi.fn()}
                error={null}
            />,
        );

        expect(screen.getByText('Rencana kerja')).toBeTruthy();
        expect(screen.getByLabelText('Poin rencana kerja 1')).toBeTruthy();
    });

    it('is the Laporan kerja at check-out, with the day-done hint', () => {
        render(
            <WorkPointsEditor
                kind="report"
                points={['Revisi desain', '']}
                onChange={vi.fn()}
                error={null}
            />,
        );

        expect(screen.getByText('Laporan kerja')).toBeTruthy();
        expect(
            screen.getByText(/Apa yang sudah Anda kerjakan hari ini\?/),
        ).toBeTruthy();
        expect(screen.getByLabelText('Poin laporan kerja 2')).toBeTruthy();
        expect(screen.getByLabelText('Hapus poin 2')).toBeTruthy();
    });

    it('edits, adds and removes points', () => {
        const onChange = vi.fn();
        render(
            <WorkPointsEditor
                kind="report"
                points={['A', 'B']}
                onChange={onChange}
                error={null}
            />,
        );

        fireEvent.change(screen.getByLabelText('Poin laporan kerja 1'), {
            target: { value: 'A2' },
        });
        expect(onChange).toHaveBeenLastCalledWith(['A2', 'B']);

        fireEvent.click(screen.getByText('Tambah poin'));
        expect(onChange).toHaveBeenLastCalledWith(['A', 'B', '']);

        fireEvent.click(screen.getByLabelText('Hapus poin 1'));
        expect(onChange).toHaveBeenLastCalledWith(['B']);
    });

    it('caps the list at 8 points and marks the inputs invalid with the error', () => {
        render(
            <WorkPointsEditor
                kind="report"
                points={Array.from({ length: 8 }, () => 'x')}
                onChange={vi.fn()}
                error="Tulis minimal satu poin laporan kerja hari ini sebelum absen pulang."
            />,
        );

        expect(screen.queryByText('Tambah poin')).toBeNull();
        expect(screen.getByRole('alert').textContent).toContain(
            'laporan kerja',
        );
        expect(
            screen
                .getByLabelText('Poin laporan kerja 1')
                .getAttribute('aria-invalid'),
        ).toBe('true');
    });
});
