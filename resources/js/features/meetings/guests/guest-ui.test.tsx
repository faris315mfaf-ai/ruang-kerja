import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@/components/shell/brand-mark', () => ({
    BrandMark: () => null,
}));

const { GuestFinal, GuestRequestForm, GuestWaiting } =
    await import('./guest-screens');
const { LobbyList } = await import('./lobby-list');

const info = {
    status: 'none' as const,
    status_label: 'Belum masuk',
    meeting: {
        title: 'Sinkron mitra',
        starts_at: '2026-10-05T03:00:00Z',
        ends_at: '2026-10-05T04:00:00Z',
        organizer_name: 'Dimas Pratama',
    },
    notice_points: [
        'Suara dan video Anda tidak direkam dan tidak ditranskrip.',
    ],
};

afterEach(cleanup);

describe('GuestRequestForm', () => {
    const base = {
        info,
        name: '',
        onName: vi.fn(),
        nameError: null,
        formError: null,
        submitting: false,
        notice: null,
        blocked: false,
    };

    it('shows the meeting, the privacy note and submits the form', () => {
        const onSubmit = vi.fn();

        render(<GuestRequestForm {...base} onSubmit={onSubmit} />);

        expect(screen.getByText('Sinkron mitra')).toBeTruthy();
        expect(screen.getByText(/Dimas Pratama/)).toBeTruthy();
        expect(screen.getByText(/tidak direkam/)).toBeTruthy();
        expect(screen.getByLabelText('Nama Anda')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Minta masuk' }));
        expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('marks the name invalid with the error text', () => {
        render(
            <GuestRequestForm
                {...base}
                nameError="Tulis nama Anda."
                onSubmit={vi.fn()}
            />,
        );

        expect(
            screen.getByLabelText('Nama Anda').getAttribute('aria-invalid'),
        ).toBe('true');
        expect(screen.getByRole('alert').textContent).toBe('Tulis nama Anda.');
    });

    it('disables the button when the window is shut', () => {
        render(<GuestRequestForm {...base} blocked onSubmit={vi.fn()} />);

        expect(
            (
                screen.getByRole('button', {
                    name: 'Minta masuk',
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });
});

describe('guest end screens', () => {
    it('keeps the waiting screen calm when offline', () => {
        render(<GuestWaiting info={info} name="Budi" offline />);

        expect(screen.getByText('Menunggu diizinkan masuk')).toBeTruthy();
        expect(screen.getByRole('alert').textContent).toMatch(
            /status permintaan Anda tidak hilang/,
        );
    });

    it('offers "Periksa lagi" only to removed guests', () => {
        const check = vi.fn();
        const { rerender } = render(
            <GuestFinal kind="removed" info={info} onCheckAgain={check} />,
        );

        fireEvent.click(screen.getByRole('button', { name: /Periksa lagi/ }));
        expect(check).toHaveBeenCalled();

        rerender(<GuestFinal kind="denied" info={info} onCheckAgain={check} />);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('says the link is invalid without naming the meeting', () => {
        render(<GuestFinal kind="unknown" />);

        expect(screen.getByText('Tautan tidak berlaku')).toBeTruthy();
    });
});

describe('LobbyList', () => {
    const waiting = [
        {
            id: 'a',
            name: 'Budi Mitra',
            email: 'budi@mitra.test',
            requested_at: null,
            identity: 'guest:a',
        },
    ];

    it('has Izinkan masuk and Tolak per guest', () => {
        const onAdmit = vi.fn();
        const onDeny = vi.fn();

        render(
            <LobbyList
                waiting={waiting}
                busy={new Set()}
                onAdmit={onAdmit}
                onDeny={onDeny}
            />,
        );

        expect(screen.getByText('Budi Mitra')).toBeTruthy();
        expect(screen.getByText(/budi@mitra.test/)).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Izinkan masuk/ }));
        fireEvent.click(
            screen.getByRole('button', { name: 'Tolak Budi Mitra' }),
        );
        expect(onAdmit).toHaveBeenCalledWith('a');
        expect(onDeny).toHaveBeenCalledWith('a');
    });

    it('disables the buttons of a guest being decided', () => {
        render(
            <LobbyList
                waiting={waiting}
                busy={new Set(['a'])}
                onAdmit={vi.fn()}
                onDeny={vi.fn()}
            />,
        );

        expect(
            (
                screen.getByRole('button', {
                    name: /Izinkan masuk/,
                }) as HTMLButtonElement
            ).disabled,
        ).toBe(true);
    });

    it('shows an empty state', () => {
        render(
            <LobbyList
                waiting={[]}
                busy={new Set()}
                onAdmit={vi.fn()}
                onDeny={vi.fn()}
            />,
        );

        expect(screen.getByText('Tidak ada tamu yang menunggu.')).toBeTruthy();
    });
});
