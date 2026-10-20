import { describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@/routes/hiring/candidates', () => ({
    interview: { url: (id: string) => `/hiring/kandidat/${id}/wawancara` },
}));

import { interviewPayload, splitLocal } from './interview-schedule-card';

describe('Jadwal wawancara', () => {
    it('splits the office-time value into date and time', () => {
        expect(splitLocal('2026-10-20 10:30')).toEqual(['2026-10-20', '10:30']);
        expect(splitLocal(null)).toEqual(['', '']);
    });

    it('builds the PUT body; an empty date clears the schedule', () => {
        expect(
            interviewPayload('2026-10-22', '13:00', ' Ruang Rapat 2 '),
        ).toEqual({
            interview_at: '2026-10-22 13:00',
            interview_location: 'Ruang Rapat 2',
        });
        expect(interviewPayload('2026-10-22', '', '')).toEqual({
            interview_at: '2026-10-22 09:00',
            interview_location: null,
        });
        expect(interviewPayload('', '10:00', 'x').interview_at).toBeNull();
    });
});
