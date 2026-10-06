import { describe, expect, it } from 'vitest';
import { DEVICES, SYNC_QUEUE, WIDGET_TASKS } from './fixtures';
import {
    INITIAL_BIOMETRIC,
    INTEGRITY_SCENARIOS,
    biometricReducer,
    canGiveConsent,
    completeAttempt,
    evaluateIntegrity,
    faceOutcome,
    integrityBadge,
    leaveDays,
    livenessProgress,
    markSyncing,
    nextToSync,
    parsePreviewState,
    pauseSync,
    queueBanner,
    retryFailed,
    sortDevices,
    summarizeQueue,
    summarizeTasks,
    validateQuickAdd,
} from './logic';
import type { SyncItem } from './types';

describe('parsePreviewState', () => {
    it('reads ?keadaan= and falls back to normal', () => {
        expect(parsePreviewState('?keadaan=kosong')).toBe('kosong');
        expect(parsePreviewState('?a=1&keadaan=galat')).toBe('galat');
        expect(parsePreviewState('?keadaan=aneh')).toBe('normal');
        expect(parsePreviewState('')).toBe('normal');
    });
});

describe('biometricReducer', () => {
    it('signs in after a matched scan', () => {
        const scanning = biometricReducer(INITIAL_BIOMETRIC, { type: 'scan' });

        expect(scanning.phase).toBe('scanning');
        expect(biometricReducer(scanning, { type: 'matched' })).toEqual({
            phase: 'success',
            failures: 0,
        });
    });

    it('locks after three rejected scans', () => {
        let state = INITIAL_BIOMETRIC;

        for (let i = 0; i < 3; i++) {
            state = biometricReducer(state, { type: 'scan' });
            state = biometricReducer(state, { type: 'rejected' });
        }

        expect(state).toEqual({ phase: 'locked', failures: 3 });
        expect(biometricReducer(state, { type: 'scan' }).phase).toBe('locked');
        expect(biometricReducer(state, { type: 'reset' })).toEqual(
            INITIAL_BIOMETRIC,
        );
    });

    it('ignores results that arrive when not scanning', () => {
        expect(biometricReducer(INITIAL_BIOMETRIC, { type: 'matched' })).toBe(
            INITIAL_BIOMETRIC,
        );
    });
});

describe('offline queue', () => {
    const run = (items: SyncItem[]): SyncItem[] => {
        let queue = items;
        let next = nextToSync(queue);

        while (next) {
            queue = completeAttempt(markSyncing(queue, next.id), next.id);
            next = nextToSync(queue);
        }

        return queue;
    };

    it('sends everything except the conflicting item on the first pass', () => {
        const queue = run(SYNC_QUEUE);
        const summary = summarizeQueue(queue);

        expect(summary).toMatchObject({ sent: 3, failed: 1, waiting: 1 });
        expect(queue.find((item) => item.status === 'failed')?.error).toMatch(
            /Rizky/,
        );
    });

    it('a retry clears the conflict', () => {
        const queue = run(retryFailed(run(SYNC_QUEUE)));

        expect(summarizeQueue(queue)).toMatchObject({ sent: 4, waiting: 0 });
    });

    it('going offline returns the item being sent to the queue', () => {
        const syncing = markSyncing(SYNC_QUEUE, 'q1');

        expect(summarizeQueue(syncing).syncing).toBe(1);
        expect(summarizeQueue(pauseSync(syncing))).toMatchObject({
            syncing: 0,
            pending: 4,
        });
    });

    it('describes the banner per network and queue state', () => {
        const pending = summarizeQueue(SYNC_QUEUE);

        expect(queueBanner('offline', pending, '09.12')).toMatchObject({
            tone: 'warning',
            detail: '4 perubahan menunggu · terakhir sinkron 09.12',
        });
        expect(queueBanner('online', pending, '09.12').tone).toBe('info');

        const failed = summarizeQueue(run(SYNC_QUEUE));

        expect(queueBanner('online', failed, '09.12').tone).toBe('danger');
        expect(queueBanner('online', summarizeQueue([]), '10.06').title).toBe(
            'Semua tersinkron',
        );
    });
});

