import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { DateInput, DatePickerTrigger } from './date-input';

function Controlled({
    initial = '',
    onValue,
    ...props
}: Omit<React.ComponentProps<typeof DateInput>, 'value' | 'onChange'> & {
    initial?: string;
    onValue?: (value: string) => void;
}) {
    const [value, setValue] = useState(initial);

    return (
        <>
            <label htmlFor="tgl">Tanggal</label>
            <DateInput
                id="tgl"
                value={value}
                onChange={(next) => {
                    setValue(next);
                    onValue?.(next);
                }}
                {...props}
            />
            <output data-testid="value">{value}</output>
        </>
    );
}

const field = () => screen.getByLabelText('Tanggal') as HTMLInputElement;
const value = () => screen.getByTestId('value').textContent;

function type(text: string) {
    fireEvent.focus(field());
    fireEvent.change(field(), { target: { value: text } });
}

describe('DateInput', () => {
    afterEach(cleanup);

    it('shows the value as "Hari, dd/mm/yyyy" and the editable form on focus', () => {
        render(<Controlled initial="2026-10-30" />);

        expect(field().value).toBe('Jumat, 30/10/2026');

        fireEvent.focus(field());
        expect(field().value).toBe('30/10/2026');

        fireEvent.blur(field());
        expect(field().value).toBe('Jumat, 30/10/2026');
    });

    it('shows the placeholder when empty', () => {
        render(<Controlled />);

        expect(field().value).toBe('');
        expect(field().placeholder).toBe('Pilih tanggal');

        fireEvent.focus(field());
        expect(field().placeholder).toBe('dd/mm/yyyy');
    });

    it.each([
        ['5/10/2026', '2026-10-05'],
        ['05-10-2026', '2026-10-05'],
        ['05102026', '2026-10-05'],
    ])('commits typed "%s" on blur', (text, expected) => {
        const onValue = vi.fn();
        render(<Controlled onValue={onValue} />);

        type(text);
        expect(onValue).not.toHaveBeenCalled();

        fireEvent.blur(field());
        expect(onValue).toHaveBeenCalledWith(expected);
        expect(field().value).toBe('Senin, 05/10/2026');
    });

    it('commits on Enter before a form submit reads the value', () => {
        let submitted = '';

        function Form() {
            const [date, setDate] = useState('');

            return (
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        submitted = date;
                    }}
                >
                    <DateInput
                        aria-label="Tanggal"
                        value={date}
                        onChange={setDate}
                    />
                </form>
            );
        }

        render(<Form />);
        type('30/10/2026');
        fireEvent.keyDown(field(), { key: 'Enter' });
        fireEvent.submit(field().form!);

        expect(submitted).toBe('2026-10-30');
    });

    it('keeps the previous value and explains an invalid date', () => {
        const onValue = vi.fn();
        render(<Controlled initial="2026-10-05" onValue={onValue} />);

        type('31/02/2026');
        fireEvent.blur(field());

        expect(onValue).not.toHaveBeenCalled();
        expect(value()).toBe('2026-10-05');
        expect(field().value).toBe('Senin, 05/10/2026');
        expect(field().getAttribute('aria-invalid')).toBe('true');
        expect(screen.getByText(/Tanggal tidak valid/)).toBeTruthy();
        expect(field().getAttribute('aria-describedby')).toContain(
            'tgl-message',
        );
    });

    it('rejects dates outside min and max', () => {
        render(
            <Controlled
                initial="2026-10-10"
                min="2026-10-05"
                max="2026-10-30"
            />,
        );

        type('01/10/2026');
        fireEvent.blur(field());
        expect(value()).toBe('2026-10-10');
        expect(
            screen.getByText('Tanggal paling awal Senin, 05/10/2026.'),
        ).toBeTruthy();

        type('31/10/2026');
        fireEvent.blur(field());
        expect(value()).toBe('2026-10-10');
        expect(
            screen.getByText('Tanggal paling lambat Jumat, 30/10/2026.'),
        ).toBeTruthy();

        type('30/10/2026');
        fireEvent.blur(field());
        expect(value()).toBe('2026-10-30');
        expect(field().getAttribute('aria-invalid')).toBeNull();
    });

    it('forwards aria-invalid and aria-describedby from the caller', () => {
        render(
            <Controlled
                initial="2026-10-05"
                aria-invalid
                aria-describedby="server-error"
            />,
        );

        expect(field().getAttribute('aria-invalid')).toBe('true');
        expect(field().getAttribute('aria-describedby')).toContain(
            'server-error',
        );
    });

    it('clears with the × button when not required', () => {
        render(<Controlled initial="2026-10-05" />);

        fireEvent.click(screen.getByRole('button', { name: 'Hapus tanggal' }));
        expect(value()).toBe('');
        expect(document.activeElement).toBe(field());

        fireEvent.blur(field());
        expect(value()).toBe('');
        expect(
            screen.queryByRole('button', { name: 'Hapus tanggal' }),
        ).toBeNull();
    });

    it('clears by deleting the text when clearable', () => {
        render(<Controlled initial="2026-10-05" />);

        type('');
        fireEvent.blur(field());
        expect(value()).toBe('');
    });

    it('has no × button and refuses emptying when required or not clearable', () => {
        const { unmount } = render(
            <Controlled initial="2026-10-05" required />,
        );

        expect(
            screen.queryByRole('button', { name: 'Hapus tanggal' }),
        ).toBeNull();
        type('');
        fireEvent.blur(field());
        expect(value()).toBe('2026-10-05');
        expect(screen.getByText('Tanggal wajib diisi.')).toBeTruthy();
        unmount();

        render(<Controlled initial="2026-10-05" clearable={false} />);
        expect(
            screen.queryByRole('button', { name: 'Hapus tanggal' }),
        ).toBeNull();
        expect(field().required).toBe(false);
    });

    it('steps one day with the arrow keys within min/max and undoes with Escape', () => {
        render(<Controlled initial="2026-10-30" max="2026-10-31" />);

        fireEvent.focus(field());
        fireEvent.keyDown(field(), { key: 'ArrowUp' });
        expect(field().value).toBe('31/10/2026');
        fireEvent.keyDown(field(), { key: 'ArrowUp' });
        expect(field().value).toBe('31/10/2026');
        fireEvent.keyDown(field(), { key: 'ArrowDown' });
        fireEvent.keyDown(field(), { key: 'ArrowDown' });
        expect(field().value).toBe('29/10/2026');

        fireEvent.keyDown(field(), { key: 'Escape' });
        expect(field().value).toBe('30/10/2026');

        fireEvent.keyDown(field(), { key: 'ArrowDown' });
        fireEvent.keyDown(field(), { key: 'Enter' });
        expect(value()).toBe('2026-10-29');
    });

    it('opens the native picker from the calendar button and Alt+↓', () => {
        const { container } = render(
            <Controlled initial="2026-10-05" min="2026-10-01" />,
        );
        const native = container.querySelector(
            'input[type="date"]',
        ) as HTMLInputElement;
        const showPicker = vi.fn();
        native.showPicker = showPicker;

        expect(native.tabIndex).toBe(-1);
        expect(native.getAttribute('aria-hidden')).toBe('true');
        expect(native.min).toBe('2026-10-01');
        expect(native.value).toBe('2026-10-05');

        fireEvent.click(screen.getByRole('button', { name: 'Buka kalender' }));
        expect(showPicker).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(field(), { key: 'ArrowDown', altKey: true });
        expect(showPicker).toHaveBeenCalledTimes(2);
    });

    it('falls back to focusing the native input when showPicker is missing or fails', () => {
        const { container } = render(<Controlled />);
        const native = container.querySelector(
            'input[type="date"]',
        ) as HTMLInputElement;
        native.showPicker = () => {
            throw new DOMException('no gesture', 'NotAllowedError');
        };
        const click = vi.spyOn(native, 'click');

        fireEvent.click(screen.getByRole('button', { name: 'Buka kalender' }));
        expect(document.activeElement).toBe(native);
        expect(click).toHaveBeenCalled();
    });

    it('takes the date picked in the native picker', () => {
        const { container } = render(<Controlled />);
        const native = container.querySelector(
            'input[type="date"]',
        ) as HTMLInputElement;

        fireEvent.change(native, { target: { value: '2026-10-07' } });
        expect(value()).toBe('2026-10-07');
        expect(field().value).toBe('Rabu, 07/10/2026');
    });

    it('adds a hidden input with the ISO value for plain forms', () => {
        const { container } = render(
            <Controlled initial="2026-10-05" name="due_date" />,
        );
        const hidden = container.querySelector(
            'input[type="hidden"][name="due_date"]',
        ) as HTMLInputElement;

        expect(hidden.value).toBe('2026-10-05');
    });

    it('is keyboard reachable: text, then clear, then calendar', () => {
        render(<Controlled initial="2026-10-05" />);

        const buttons = screen.getAllByRole('button');
        expect(
            buttons.map((button) => button.getAttribute('aria-label')),
        ).toEqual(['Hapus tanggal', 'Buka kalender']);
        expect(field().tabIndex).toBe(0);
    });

    it('disables every control', () => {
        render(<Controlled initial="2026-10-05" disabled />);

        expect(field().disabled).toBe(true);
        expect(
            (
                screen.getByRole('button', {
                    name: 'Buka kalender',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
        expect(
            screen.queryByRole('button', { name: 'Hapus tanggal' }),
        ).toBeNull();
    });
});

describe('DatePickerTrigger', () => {
    afterEach(cleanup);

    it('opens the native picker and reports the picked date', () => {
        const onChange = vi.fn();
        const { container } = render(
            <DatePickerTrigger
                value={null}
                onChange={onChange}
                aria-label="Tenggat"
            >
                Pilih…
            </DatePickerTrigger>,
        );
        const native = container.querySelector(
            'input[type="date"]',
        ) as HTMLInputElement;
        const showPicker = vi.fn();
        native.showPicker = showPicker;

        fireEvent.click(screen.getByRole('button', { name: 'Tenggat' }));
        expect(showPicker).toHaveBeenCalled();

        fireEvent.change(native, { target: { value: '2026-10-09' } });
        expect(onChange).toHaveBeenCalledWith('2026-10-09');
    });
});
