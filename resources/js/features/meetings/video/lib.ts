/**
 * Pure helpers of Video RuangKerja (no React, no LiveKit): join window and
 * countdown, stage layout, grid shape, keyboard shortcuts (Google Meet
 * style), durations and participant metadata. Tested in lib.test.ts.
 */
import type { ParticipantMeta, VideoSummary } from './types';

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
// Stage layout
// ---------------------------------------------------------------------------

/** User's choice in "Tata letak" (Meet: Otomatis · Petak · Sorotan). */
export type LayoutPreference = 'auto' | 'grid' | 'spotlight';

/**
 * - `solo`: only me → my tile fills the stage.
 * - `pip`: me + one other, nothing shared → the other fills the stage, me in
 *   a small floating tile (Google Meet).
 * - `grid`: equal tiles (up to `maxTiles`, the rest summarized).
 * - `spotlight`: one big tile (screen share, pinned or active speaker) and a
 *   filmstrip of the others.
 */
export type StageMode = 'solo' | 'pip' | 'grid' | 'spotlight';

export type StageDecision = { mode: StageMode; maxTiles: number };

export function stageLayout(input: {
    participants: number;
    screenShares: number;
    pinned: boolean;
    preference: LayoutPreference;
    mobile: boolean;
}): StageDecision {
    const { participants, screenShares, pinned, preference, mobile } = input;
    const maxTiles = mobile ? 6 : 16;

    if (screenShares > 0 || pinned || preference === 'spotlight') {
        return {
            mode: participants + screenShares <= 1 ? 'solo' : 'spotlight',
            maxTiles: mobile ? 3 : 6,
        };
    }

    if (participants <= 1) {
        return { mode: 'solo', maxTiles: 1 };
    }

    if (participants === 2 && preference === 'auto') {
        return { mode: 'pip', maxTiles: 2 };
    }

    if (participants > maxTiles && preference === 'auto') {
        return { mode: 'spotlight', maxTiles: mobile ? 3 : 6 };
    }

    return { mode: 'grid', maxTiles };
}

/**
 * Columns × rows that give the largest tiles of `aspect` (width / height;
 * 16:9 on desktop, 3:4 on phones where tiles are cropped like Meet) for
 * `count` tiles in a `width` × `height` box (gaps included). On a landscape
 * stage a wider shape wins when its tiles are at most 6% smaller, so two
 * people sit side by side.
 */
export function gridShape(
    count: number,
    width: number,
    height: number,
    options: { gap?: number; aspect?: number } = {},
): { cols: number; rows: number } {
    const gap = options.gap ?? 8;
    const aspect = options.aspect ?? 16 / 9;
    const n = Math.max(1, count);
    const landscape = width >= height;
    let best = { cols: 1, rows: n };
    let largest = -1;

    for (let cols = 1; cols <= n; cols++) {
        const rows = Math.ceil(n / cols);
        const cellWidth = (width - gap * (cols - 1)) / cols;
        const cellHeight = (height - gap * (rows - 1)) / rows;
        const fittedWidth = Math.min(cellWidth, cellHeight * aspect);
        const better = landscape
            ? fittedWidth >= largest * 0.94
            : fittedWidth > largest + 0.5;

        if (better) {
            best = { cols, rows };
        }

        largest = Math.max(largest, fittedWidth);
    }

    return { cols: best.cols, rows: best.rows };
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts (Google Meet)
// ---------------------------------------------------------------------------

export type ShortcutAction =
    | 'toggle-mic'
    | 'toggle-camera'
    | 'toggle-chat'
    | 'toggle-people'
    | 'toggle-hand';

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
 * ⌘/Ctrl + Alt + P people · ⌘/Ctrl + Alt + H raise hand. On macOS the
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
    };

    return keys[action].join(join);
}

export function isMacPlatform(platform: string): boolean {
    return /mac|iphone|ipad|ipod/i.test(platform);
}

// ---------------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------------

/** Metadata JSON from the access token; tolerant of anything else. */
export function parseMeta(
    metadata: string | undefined | null,
): ParticipantMeta {
    if (!metadata) {
        return { avatar_url: null, organizer: false };
    }

    try {
        const value = JSON.parse(metadata) as Partial<ParticipantMeta> | null;

        return {
            avatar_url:
                typeof value?.avatar_url === 'string' ? value.avatar_url : null,
            organizer: value?.organizer === true,
        };
    } catch {
        return { avatar_url: null, organizer: false };
    }
}

/** Raised hands, oldest first (attribute `hand` = epoch ms when raised). */
export function raisedHandOrder<T extends { id: string; hand?: string }>(
    people: T[],
): T[] {
    return people
        .filter((person) => person.hand && Number(person.hand) > 0)
        .sort((a, b) => Number(a.hand) - Number(b.hand));
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