describe('integrity', () => {
    it('passes a clean device', () => {
        expect(evaluateIntegrity(INTEGRITY_SCENARIOS.aman)).toEqual({
            ok: true,
        });
    });

    it('names the mock location app and offers a fix', () => {
        const outcome = evaluateIntegrity(INTEGRITY_SCENARIOS['lokasi-palsu']);

        expect(outcome.ok).toBe(false);

        if (!outcome.ok) {
            expect(outcome.reason).toBe('mock_location');
            expect(outcome.explanation).toContain('Fake GPS Go');
            expect(outcome.steps.length).toBeGreaterThan(0);
        }
    });

    it('reports the most actionable failure first', () => {
        const outcome = evaluateIntegrity({
            checked_at: '2026-10-05T00:00:00Z',
            failed: ['mock_location', 'rooted'],
        });

        expect(outcome.ok === false && outcome.reason).toBe('rooted');
    });

    it('labels devices for the list', () => {
        expect(integrityBadge(DEVICES[0].integrity_verdict)).toEqual({
            tone: 'success',
            label: 'Lolos',
        });
        expect(integrityBadge(DEVICES[2].integrity_verdict).tone).toBe(
            'danger',
        );
    });
});

describe('face check-in', () => {
    it('advances liveness steps over time', () => {
        expect(livenessProgress(0, 1000)).toMatchObject({
            step: 0,
            percent: 0,
            done: false,
        });
        expect(livenessProgress(1500, 1000)).toMatchObject({
            step: 1,
            stepProgress: 0.5,
            percent: 50,
        });
        expect(livenessProgress(5000, 1000)).toMatchObject({
            step: 3,
            percent: 100,
            done: true,
        });
    });

    it('maps scenarios to outcomes', () => {
        expect(faceOutcome('cocok')).toEqual({ kind: 'match', score: 98 });
        expect(faceOutcome('liveness').kind).toBe('liveness_failed');
        expect(faceOutcome('tidak-cocok')).toMatchObject({ score: 62 });
    });

    it('requires every consent statement', () => {
        expect(canGiveConsent([true, true])).toBe(true);
        expect(canGiveConsent([true, false])).toBe(false);
        expect(canGiveConsent([])).toBe(false);
    });
});

describe('widget & devices', () => {
    it('summarizes today’s tasks with overdue first', () => {
        const summary = summarizeTasks(WIDGET_TASKS);

        expect(summary).toMatchObject({
            done: 3,
            total: 7,
            overdue: 2,
            percent: 43,
        });
        expect(summary.next.map((task) => task.key)).toEqual([
            'OPS-38',
            'OPS-41',
            'OPS-44',
        ]);
        expect(summarizeTasks([]).percent).toBe(0);
    });

    it('lists this device first, then by last seen', () => {
        const sorted = sortDevices([...DEVICES].reverse());

        expect(sorted.map((device) => device.id)).toEqual([
            'dev_iphone13',
            'dev_galaxy_a54',
            'dev_redmi_note12',
        ]);
    });
});

describe('quick add', () => {
    it('validates the mini forms', () => {
        expect(validateQuickAdd('check_in', { title: '' })).toBeNull();
        expect(validateQuickAdd('task', { title: '  ' })).toBe(
            'Tulis judulnya dulu.',
        );
        expect(validateQuickAdd('note', { title: '' })).toBe(
            'Tulis isi catatan.',
        );
        expect(
            validateQuickAdd('leave', {
                title: '',
                start: '2026-10-09',
                end: '2026-10-07',
            }),
        ).toMatch(/sebelum/);
        expect(
            validateQuickAdd('leave', {
                title: '',
                start: '2026-10-07',
                end: '2026-10-09',
            }),
        ).toBeNull();
    });

    it('counts leave days inclusively', () => {
        expect(leaveDays('2026-10-07', '2026-10-09')).toBe(3);
        expect(leaveDays('2026-10-09', '2026-10-07')).toBe(0);
    });
});
