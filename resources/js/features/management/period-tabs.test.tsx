import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { PeriodTabs } from './period-tabs';
import type { PeriodKey } from './types';

function Harness() {
    const [period, setPeriod] = useState<PeriodKey>('harian');

    return (
        <>
            <PeriodTabs value={period} onChange={setPeriod} />
            <output data-testid="period">{period}</output>
        </>
    );
}

const selected = () =>
    screen
        .getAllByRole('tab')
        .filter((tab) => tab.getAttribute('aria-selected') === 'true')
        .map((tab) => tab.textContent);

describe('PeriodTabs', () => {
    afterEach(cleanup);

    it('renders a labelled tablist with one selected, focusable tab', () => {
        render(<Harness />);

        expect(screen.getByRole('tablist', { name: 'Periode' })).toBeTruthy();
        expect(
            screen.getAllByRole('tab').map((tab) => tab.textContent),
        ).toEqual(['Harian', 'Mingguan', 'Bulanan']);
        expect(selected()).toEqual(['Harian']);
        expect(
            screen
                .getAllByRole('tab')
                .map((tab) => tab.getAttribute('tabindex')),
        ).toEqual(['0', '-1', '-1']);
    });

    it('switches period on click without a request', () => {
        render(<Harness />);

        fireEvent.click(screen.getByRole('tab', { name: 'Bulanan' }));

        expect(selected()).toEqual(['Bulanan']);
        expect(screen.getByTestId('period').textContent).toBe('bulanan');
    });

    it('moves selection and focus with the arrow keys, Home and End', () => {
        render(<Harness />);
        const harian = screen.getByRole('tab', { name: 'Harian' });
        harian.focus();

        fireEvent.keyDown(harian, { key: 'ArrowRight' });
        expect(selected()).toEqual(['Mingguan']);
        expect(document.activeElement?.textContent).toBe('Mingguan');

        fireEvent.keyDown(document.activeElement as Element, { key: 'End' });
        expect(selected()).toEqual(['Bulanan']);

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowRight',
        });
        expect(selected()).toEqual(['Harian']);

        fireEvent.keyDown(document.activeElement as Element, {
            key: 'ArrowLeft',
        });
        expect(selected()).toEqual(['Bulanan']);
    });
});
