import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vite-plus/test';
import { nextTabIndex, SegmentedTabs } from './tabs';

describe('nextTabIndex', () => {
    it('moves focus with arrows, Home and End (wrapping)', () => {
        expect(nextTabIndex(0, 'ArrowRight', 3)).toBe(1);
        expect(nextTabIndex(2, 'ArrowRight', 3)).toBe(0);
        expect(nextTabIndex(0, 'ArrowLeft', 3)).toBe(2);
        expect(nextTabIndex(1, 'Home', 3)).toBe(0);
        expect(nextTabIndex(1, 'End', 3)).toBe(2);
        expect(nextTabIndex(1, 'Enter', 3)).toBeNull();
    });
});

function Harness() {
    const [value, setValue] = useState<'a' | 'b'>('a');

    return (
        <SegmentedTabs
            label="Tampilan"
            value={value}
            onValueChange={setValue}
            options={[
                { value: 'a', label: 'Daftar' },
                { value: 'b', label: 'Board' },
            ]}
        />
    );
}

describe('SegmentedTabs', () => {
    afterEach(cleanup);

    it('selects on click and on arrow keys, keeping one tab focusable', () => {
        render(<Harness />);
        const list = screen.getByRole('tab', { name: 'Daftar' });

        expect(list.getAttribute('aria-selected')).toBe('true');
        fireEvent.click(screen.getByRole('tab', { name: 'Board' }));
        expect(
            screen.getByRole('tab', { name: 'Board' }).getAttribute('tabindex'),
        ).toBe('0');

        fireEvent.keyDown(screen.getByRole('tab', { name: 'Board' }), {
            key: 'ArrowRight',
        });
        expect(list.getAttribute('aria-selected')).toBe('true');
        expect(document.activeElement).toBe(list);
    });
});
