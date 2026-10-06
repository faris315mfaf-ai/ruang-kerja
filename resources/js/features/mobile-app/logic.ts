import type {
    Device,
    IntegrityCheckKey,
    IntegrityVerdict,
    NetworkState,
    PreviewState,
    QuickActionKey,
    SyncItem,
    SyncStatus,
    WidgetTask,
} from './types';

// --- Preview state -------------------------------------------------------------

const PREVIEW_STATES: PreviewState[] = ['normal', 'kosong', 'galat'];

/** `?keadaan=kosong|galat` → preview state (anything else = normal). */
export function parsePreviewState(search: string): PreviewState {
    const value = new URLSearchParams(search).get('keadaan');

    return PREVIEW_STATES.includes(value as PreviewState)
        ? (value as PreviewState)
        : 'normal';
}

// --- Biometric login (MLogin) --------------------------------------------------

export const MAX_BIOMETRIC_ATTEMPTS = 3;

export type BiometricPhase =
    | 'idle'
    | 'scanning'
    | 'success'
    | 'failed'
    | 'locked';

export type BiometricState = { phase: BiometricPhase; failures: number };

export type BiometricEvent =
    | { type: 'scan' }
    | { type: 'matched' }
    | { type: 'rejected' }
    | { type: 'reset' };

export const INITIAL_BIOMETRIC: BiometricState = { phase: 'idle', failures: 0 };

/**
 * Biometric sign-in: three rejected scans lock biometrics until the person
 * signs in with Google (the OS does the same after repeated failures).
 */
export function biometricReducer(
    state: BiometricState,
    event: BiometricEvent,
): BiometricState {
    switch (event.type) {
        case 'scan':
            return state.phase === 'locked' || state.phase === 'success'
                ? state
                : { ...state, phase: 'scanning' };
        case 'matched':
            return state.phase === 'scanning'
                ? { phase: 'success', failures: 0 }
                : state;
        case 'rejected': {
            if (state.phase !== 'scanning') {
                return state;
            }

            const failures = state.failures + 1;

            return {
                failures,
                phase: failures >= MAX_BIOMETRIC_ATTEMPTS ? 'locked' : 'failed',
            };
        }
        case 'reset':
            return INITIAL_BIOMETRIC;
    }
}

// --- Offline queue (MOffline) ---------------------------------------------------

export type QueueSummary = Record<SyncStatus, number> & {
    /** Not yet on the server (pending + syncing + failed). */
    waiting: number;
    total: number;
};

export function summarizeQueue(items: SyncItem[]): QueueSummary {
    const summary: QueueSummary = {
        pending: 0,
        syncing: 0,
        failed: 0,
        sent: 0,
        waiting: 0,
        total: items.length,
    };

    for (const item of items) {
        summary[item.status] += 1;
    }

    summary.waiting = summary.pending + summary.syncing + summary.failed;

    return summary;
}

/** First item the sync loop should send next (oldest pending), if any. */
export function nextToSync(items: SyncItem[]): SyncItem | null {
    return items.find((item) => item.status === 'pending') ?? null;
}

/** Marks one item as being sent. */
export function markSyncing(items: SyncItem[], id: string): SyncItem[] {
    return items.map((item) =>
        item.id === id ? { ...item, status: 'syncing' } : item,
    );
}

/**
 * Result of one send attempt. Items flagged `fails_once` hit a conflict on
 * their first attempt (someone changed the task meanwhile) and pass on retry.
 */
export function completeAttempt(items: SyncItem[], id: string): SyncItem[] {
    return items.map((item) => {
        if (item.id !== id) {
            return item;
        }

        const attempts = item.attempts + 1;

        if (item.fails_once && attempts === 1) {
            return {
                ...item,
                attempts,
                status: 'failed',
                error: 'Status tugas sudah diubah Rizky. Kirim ulang untuk menimpa.',
            };
        }

        return { ...item, attempts, status: 'sent', error: null };
    });
}

/** "Coba lagi": failed items go back to the queue. */
export function retryFailed(items: SyncItem[], id?: string): SyncItem[] {
    return items.map((item) =>
        item.status === 'failed' && (id === undefined || item.id === id)
            ? { ...item, status: 'pending', error: null }
            : item,
    );
}

/** Going offline mid-sync puts the item being sent back in the queue. */
export function pauseSync(items: SyncItem[]): SyncItem[] {
    return items.map((item) =>
        item.status === 'syncing' ? { ...item, status: 'pending' } : item,
    );
}

export type QueueBanner = {
    tone: 'warning' | 'info' | 'success' | 'danger';
    title: string;
    detail: string;
};

