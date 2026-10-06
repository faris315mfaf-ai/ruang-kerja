import { describe, expect, it } from 'vitest';
import {
    attendanceCard,
    attendanceSegments,
    attentionNote,
    barHeights,
    chartFoot,
    chartSummary,
    deltaPhrase,
    healthPill,
    milestoneWhen,
    periodNote,
    shortDate,
    shortRange,
    tasksCard,
    thirdCard,
} from './lib';
import type { PeriodBlock } from './types';

const range = {
    from: '2026-09-28',
    to: '2026-10-02',
    label: '28 Sep – 2 Okt 2026',
};

function week(
    chart: PeriodBlock['chart'],
    done: number,
    planned: number,
): PeriodBlock {
    return {
        range,
        attendance: {
            kind: 'average',
            attended: 228,
            scheduled: 240,
            rate: 95,
        },
        tasks: {
            done,
            planned,
            rate: planned ? Math.round((done / planned) * 100) : null,
        },
        overdue: null,
        on_time: {
            value: 86,
            numerator: 86,
            denominator: 100,
            previous: 83,
            delta: 3,
            previous_range: {
                from: '2026-09-21',
                to: '2026-09-25',
                label: '21–25 Sep 2026',
            },
        },
        chart,
    };
}

const col = (label: string, planned: number, done: number) => ({
    key: label,
    label,
    full_label: label,
    planned,
    done,
});

describe('management chart', () => {
    it('scales bars to the busiest column', () => {
        expect(
            barHeights([
                { planned: 32, done: 30 },
                { planned: 16, done: 8 },
                { planned: 0, done: 0 },
            ]),
        ).toEqual([
            { planned: 190, done: 178 },
            { planned: 95, done: 48 },
            { planned: 0, done: 0 },
        ]);
    });

    it('keeps tiny non-zero values visible and done within planned', () => {
        expect(barHeights([{ planned: 1000, done: 1 }], 100)).toEqual([
            { planned: 100, done: 4 },
        ]);
        expect(
            barHeights(
                [
                    { planned: 1, done: 1 },
                    { planned: 400, done: 0 },
                ],
                100,
            )[0],
        ).toEqual({
            planned: 4,
            done: 4,
        });
    });

    it('returns flat bars when there is nothing to show', () => {
        expect(barHeights([])).toEqual([]);
        expect(barHeights([{ planned: 0, done: 0 }])).toEqual([
            { planned: 0, done: 0 },
        ]);
    });

    it('writes the daily foot note from the numbers and the data time', () => {
        const today = {
            ...week([col('Programming', 18, 9)], 23, 54),
            overdue: { count: 0, top_division: null },
            on_time: null,
        };

        expect(chartFoot('harian', today, '2026-10-05T02:40:00Z')).toBe(
            'Hari masih berjalan: 23 dari 54 tugas terjadwal sudah selesai per 09.40.',
        );
        expect(
            chartFoot('harian', {
                ...today,
                tasks: { done: 0, planned: 0, rate: null },
            }),
        ).toBe('Belum ada tugas bertenggat hari ini.');
    });

    it('names the weakest column without inventing a cause', () => {
        const block = week(
            [
                col('Sen 28', 32, 30),
                col('Rab 30', 31, 27),
                col('Kam 1', 29, 28),
            ],
            85,
            92,
        );

        expect(chartFoot('mingguan', block)).toBe(
            '85 dari 92 tugas bertenggat minggu lalu selesai (92%). Penyelesaian terendah: Rab 30 (27 dari 31).',
        );
        expect(chartFoot('bulanan', week([col('Mg 40', 10, 10)], 10, 10))).toBe(
            '10 dari 10 tugas bertenggat dalam 4 minggu terakhir selesai (100%).',
        );
        expect(chartFoot('mingguan', week([], 0, 0))).toBe(
            'Tidak ada tugas bertenggat minggu lalu.',
        );
    });

    it('summarizes the chart for screen readers', () => {
        expect(
            chartSummary('mingguan', week([col('Sen 28', 2, 1)], 1, 2)),
        ).toBe(
            'Kerja harian minggu lalu, selesai dari rencana: Sen 28 1 dari 2.',
        );
        expect(chartSummary('harian', week([], 0, 0))).toBe(
            'Kerja hari ini per divisi: tidak ada data.',
        );
    });
});

