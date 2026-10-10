import type { StatusCategory } from '@/features/tasks/types';

/** Segmen kartu "Tugas hari ini": pribadi · tim · semua. */
export type TugasSegment = 'pribadi' | 'tim' | 'semua';

export type TugasHariIniItem = {
    id: string;
    /** "OPS-142". */
    key: string;
    title: string;
    workspace: { key: string; name: string };
    status: { name: string; category: StatusCategory; is_done: boolean };
    /** Label siap tampil dari backend ("Urgent", "Tinggi", …, "Tanpa"). */
    priority: string;
    /** Nama lenggota yang mengerjakan. */
    assignees: string[];
    /** `attendance` = dibuat dari rencana kerja saat absen masuk. */
    source: 'manual' | 'attendance';
    /** /w/{KEY}/tasks/{n}. */
    url: string;
};

/** Props Inertia `tugasHariIni` (App\Domain\Tasks\Queries\TugasHariIni). */
export type TugasHariIniPayload = {
    today: string;
    pribadi: TugasHariIniItem[];
    tim: TugasHariIniItem[];
    semua: TugasHariIniItem[];
    counts: Record<TugasSegment, number>;
};
