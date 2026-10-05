import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { MetricKpi } from './dashboard-ui';

describe('MetricKpi as a link', () => {
    afterEach(cleanup);

    it('keeps the definition button outside the link and names the link with the value', () => {
        const { container } = render(
            <MetricKpi
                href="#keputusan"
                linkLabel="2 butuh keputusan Anda, tinjau di bawah"
                label="Butuh keputusan Anda"
                definition="Update PIC yang meminta keputusan Direksi."
                value={2}
            />,
        );

        const link = screen.getByRole('link', {
            name: '2 butuh keputusan Anda, tinjau di bawah',
        });

        expect(link.getAttribute('href')).toBe('#keputusan');
        expect(container.querySelector('a button')).toBeNull();
        expect(screen.getByRole('button', { name: /Definisi/ })).toBeTruthy();
    });
});