describe('management period tabs', () => {
    it('describes what each tab covers', () => {
        expect(periodNote('harian')).toBe('hari ini');
        expect(periodNote('mingguan', week([], 0, 0))).toBe(
            'minggu lalu, 28 Sep–2 Okt',
        );
        expect(
            periodNote('bulanan', {
                ...week([], 0, 0),
                range: { ...range, from: '2026-09-07' },
            }),
        ).toBe('4 minggu terakhir, 7 Sep–2 Okt');
        expect(shortRange('2026-09-07', '2026-09-11')).toBe('7–11 Sep');
    });
});

describe('management KPI cards', () => {
    it('builds the daily presence card', () => {
        const today: PeriodBlock = {
            ...week([], 23, 54),
            attendance: {
                kind: 'today',
                present: 44,
                scheduled: 48,
                rate: 92,
                late: 3,
                not_checked_in: 2,
            },
            overdue: {
                count: 11,
                top_division: { name: 'Programming', count: 6 },
            },
            on_time: null,
        };

        // Today's presence and overdue tasks live in Absensi / are gone
        // from the management dashboard (keputusan pemilik 6 Okt 2026).
        expect(attendanceCard(today)).toBeNull();
        expect(tasksCard('harian', today)).toMatchObject({
            value: '23',
            note: 'dari 54 terjadwal hari ini',
        });
        expect(thirdCard('harian', today)).toBeNull();
    });

    it('builds the weekly cards with the on-time delta', () => {
        const block = week([], 141, 150);

        expect(attendanceCard(block)).toMatchObject({
            label: 'Kehadiran rata-rata',
            value: '95%',
            note: '228 dari 240 hari-orang',
        });
        expect(tasksCard('mingguan', block).note).toBe(
            'dari 150 rencana · 94%',
        );
        expect(thirdCard('mingguan', block)).toMatchObject({
            label: 'Tepat waktu',
            value: '86%',
            note: 'naik 3 poin dari minggu sebelumnya',
        });
    });

    it('phrases deltas in points against the right period', () => {
        expect(deltaPhrase(-2, 89, 'bulanan')).toBe(
            'turun 2 poin dari 4 minggu sebelumnya',
        );
        expect(deltaPhrase(0, 80, 'mingguan')).toBe(
            'sama dengan minggu sebelumnya',
        );
        expect(deltaPhrase(null, null, 'mingguan')).toBe(
            'belum ada data minggu sebelumnya',
        );
    });

    it('lists the projects needing attention', () => {
        expect(
            attentionNote({
                count: 3,
                items: [
                    { key: 'KMB', name: 'Koperasi', reason: 'berisiko' },
                    { key: 'DEP', name: 'Pemda', reason: 'bermasalah' },
                    {
                        key: 'KTR',
                        name: 'Kantor',
                        reason: 'milestone terlewat',
                    },
                ],
            }),
        ).toBe('KMB berisiko · DEP bermasalah · +1 lainnya');
        expect(attentionNote({ count: 0, items: [] })).toBe(
            'Semua proyek aktif sesuai jalur',
        );
    });
});

describe('management projects & attendance', () => {
    it('maps health to the design status pills', () => {
        expect(healthPill('on_track')).toEqual({
            label: 'Sesuai jalur',
            tone: 'success',
        });
        expect(healthPill('at_risk')).toEqual({
            label: 'Berisiko',
            tone: 'warning',
        });
        expect(healthPill('off_track')).toEqual({
            label: 'Bermasalah',
            tone: 'danger',
        });
        expect(healthPill(null).tone).toBe('neutral');
    });

    it('formats the next milestone and missed ones', () => {
        expect(shortDate('2026-10-19')).toBe('Sen, 19 Okt');
        expect(
            milestoneWhen({
                name: 'Go-live',
                target_date: '2026-10-19',
                missed: false,
                days_left: 14,
            }),
        ).toEqual({
            text: 'Sen, 19 Okt · 14 hari',
            late: false,
        });
        expect(
            milestoneWhen({
                name: 'API',
                target_date: '2026-10-02',
                missed: true,
                days_left: -3,
            }),
        ).toEqual({
            text: 'terlewat 2 Okt',
            late: true,
        });
    });

    it('adds the Alpha segment only when someone has it', () => {
        const counts = {
            scheduled: 48,
            present: 44,
            on_time: 41,
            late: 3,
            away: 2,
            not_checked_in: 2,
            absent: 0,
        };

        expect(
            attendanceSegments(counts).map((s) => [s.label, s.value]),
        ).toEqual([
            ['Tepat waktu', 41],
            ['Terlambat', 3],
            ['Cuti / izin', 2],
            ['Belum check-in', 2],
        ]);
        expect(attendanceSegments({ ...counts, absent: 1 }).at(-1)?.label).toBe(
            'Alpha',
        );
    });
});