/** Status strip at the top of the offline screen. */
export function queueBanner(
    network: NetworkState,
    summary: QueueSummary,
    lastSync: string,
): QueueBanner {
    if (network === 'offline') {
        return {
            tone: 'warning',
            title: 'Tidak ada sinyal',
            detail:
                summary.waiting > 0
                    ? `${summary.waiting} perubahan menunggu · terakhir sinkron ${lastSync}`
                    : `Terakhir sinkron ${lastSync} · data tampil dari perangkat`,
        };
    }

    if (summary.pending + summary.syncing > 0) {
        return {
            tone: 'info',
            title: 'Terhubung · mengirim…',
            detail: `${summary.sent} dari ${summary.total} terkirim`,
        };
    }

    if (summary.failed > 0) {
        return {
            tone: 'danger',
            title: `${summary.failed} perubahan gagal terkirim`,
            detail: 'Periksa alasannya lalu coba lagi',
        };
    }

    return {
        tone: 'success',
        title: 'Semua tersinkron',
        detail: `Baru saja · ${lastSync}`,
    };
}

// --- Integrity (anti fake GPS, root, unofficial app) -------------------------------

export type IntegrityScenario =
    | 'aman'
    | 'lokasi-palsu'
    | 'root'
    | 'tidak-resmi';

export const INTEGRITY_SCENARIOS: Record<IntegrityScenario, IntegrityVerdict> =
    {
        aman: { checked_at: '2026-10-05T00:51:00Z', failed: [] },
        'lokasi-palsu': {
            checked_at: '2026-10-05T00:51:00Z',
            failed: ['mock_location'],
            mock_app: 'Fake GPS Go',
        },
        root: { checked_at: '2026-10-05T00:51:00Z', failed: ['rooted'] },
        'tidak-resmi': {
            checked_at: '2026-10-05T00:51:00Z',
            failed: ['unofficial_app'],
        },
    };

export const INTEGRITY_CHECKS: {
    key: IntegrityCheckKey;
    label: string;
    passed: string;
}[] = [
    {
        key: 'mock_location',
        label: 'Lokasi asli dari GPS',
        passed: 'Tidak ada aplikasi lokasi tiruan',
    },
    {
        key: 'rooted',
        label: 'Sistem perangkat utuh',
        passed: 'Tidak di-root / jailbreak',
    },
    {
        key: 'unofficial_app',
        label: 'Aplikasi resmi',
        passed: 'Dipasang dari Play Store / App Store',
    },
    {
        key: 'clock_skew',
        label: 'Jam perangkat sesuai',
        passed: 'Selisih dengan server < 1 menit',
    },
];

/** Most actionable problem first: the fix for it unblocks the others too. */
const PRIORITY: IntegrityCheckKey[] = [
    'unofficial_app',
    'rooted',
    'mock_location',
    'clock_skew',
];

export type IntegrityOutcome =
    | { ok: true }
    | {
          ok: false;
          reason: IntegrityCheckKey;
          title: string;
          explanation: string;
          steps: string[];
      };

/** Friendly rejection copy for the first failed check (plain language, a fix). */
export function evaluateIntegrity(verdict: IntegrityVerdict): IntegrityOutcome {
    const reason = PRIORITY.find((key) => verdict.failed.includes(key));

    if (!reason) {
        return { ok: true };
    }

    switch (reason) {
        case 'mock_location':
            return {
                ok: false,
                reason,
                title: 'Lokasi tiruan terdeteksi',
                explanation: `Aplikasi ${verdict.mock_app ?? 'lokasi tiruan'} sedang mengatur lokasi ponsel ini, jadi lokasi check-in tidak bisa dipercaya.`,
                steps: [
                    'Buka Pengaturan › Opsi pengembang › Pilih aplikasi lokasi tiruan, lalu pilih "Tidak ada".',
                    `Hapus atau hentikan ${verdict.mock_app ?? 'aplikasi tersebut'}.`,
                    'Kembali ke RuangKerja dan ketuk "Periksa ulang".',
                ],
            };
        case 'rooted':
            return {
                ok: false,
                reason,
                title: 'Perangkat sudah dimodifikasi',
                explanation:
                    'Ponsel ini di-root atau di-jailbreak, sehingga data lokasi dan wajah bisa diubah aplikasi lain.',
                steps: [
                    'Pakai ponsel lain yang tidak dimodifikasi untuk check-in hari ini.',
                    'Atau check-in lewat QR di kiosk lobi kantor.',
                    'Bila ponsel ini milik kantor, hubungi tim TI untuk dipulihkan.',
                ],
            };
        case 'unofficial_app':
            return {
                ok: false,
                reason,
                title: 'Aplikasi bukan versi resmi',
                explanation:
                    'Aplikasi RuangKerja di ponsel ini tidak dipasang dari Play Store / App Store atau sudah diubah.',
                steps: [
                    'Hapus aplikasi ini dari ponsel.',
                    'Pasang ulang RuangKerja dari Play Store atau App Store.',
                    'Masuk lagi dengan akun Google kantor.',
                ],
            };
        case 'clock_skew':
            return {
                ok: false,
                reason,
                title: 'Jam ponsel tidak sesuai',
                explanation:
                    'Jam ponsel berbeda lebih dari 1 menit dengan server, jadi waktu check-in tidak bisa dicatat.',
                steps: [
                    'Buka Pengaturan › Tanggal & waktu, lalu aktifkan "Waktu otomatis".',
                    'Kembali ke RuangKerja dan ketuk "Periksa ulang".',
                ],
            };
    }
}

