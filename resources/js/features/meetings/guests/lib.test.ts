import { describe, expect, it } from 'vitest';
import {
    cleanGuestName,
    dropGuest,
    guestIdentityOf,
    guestLabel,
    guestStatusText,
    guestStatusTone,
    linkExpiryLabel,
    mergeGuestRows,
    upsertGuest,
    waitingSince,
    initialSession,
    isFinalStatus,
    isGuestIdentity,
    liveWindowState,
    maskGuestLink,
    newlyWaiting,
    pollDelayMs,
    reduceSession,
    resolveGuestRight,
    screenFor,
    stripGuestSuffix,
    validateGuestName,
    validateOptionalGuestName,
    waitingLabel,
    windowNotice,
} from './lib';
import type { GuestInfo, GuestWindow, OrganizerGuest } from './types';

const OPENS = Date.parse('2026-10-05T02:45:00Z'); // 09.45 WIB
const window: GuestWindow = {
    state: 'early',
    opens_at: '2026-10-05T02:45:00Z',
    closes_at: '2026-10-05T06:00:00Z',
};

const info = (patch: Partial<GuestInfo> = {}): GuestInfo => ({
    status: 'none',
    status_label: 'Belum masuk',
    window,
    ...patch,
});

describe('identity and names', () => {
    it('recognises guest identities', () => {
        expect(isGuestIdentity('guest:01jb')).toBe(true);
        expect(isGuestIdentity('01jbuser')).toBe(false);
    });

    it('strips the server suffix', () => {
        expect(stripGuestSuffix('Budi Mitra (Tamu)')).toBe('Budi Mitra');
        expect(stripGuestSuffix('Budi (tamu) ')).toBe('Budi');
        expect(stripGuestSuffix('Budi')).toBe('Budi');
    });

    it('cleans a typed name like the server does', () => {
        expect(cleanGuestName('  Budi   <b>Mitra</b> (Tamu) ')).toBe(
            'Budi Mitra',
        );
    });

    it('validates the name', () => {
        expect(validateGuestName('')).toMatch(/Tulis nama/);
        expect(validateGuestName('   (Tamu) ')).toMatch(/Tulis nama/);
        expect(validateGuestName('B')).toMatch(/minimal 2/);
        expect(validateGuestName('Bu')).toBeNull();
        expect(validateGuestName('x'.repeat(61))).toMatch(/maksimal 60/);
        expect(validateGuestName('x'.repeat(60))).toBeNull();
    });

    it('treats an empty optional name as fine', () => {
        expect(validateOptionalGuestName('  ')).toBeNull();
        expect(validateOptionalGuestName('B')).toMatch(/minimal/);
    });

    it('labels a guest by name, else e-mail', () => {
        expect(guestLabel({ name: 'Budi', email: 'b@x.id' })).toBe('Budi');
        expect(guestLabel({ name: ' ', email: 'b@x.id' })).toBe('b@x.id');
        expect(guestLabel({ name: null, email: null })).toBe('Tamu');
    });
});

describe('status and window', () => {
    it('knows the final statuses', () => {
        for (const status of [
            'denied',
            'removed',
            'expired',
            'closed',
            'unknown',
        ] as const) {
            expect(isFinalStatus(status)).toBe(true);
        }

        expect(isFinalStatus('none')).toBe(false);
        expect(isFinalStatus('waiting')).toBe(false);
        expect(isFinalStatus('admitted')).toBe(false);
    });

    it('maps status to screen', () => {
        expect(screenFor('none')).toBe('form');
        expect(screenFor('waiting')).toBe('waiting');
        expect(screenFor('admitted')).toBe('admitted');
        expect(screenFor('removed')).toBe('removed');
        expect(screenFor('unknown')).toBe('unknown');
    });

    it('follows the window with the clock', () => {
        expect(liveWindowState(window, 'early', OPENS - 60_000)).toBe('early');
        expect(liveWindowState(window, 'early', OPENS)).toBe('open');
        expect(
            liveWindowState(window, 'open', Date.parse(window.closes_at) + 1),
        ).toBe('closed');
        expect(liveWindowState(null, 'closed', OPENS)).toBe('closed');
        expect(
            liveWindowState({ opens_at: 'x', closes_at: 'y' }, 'open', 1),
        ).toBe('open');
    });

    it('explains an early or closed window, nothing when open', () => {
        const early = windowNotice(window, 'early', OPENS - 12 * 60_000);

        expect(early?.tone).toBe('info');
        expect(early?.text).toContain('09.45 WIB');
        expect(early?.text).toContain('Dibuka dalam 12 menit');
        expect(windowNotice(window, 'closed', OPENS)?.tone).toBe('danger');
        expect(windowNotice(window, 'open', OPENS)).toBeNull();
        expect(windowNotice(null, null, OPENS)).toBeNull();
    });
});

