/**
 * Pure helpers of Video RuangKerja (no React, no LiveKit): join window and
 * countdown, room clock, keyboard shortcuts (Google Meet style), durations
 * and participant lists. Tested in lib.test.ts.
 */
import type { VideoSummary } from './types';

// ---------------------------------------------------------------------------
// Join window
// ---------------------------------------------------------------------------

export type JoinWindow =
    | { state: 'early'; msUntilOpen: number }
    | { state: 'open' }
    | { state: 'closed' };

/**
 * Where `now` falls in the join window. The organizer may open the room at
 * any time (same rule as MeetingPolicy::joinVideo), so it is always open.
 */
export function joinWindow(
    video: Pick<VideoSummary, 'opens_at' | 'closes_at' | 'is_organizer'>,
    now: number,
): JoinWindow {
    if (video.is_organizer) {
        return { state: 'open' };
    }

    const opens = Date.parse(video.opens_at);
    const closes = Date.parse(video.closes_at);

    if (now < opens) {
        return { state: 'early', msUntilOpen: opens - now };
    }

    return now > closes ? { state: 'closed' } : { state: 'open' };
}

/**
 * "Dibuka dalam 12 menit", "Dibuka dalam 1 jam 5 menit", "Dibuka dalam
 * 45 detik"; days for far-away meetings ("Dibuka dalam 3 hari").
 */
export function countdownLabel(ms: number): string {
    const seconds = Math.max(0, Math.ceil(ms / 1000));

    if (seconds < 60) {
        return `Dibuka dalam ${seconds} detik`;
    }

    const minutes = Math.ceil(seconds / 60);

    if (minutes < 60) {
        return `Dibuka dalam ${minutes} menit`;
    }

    const hours = Math.floor(minutes / 60);

    if (hours >= 24) {
        return `Dibuka dalam ${Math.floor(hours / 24)} hari`;
    }

    const rest = minutes % 60;

    return rest === 0
        ? `Dibuka dalam ${hours} jam`
        : `Dibuka dalam ${hours} jam ${rest} menit`;
}

/** "42 mnt", "1 j 5 mnt", "< 1 mnt". */
export function durationShort(seconds: number): string {
    const minutes = Math.floor(Math.max(0, seconds) / 60);

    if (minutes < 1) {
        return '< 1 mnt';
    }

    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;

    if (hours === 0) {
        return `${minutes} mnt`;
    }

    return rest === 0 ? `${hours} j` : `${hours} j ${rest} mnt`;
}

// ---------------------------------------------------------------------------
// Room clock
// ---------------------------------------------------------------------------

/** "00:18:42" — time since the meeting started (or since joining). */
export function elapsedClock(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const pad = (value: number) => String(value).padStart(2, '0');

    return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts (Google Meet)
// ---------------------------------------------------------------------------

export type ShortcutAction =
    | 'toggle-mic'
    | 'toggle-camera'
    | 'toggle-chat'
    | 'toggle-people'
    | 'toggle-hand'
    | 'toggle-captions';

type KeyInput = {
    key: string;
    code?: string;
    ctrlKey: boolean;
    metaKey: boolean;
    altKey: boolean;
    shiftKey: boolean;
};

/**
 * ⌘/Ctrl + D mic · ⌘/Ctrl + E camera · ⌘/Ctrl + Alt + C chat ·
 * ⌘/Ctrl + Alt + P people (Kehadiran) · ⌘/Ctrl + Alt + H raise hand ·
 * ⌘/Ctrl + Alt + S subtitles. On macOS the
 * modifier is ⌘, elsewhere Ctrl. Option-letters on macOS produce other
 * characters, so the physical key (`code`) is used when present.
 */
export function shortcutAction(
    event: KeyInput,
    isMac: boolean,
): ShortcutAction | null {
    const modifier = isMac ? event.metaKey : event.ctrlKey;

    if (!modifier || event.shiftKey) {
        return null;
    }

    const letter = (
        event.code?.startsWith('Key') ? event.code.slice(3) : event.key
    ).toLowerCase();

    if (!event.altKey) {
        return letter === 'd'
            ? 'toggle-mic'
            : letter === 'e'
              ? 'toggle-camera'
              : null;
    }

    return letter === 'c'
        ? 'toggle-chat'
        : letter === 'p'
          ? 'toggle-people'
          : letter === 'h'
            ? 'toggle-hand'
            : letter === 's'
              ? 'toggle-captions'
              : null;
}

/** "⌘ D" on macOS, "Ctrl + D" elsewhere (tooltips, shortcut list). */
export function shortcutLabel(action: ShortcutAction, isMac: boolean): string {
    const mod = isMac ? '⌘' : 'Ctrl';
    const alt = isMac ? '⌥' : 'Alt';
    const join = isMac ? ' ' : ' + ';
    const keys: Record<ShortcutAction, string[]> = {
        'toggle-mic': [mod, 'D'],
        'toggle-camera': [mod, 'E'],
        'toggle-chat': [mod, alt, 'C'],
        'toggle-people': [mod, alt, 'P'],
        'toggle-hand': [mod, alt, 'H'],
        'toggle-captions': [mod, alt, 'S'],
    };

    return keys[action].join(join);
}

export function isMacPlatform(platform: string): boolean {
    return /mac|iphone|ipad|ipod/i.test(platform);
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

/** Raised hands, oldest first (attribute `hand` = epoch ms when raised). */
export function raisedHandOrder<T>(
    people: T[],
    handOf: (person: T) => string | undefined,
): T[] {
    return people
        .filter((person) => Number(handOf(person)) > 0)
        .sort((a, b) => Number(handOf(a)) - Number(handOf(b)));
}

/** "Rizky", "Rizky dan Sari", "Rizky, Sari, dan 3 lainnya". */
export function namesSummary(names: string[], max = 2): string {
    const first = names.map((name) => name.split(' ')[0] ?? name);

    if (first.length === 0) {
        return '';
    }

    if (first.length === 1) {
        return first[0];
    }

    if (first.length <= max) {
        return `${first.slice(0, -1).join(', ')} dan ${first[first.length - 1]}`;
    }

    return `${first.slice(0, max).join(', ')}, dan ${first.length - max} lainnya`;
}