/** Device list label for the stored verdict. */
export function integrityBadge(verdict: IntegrityVerdict): {
    tone: 'success' | 'danger';
    label: string;
} {
    if (verdict.failed.length === 0) {
        return { tone: 'success', label: 'Lolos' };
    }

    const outcome = evaluateIntegrity(verdict);

    return {
        tone: 'danger',
        label: outcome.ok ? 'Lolos' : outcome.title,
    };
}

// --- Face check-in (liveness + match) --------------------------------------------

export const LIVENESS_STEPS = [
    {
        key: 'center',
        label: 'Posisikan wajah di dalam oval',
        short: 'Posisi wajah',
    },
    { key: 'blink', label: 'Kedipkan mata', short: 'Kedip' },
    { key: 'turn_left', label: 'Toleh ke kiri perlahan', short: 'Toleh kiri' },
] as const;

export type LivenessProgress = {
    /** Active step (LIVENESS_STEPS.length when done). */
    step: number;
    /** 0–1 within the active step. */
    stepProgress: number;
    /** 0–100 over all steps. */
    percent: number;
    done: boolean;
};

/** Simulated liveness: each step takes `stepMs`. */
export function livenessProgress(
    elapsedMs: number,
    stepMs: number,
    steps: number = LIVENESS_STEPS.length,
): LivenessProgress {
    const total = stepMs * steps;
    const clamped = Math.min(Math.max(elapsedMs, 0), total);
    const done = clamped >= total;
    const step = done ? steps : Math.floor(clamped / stepMs);

    return {
        step,
        stepProgress: done ? 1 : (clamped - step * stepMs) / stepMs,
        percent: Math.round((clamped / total) * 100),
        done,
    };
}

/** Minimum similarity for a face match (server-side in the real app). */
export const FACE_MATCH_THRESHOLD = 85;

export type FaceScenario = 'cocok' | 'liveness' | 'tidak-cocok';

export type FaceOutcome =
    | { kind: 'match'; score: number }
    | { kind: 'liveness_failed' }
    | { kind: 'no_match'; score: number };

export function faceOutcome(scenario: FaceScenario): FaceOutcome {
    switch (scenario) {
        case 'cocok':
            return { kind: 'match', score: 98 };
        case 'liveness':
            return { kind: 'liveness_failed' };
        case 'tidak-cocok':
            return { kind: 'no_match', score: 62 };
    }
}

/** Consent needs every statement ticked plus the policy version. */
export function canGiveConsent(ticks: boolean[]): boolean {
    return ticks.length > 0 && ticks.every(Boolean);
}

// --- Widget ----------------------------------------------------------------------

export type TaskSummary = {
    done: number;
    total: number;
    overdue: number;
    percent: number;
    /** Open tasks, overdue first, at most `limit`. */
    next: WidgetTask[];
};

export function summarizeTasks(tasks: WidgetTask[], limit = 3): TaskSummary {
    const done = tasks.filter((task) => task.done).length;
    const open = tasks.filter((task) => !task.done);
    const overdue = open.filter((task) => task.overdue).length;

    return {
        done,
        total: tasks.length,
        overdue,
        percent:
            tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100),
        next: [...open]
            .sort((a, b) => Number(b.overdue) - Number(a.overdue))
            .slice(0, limit),
    };
}

// --- Devices ---------------------------------------------------------------------

/** This device first, then most recently seen. */
export function sortDevices(devices: Device[]): Device[] {
    return [...devices].sort((a, b) => {
        if (a.is_current !== b.is_current) {
            return a.is_current ? -1 : 1;
        }

        return b.last_seen_at.localeCompare(a.last_seen_at);
    });
}

export const PLATFORM_LABEL: Record<Device['platform'], string> = {
    android: 'Android',
    ios: 'iOS',
};

// --- Quick add -------------------------------------------------------------------

export type QuickValues = { title: string; start?: string; end?: string };

/** Inline validation of the quick-add mini forms (null = valid). */
export function validateQuickAdd(
    kind: QuickActionKey,
    values: QuickValues,
): string | null {
    if (kind === 'check_in') {
        return null;
    }

    if (kind === 'leave') {
        if (!values.start || !values.end) {
            return 'Pilih tanggal mulai dan selesai.';
        }

        if (values.end < values.start) {
            return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
        }

        return null;
    }

    const title = values.title.trim();

    if (title.length === 0) {
        return kind === 'note' ? 'Tulis isi catatan.' : 'Tulis judulnya dulu.';
    }

    if (title.length > 255) {
        return 'Maksimal 255 karakter.';
    }

    return null;
}

/** Inclusive day count of a leave range (calendar days, preview only). */
export function leaveDays(start: string, end: string): number {
    const from = Date.parse(`${start}T00:00:00Z`);
    const to = Date.parse(`${end}T00:00:00Z`);

    if (Number.isNaN(from) || Number.isNaN(to) || to < from) {
        return 0;
    }

    return Math.round((to - from) / 86_400_000) + 1;
}