describe('session state machine', () => {
    it('starts from the page info', () => {
        const session = initialSession(info({ status: 'waiting' }));

        expect(session).toMatchObject({
            status: 'waiting',
            window: 'early',
            failures: 0,
        });
    });

    it('applies a status reply and resets the back-off', () => {
        const failed = reduceSession(initialSession(info()), {
            type: 'failed',
            retryAfter: 10,
        });
        const next = reduceSession(failed, {
            type: 'reply',
            reply: {
                status: 'waiting',
                status_label: 'Menunggu',
                window: 'open',
            },
        });

        expect(next).toMatchObject({
            status: 'waiting',
            window: 'open',
            failures: 0,
            retryAfter: null,
        });
    });

    it('keeps the known status when a poll fails', () => {
        let session = initialSession(info({ status: 'waiting' }));

        session = reduceSession(session, { type: 'failed' });
        session = reduceSession(session, { type: 'failed', retryAfter: 20 });

        expect(session.status).toBe('waiting');
        expect(session.failures).toBe(2);
        expect(session.retryAfter).toBe(20);
    });

    it('keeps the last window when the reply has none', () => {
        const session = reduceSession(initialSession(info()), {
            type: 'reply',
            reply: { status: 'closed', status_label: 'Selesai', window: null },
        });

        expect(session.status).toBe('closed');
        expect(session.window).toBe('early');
    });

    it('goes to a final status', () => {
        const session = reduceSession(initialSession(info()), {
            type: 'final',
            status: 'removed',
            label: 'Dikeluarkan',
        });

        expect(session.status).toBe('removed');
        expect(session.statusLabel).toBe('Dikeluarkan');
    });
});

describe('poll delay', () => {
    it('follows poll_seconds (default 3 s)', () => {
        expect(pollDelayMs({ failures: 0, retryAfter: null })).toBe(3000);
        expect(
            pollDelayMs({ pollSeconds: 5, failures: 0, retryAfter: null }),
        ).toBe(5000);
    });

    it('never polls faster than 2 s or slower than 30 s', () => {
        expect(
            pollDelayMs({ pollSeconds: 0, failures: 0, retryAfter: null }),
        ).toBe(2000);
        expect(
            pollDelayMs({ pollSeconds: 99, failures: 0, retryAfter: null }),
        ).toBe(30_000);
    });

    it('backs off exponentially on failures, capped at 30 s', () => {
        const delays = [0, 1, 2, 3, 4, 8].map((failures) =>
            pollDelayMs({ failures, retryAfter: null }),
        );

        expect(delays).toEqual([3000, 6000, 12_000, 24_000, 30_000, 30_000]);
    });

    it('honours Retry-After, within a cap of 60 s', () => {
        expect(pollDelayMs({ failures: 0, retryAfter: 15 })).toBe(15_000);
        expect(pollDelayMs({ failures: 0, retryAfter: 600 })).toBe(60_000);
        // A smaller Retry-After does not shorten the back-off.
        expect(pollDelayMs({ failures: 3, retryAfter: 5 })).toBe(24_000);
    });
});

describe('links and lobby', () => {
    it('masks the secret in a guest link', () => {
        const masked = maskGuestLink(
            'https://ruangkerja.test/tamu/01jbabcdefghjkmnpqrstvwxyzQx9AbCdEfGhIjKlMnOpQrStUvWxYz012',
        );

        expect(masked).toBe('ruangkerja.test/tamu/01jb…z012');
        expect(masked).not.toContain('abcdefgh');
        expect(maskGuestLink('not a url')).toBe('Tautan tamu');
    });

    it('words the waiting count', () => {
        expect(waitingLabel(0)).toBe('Tidak ada yang menunggu');
        expect(waitingLabel(2)).toBe('2 tamu menunggu');
    });

    it('finds who is new in the waiting list', () => {
        const waiting = [
            { id: 'a', name: 'A', email: null },
            { id: 'b', name: 'B', email: null },
        ];

        expect(newlyWaiting(new Set(['a']), waiting)).toEqual([waiting[1]]);
        expect(newlyWaiting(new Set(), waiting)).toHaveLength(2);
    });
});

const row = (patch: Partial<OrganizerGuest> = {}): OrganizerGuest => ({
    id: '01JBGUEST000000000000000A1',
    email: 'budi@mitra.test',
    name: 'Budi Mitra',
    link_url: 'https://ruangkerja.test/tamu/x',
    link_expires_at: '2026-10-05T06:00:00Z',
    link_expired: false,
    link_rotated_at: null,
    status: 'none',
    status_label: 'Belum masuk',
    requested_at: null,
    admitted_at: null,
    in_room: false,
    identity: 'guest:01jbguest000000000000000a1',
    ...patch,
});

