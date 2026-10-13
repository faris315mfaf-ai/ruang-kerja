import { OFFICE_TIMEZONE, toIsoDay } from '@/lib/format';
import type { LeaveShortcut, LeaveShortcutType } from '@/types/attendance';

/** "12:00" → "12.00" (Indonesian clock format used across the UI). */
export function cutoffText(value: string): string {
    return value.replace(':', '.');
}

const clock = new Intl.DateTimeFormat('en-GB', {
    timeZone: OFFICE_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
});

/** Minutes since midnight in office time. */
function officeMinutes(now: Date): number {
    const parts = clock.formatToParts(now);
    const part = (type: string) =>
        Number(parts.find((item) => item.type === type)?.value ?? 0);

    return part('hour') * 60 + part('minute');
}

/**
 * The cutoff has passed in office time. The server compares to the second
 * (12:00:00 is already too late); whole minutes give the same answer.
 */
export function cutoffPassed(cutoff: string | null, now: Date): boolean {
    if (cutoff === null) {
        return false;
    }

    const [hour, minute] = cutoff.split(':').map(Number);

    return officeMinutes(now) >= hour * 60 + minute;
}

export type ShortcutChoice = {
    kind: 'sick' | 'permit';
    label: string;
    type: LeaveShortcutType;
};

export type ShortcutView =
    | { kind: 'hidden' }
    | { kind: 'available'; choices: ShortcutChoice[]; hint: string | null }
    | { kind: 'pending'; pending: NonNullable<LeaveShortcut['pending']> }
    | { kind: 'closed'; reason: string };

/** The sentence the server uses when both cutoffs have passed. */
function closedSentence(shortcut: LeaveShortcut): string {
    const { sickCutoff, permitCutoff } = shortcut;

    if (sickCutoff && permitCutoff && sickCutoff !== permitCutoff) {
        return `Batas pengajuan sakit pukul ${cutoffText(sickCutoff)} dan izin pukul ${cutoffText(permitCutoff)} sudah lewat.`;
    }

    const time = cutoffText(sickCutoff ?? permitCutoff ?? '');
    const kinds =
        shortcut.sickType && shortcut.permitType
            ? 'sakit/izin'
            : shortcut.sickType
              ? 'sakit'
              : 'izin';

    return `Batas pengajuan ${kinds} pukul ${time} sudah lewat.`;
}

/** "Batas pengajuan hari ini pukul 12.00" for the open choices. */
function hintFor(
    choices: ShortcutChoice[],
    shortcut: LeaveShortcut,
): string | null {
    const times = new Map<string, string[]>();

    for (const choice of choices) {
        const time =
            choice.kind === 'sick'
                ? shortcut.sickCutoff
                : shortcut.permitCutoff;

        if (time) {
            times.set(time, [
                ...(times.get(time) ?? []),
                choice.kind === 'sick' ? 'sakit' : 'izin',
            ]);
        }
    }

    if (times.size === 0) {
        return null;
    }

    return `Batas pengajuan hari ini ${[...times]
        .map(([time, kinds]) =>
            times.size === 1
                ? `pukul ${cutoffText(time)}`
                : `${kinds.join('/')} pukul ${cutoffText(time)}`,
        )
        .join(', ')}.`;
}

/**
 * What to render for the Absen shortcut. The server's `leaveShortcut` is the
 * truth at load time; the ticking clock only closes a choice whose cutoff
 * passes while the page stays open (the server re-checks on sending).
 */
export function shortcutView(
    shortcut: LeaveShortcut | undefined,
    now: Date,
): ShortcutView {
    if (!shortcut) {
        return { kind: 'hidden' };
    }

    if (shortcut.pending) {
        return { kind: 'pending', pending: shortcut.pending };
    }

    if (!shortcut.available) {
        return shortcut.closedReason
            ? { kind: 'closed', reason: shortcut.closedReason }
            : { kind: 'hidden' };
    }

    const choices: ShortcutChoice[] = [];

    if (
        shortcut.sickType &&
        !shortcut.sickClosed &&
        !cutoffPassed(shortcut.sickCutoff, now)
    ) {
        choices.push({
            kind: 'sick',
            label: 'Sakit',
            type: shortcut.sickType,
        });
    }

    if (
        shortcut.permitType &&
        !shortcut.permitClosed &&
        !cutoffPassed(shortcut.permitCutoff, now)
    ) {
        choices.push({
            kind: 'permit',
            label: 'Izin',
            type: shortcut.permitType,
        });
    }

    if (choices.length === 0) {
        return { kind: 'closed', reason: closedSentence(shortcut) };
    }

    return { kind: 'available', choices, hint: hintFor(choices, shortcut) };
}

/** `/pengajuan/baru?jenis=SKT&tanggal=2026-10-14` query for a choice. */
export function shortcutQuery(
    choice: ShortcutChoice,
    now: Date,
): { jenis: string; tanggal: string } {
    return { jenis: choice.type.code, tanggal: toIsoDay(now) ?? '' };
}
