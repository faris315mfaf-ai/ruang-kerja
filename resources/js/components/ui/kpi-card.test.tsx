import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { KpiBar, KpiCard } from './kpi-card';

describe('KpiCard', () => {
    afterEach(cleanup);

    it('places the bar between the value and the note (DHR "Hadir sekarang")', () => {
        const { container } = render(
            <KpiCard
                label="Hadir sekarang"
                value="7"
                note="50% · termasuk 0 terlambat"
                bar={<KpiBar value={50} label="Hadir dari yang terjadwal" />}
            >
                <span>anak</span>
            </KpiCard>,
        );
        const order = [...container.querySelector('section')!.children].map(
            (el) => el.getAttribute('role') ?? el.tagName,
        );

        expect(order).toEqual(['H3', 'P', 'progressbar', 'P', 'SPAN']);
    });

    it('clamps the bar value and exposes it to assistive tech', () => {
        render(<KpiBar value={140} label="Rata-rata kehadiran" />);
        const bar = screen.getByRole('progressbar', {
            name: 'Rata-rata kehadiran',
        });

        expect(bar.getAttribute('aria-valuenow')).toBe('100');
    });
});