describe('organizer guest rows', () => {
    it('builds the LiveKit identity in lower case', () => {
        expect(guestIdentityOf('01JBGUEST000000000000000A1')).toBe(
            'guest:01jbguest000000000000000a1',
        );
    });

    it('replaces a row by id or appends a new one', () => {
        const a = row();
        const b = row({ id: 'B', identity: 'guest:b' });

        expect(upsertGuest([a], b)).toEqual([a, b]);
        expect(upsertGuest([a, b], { ...a, status: 'waiting' })[0].status).toBe(
            'waiting',
        );
        expect(dropGuest([a, b], a.id)).toEqual([b]);
    });

    it('says "Di ruang rapat" before the lobby label', () => {
        expect(
            guestStatusText(row({ in_room: true, status: 'admitted' })),
        ).toBe('Di ruang rapat');
        expect(guestStatusText(row({ status_label: 'Menunggu' }))).toBe(
            'Menunggu',
        );
        expect(guestStatusTone(row({ in_room: true }))).toBe('success');
        expect(guestStatusTone(row({ status: 'waiting' }))).toBe('warning');
        expect(guestStatusTone(row({ status: 'removed' }))).toBe('danger');
        expect(guestStatusTone(row({ status: 'admitted' }))).toBe('info');
        expect(guestStatusTone(row())).toBe('neutral');
    });

    it('shows when a link stops working', () => {
        const now = Date.parse('2026-10-05T03:00:00Z');

        expect(linkExpiryLabel(row(), now)).toBe(
            'Berlaku sampai Sen, 5 Okt · 13.00 WIB',
        );
        expect(linkExpiryLabel(row({ link_expired: true }), now)).toBe(
            'Tautan kedaluwarsa',
        );
        expect(linkExpiryLabel(row({ link_expires_at: null }), now)).toBeNull();
        expect(
            linkExpiryLabel(
                row({ link_expires_at: '2026-10-05T02:00:00Z' }),
                now,
            ),
        ).toBe('Tautan kedaluwarsa');
    });

    it('words how long someone has been waiting', () => {
        const now = Date.parse('2026-10-05T03:00:00Z');

        expect(waitingSince('2026-10-05T02:59:30Z', now)).toBe('baru saja');
        expect(waitingSince('2026-10-05T02:57:00Z', now)).toBe('3 menit lalu');
        expect(waitingSince(null, now)).toBeNull();
        expect(waitingSince('nope', now)).toBeNull();
    });

    it('merges live, attended and removed guests once each', () => {
        const here = row();
        const gone = row({
            id: 'GONE',
            identity: 'guest:gone',
            email: 'siti@mitra.test',
            name: null,
            status: 'removed',
        });
        const rows = mergeGuestRows({
            live: [{ identity: here.identity, name: 'Budi Mitra (Tamu)' }],
            attended: [
                {
                    participant_id: 'GONE',
                    name: 'Siti (Tamu)',
                    joined_at: '2026-10-05T03:00:00Z',
                    left_at: '2026-10-05T03:05:00Z',
                    duration_seconds: 300,
                    in_room: false,
                    sessions: 1,
                },
                {
                    participant_id: '01JBGUEST000000000000000A1',
                    name: 'Budi Mitra (Tamu)',
                    joined_at: '2026-10-05T03:01:00Z',
                    left_at: null,
                    duration_seconds: 60,
                    in_room: true,
                    sessions: 1,
                },
            ],
            invited: [here, gone],
        });

        expect(rows.map((r) => [r.identity, r.live, r.name])).toEqual([
            [here.identity, true, 'Budi Mitra'],
            ['guest:gone', false, 'Siti'],
        ]);
        expect(rows[0].joinedAt).toBe('2026-10-05T03:01:00Z');
        expect(rows[1]).toMatchObject({ status: 'removed', guestId: 'GONE' });
    });

    it('lists an invited guest that was denied or removed but never attended', () => {
        const denied = row({ status: 'denied' });
        const rows = mergeGuestRows({
            live: [],
            attended: [],
            invited: [denied],
        });

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            live: false,
            status: 'denied',
            name: 'Budi Mitra',
        });
        expect(
            mergeGuestRows({
                live: [],
                attended: [],
                invited: [row({ status: 'waiting' })],
            }),
        ).toEqual([]);
        expect(
            mergeGuestRows({ live: [], attended: [], invited: null }),
        ).toEqual([]);
    });
});

describe('resolveGuestRight', () => {
    it('trusts the server flag in both directions', () => {
        expect(resolveGuestRight(true, false)).toBe(true);
        expect(resolveGuestRight(false, true)).toBe(false);
    });

    it('falls back to the role derived on the client for an older server', () => {
        expect(resolveGuestRight(undefined, true)).toBe(true);
        expect(resolveGuestRight(undefined, false)).toBe(false);
    });
});
