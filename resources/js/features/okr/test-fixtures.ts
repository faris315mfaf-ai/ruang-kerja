import type {
    DivisionRef,
    KeyResult,
    KrCheckin,
    KrUnit,
    LinkedTask,
    Objective,
    OkrIndexProps,
    PersonRef,
    QuarterKey,
} from './types';

// Sample OKR data for the Vitest suites (the pages get real props from the
// server; demo rows come from database/seeders/OkrDemoSeeder.php).
// "Today" = Mon, 5 Oct 2026 (week 1 of Q4 2026).

export const OKR_TODAY = '2026-10-05';

/** "Now" for relative times (08.45 WIB). */
export const OKR_NOW = '2026-10-05T01:45:00Z';

const person = (id: string, name: string): PersonRef => ({ id, name });

export const PEOPLE = {
    dimas: person('u-dimas', 'Dimas Pratama'),
    hana: person('u-hana', 'Hana Nuraini'),
    hendra: person('u-hendra', 'Hendra Wijaya'),
    rizky: person('u-rizky', 'Rizky Aditya'),
    sari: person('u-sari', 'Sari Wulandari'),
    maya: person('u-maya', 'Maya Lestari'),
    yoga: person('u-yoga', 'Yoga Permana'),
    bayu: person('u-bayu', 'Bayu Saputra'),
    putri: person('u-putri', 'Putri Ramadhani'),
    fitri: person('u-fitri', 'Fitri Handayani'),
    lina: person('u-lina', 'Lina Marlina'),
} as const;

/** People who can own a key result (form select). */
export const OWNERS: PersonRef[] = Object.values(PEOPLE);

export const DIVISIONS: DivisionRef[] = [
    { id: 'div-ops', name: 'Operasional', code: 'OPS' },
    { id: 'div-prg', name: 'Programming', code: 'PRG' },
    { id: 'div-imp', name: 'Implementer', code: 'IMP' },
    { id: 'div-anl', name: 'Analis', code: 'ANL' },
    { id: 'div-brd', name: 'Branding & Marketing', code: 'BRD' },
    { id: 'div-hr', name: 'HR', code: 'HR' },
];

const division = (code: string) =>
    DIVISIONS.find((item) => item.code === code) ?? DIVISIONS[0];

/** Fridays of Q3 2026 (weekly check-in day). */
const Q3_FRIDAYS = [
    '2026-07-03',
    '2026-07-10',
    '2026-07-17',
    '2026-07-24',
    '2026-07-31',
    '2026-08-07',
    '2026-08-14',
    '2026-08-21',
    '2026-08-28',
    '2026-09-04',
    '2026-09-11',
    '2026-09-18',
    '2026-09-25',
];

const NOTES = [
    'Sesuai rencana minggu ini.',
    'Sedikit tertahan menunggu data klien.',
    'Ada percepatan setelah tim ditambah.',
    null,
    'Perlu perhatian di minggu depan.',
];

/**
 * Weekly check-ins easing from `start` to `end` (deterministic wiggle), the
 * last one equal to `end`.
 */
function weeklyCheckins(
    krId: string,
    dates: string[],
    start: number,
    end: number,
    author: PersonRef,
    decimals = 0,
): KrCheckin[] {
    const factor = 10 ** decimals;

    return dates.map((date, index) => {
        const t = (index + 1) / dates.length;
        const eased = 1 - (1 - t) ** 1.6;
        const wiggle =
            index === dates.length - 1 ? 0 : Math.sin(index * 1.7) * 0.04;
        const value =
            Math.round((start + (end - start) * (eased + wiggle)) * factor) /
            factor;

        return {
            id: `${krId}-c${index + 1}`,
            key_result_id: krId,
            date,
            value: index === dates.length - 1 ? end : value,
            confidence: 6 + ((index * 3) % 4),
            note: NOTES[index % NOTES.length],
            author,
        };
    });
}

const task = (
    id: string,
    key: string,
    title: string,
    status: LinkedTask['status_category'],
    assignee: PersonRef | null,
    due: string | null,
): LinkedTask => ({
    id,
    key,
    title,
    status_category: status,
    assignee,
    due_date: due,
});

type KrSeed = {
    id: string;
    title: string;
    unit: KrUnit;
    label?: string;
    start: number;
    target: number;
    current: number;
    weight: number;
    owner: PersonRef;
    tasks?: LinkedTask[];
    /** Check-ins; defaults to one on Fri 2 Oct (Q4) or weekly (Q3). */
    checkins?: KrCheckin[];
    decimals?: number;
};

function objective(
    id: string,
    quarter: QuarterKey,
    divisionCode: string,
    title: string,
    owner: PersonRef,
    description: string | null,
    seeds: KrSeed[],
): Objective {
    return {
        id,
        company_id: 'co-spkd',
        division: division(divisionCode),
        quarter,
        title,
        description,
        owner,
        status: quarter === '2026-Q4' ? 'active' : 'closed',
        created_at:
            quarter === '2026-Q4'
                ? '2026-09-28T02:00:00Z'
                : '2026-06-26T02:00:00Z',
        updated_at:
            quarter === '2026-Q4'
                ? '2026-10-02T09:30:00Z'
                : '2026-09-25T09:30:00Z',
        key_results: seeds.map((seed): KeyResult => ({
            id: seed.id,
            objective_id: id,
            title: seed.title,
            unit: seed.unit,
            unit_label: seed.label ?? '',
            start_value: seed.start,
            target_value: seed.target,
            current_value: seed.current,
            weight: seed.weight,
            owner: seed.owner,
            tasks: seed.tasks ?? [],
            checkins:
                seed.checkins ??
                (quarter === '2026-Q4'
                    ? [
                          {
                              id: `${seed.id}-c1`,
                              key_result_id: seed.id,
                              date: '2026-10-02',
                              value: seed.current,
                              confidence: 7,
                              note: 'Check-in pertama kuartal.',
                              author: seed.owner,
                          },
                      ]
                    : weeklyCheckins(
                          seed.id,
                          Q3_FRIDAYS,
                          seed.start,
                          seed.current,
                          seed.owner,
                          seed.decimals,
                      )),
        })),
    };
}

const P = PEOPLE;

export const OBJECTIVES: Objective[] = [
    objective(
        'q4-ops-1',
        '2026-Q4',
        'OPS',
        'Go-live SIMRS RS Harapan Sehat tanpa insiden kritis',
        P.dimas,
        'Go-live Sen, 19 Okt. Fokus kuartal: UAT tuntas, bug kritis nol, dan semua unit RS terlatih sebelum hypercare berakhir.',
        [
            {
                id: 'kr-ops1-uat',
                title: 'Skenario UAT lulus sebelum go-live',
                unit: 'number',
                label: 'skenario',
                start: 140,
                target: 190,
                current: 148,
                weight: 40,
                owner: P.maya,
                tasks: [
                    task(
                        't-sim-401',
                        'SIM-401',
                        'Jalankan UAT sesi 3 modul farmasi',
                        'in_progress',
                        P.maya,
                        '2026-10-08',
                    ),
                    task(
                        't-sim-402',
                        'SIM-402',
                        'Susun skenario retur obat sebagian',
                        'review',
                        P.sari,
                        '2026-10-06',
                    ),
                    task(
                        't-sim-395',
                        'SIM-395',
                        'UAT sesi 2 modul rawat jalan',
                        'done',
                        P.maya,
                        '2026-10-01',
                    ),
                ],
                checkins: [
                    {
                        id: 'kr-ops1-uat-c1',
                        key_result_id: 'kr-ops1-uat',
                        date: '2026-10-02',
                        value: 148,
                        confidence: 7,
                        note: 'Sesi 2 selesai, 8 skenario baru lulus.',
                        author: P.maya,
                    },
                ],
            },
            {
                id: 'kr-ops1-bug',
                title: 'Bug kritis terbuka di produksi',
                unit: 'number',
                label: 'bug',
                start: 2,
                target: 0,
                current: 3,
                weight: 30,
                owner: P.rizky,
                tasks: [
                    task(
                        't-sim-388',
                        'SIM-388',
                        'Antrean farmasi berhenti saat resep racikan',
                        'in_progress',
                        P.rizky,
                        '2026-10-05',
                    ),
                    task(
                        't-sim-390',
                        'SIM-390',
                        'Label farmasi tidak terbaca pemindai',
                        'todo',
                        P.rizky,
                        '2026-10-07',
                    ),
                ],
                checkins: [
                    {
                        id: 'kr-ops1-bug-c1',
                        key_result_id: 'kr-ops1-bug',
                        date: '2026-10-02',
                        value: 3,
                        confidence: 5,
                        note: 'Muncul 1 bug kritis baru di antrean farmasi.',
                        author: P.rizky,
                    },
                ],
            },
            {
                id: 'kr-ops1-train',
                title: 'Unit RS selesai pelatihan pengguna',
                unit: 'number',
                label: 'unit',
                start: 3,
                target: 8,
                current: 3,
                weight: 30,
                owner: P.sari,
                tasks: [
                    task(
                        't-sim-410',
                        'SIM-410',
                        'Pelatihan unit rawat inap',
                        'todo',
                        P.lina,
                        '2026-10-09',
                    ),
                ],
            },
        ],
    ),
    objective(
        'q4-ops-2',
        '2026-Q4',
        'OPS',
        'Proses kerja internal lebih cepat dan tercatat',
        P.dimas,
        'Semua pekerjaan tim tercatat di RuangKerja agar lead time bisa diukur.',
        [
            {
                id: 'kr-ops2-lead',
                title: 'Median lead time tugas',
                unit: 'days',
                start: 6.5,
                target: 4,
                current: 6.2,
                weight: 50,
                owner: P.dimas,
                decimals: 1,
            },
            {
                id: 'kr-ops2-log',
                title: 'Tugas tim tercatat di RuangKerja',
                unit: 'percent',
                start: 70,
                target: 95,
                current: 74,
                weight: 50,
                owner: P.rizky,
            },
        ],
    ),
    objective(
        'q4-prg-1',
        '2026-Q4',
        'PRG',
        'Kualitas rilis aplikasi klien naik',
        P.yoga,
        null,
        [
            {
                id: 'kr-prg1-test',
                title: 'Cakupan test Aplikasi Koperasi',
                unit: 'percent',
                start: 48,
                target: 70,
                current: 50,
                weight: 40,
                owner: P.fitri,
                tasks: [
                    task(
                        't-kmb-220',
                        'KMB-220',
                        'Test modul simpanan anggota',
                        'in_progress',
                        P.fitri,
                        '2026-10-09',
                    ),
                ],
            },
            {
                id: 'kr-prg1-bugs',
                title: 'Bug terbuka lintas proyek',
                unit: 'number',
                label: 'bug',
                start: 14,
                target: 4,
                current: 19,
                weight: 30,
                owner: P.yoga,
            },
            {
                id: 'kr-prg1-pr',
                title: 'PR direview kurang dari 1 hari',
                unit: 'percent',
                start: 60,
                target: 90,
                current: 58,
                weight: 30,
                owner: P.yoga,
            },
        ],
    ),
    objective(
        'q4-imp-1',
        '2026-Q4',
        'IMP',
        'Klien puas setelah go-live',
        P.bayu,
        'Hypercare SIMRS dan Koperasi Maju tanpa tiket menumpuk.',
        [
            {
                id: 'kr-imp1-open',
                title: 'Tiket dukungan terbuka',
                unit: 'number',
                label: 'tiket',
                start: 8,
                target: 3,
                current: 11,
                weight: 40,
                owner: P.bayu,
            },
            {
                id: 'kr-imp1-nps',
                title: 'Skor kepuasan klien (NPS)',
                unit: 'number',
                label: 'poin',
                start: 40,
                target: 60,
                current: 38,
                weight: 30,
                owner: P.lina,
            },
            {
                id: 'kr-imp1-p1',
                title: 'Tiket P1 selesai kurang dari 4 jam',
                unit: 'percent',
                start: 70,
                target: 95,
                current: 70,
                weight: 30,
                owner: P.lina,
            },
        ],
    ),
    objective(
        'q4-anl-1',
        '2026-Q4',
        'ANL',
        'Dokumen analisis siap lebih awal',
        P.maya,
        null,
        [
            {
                id: 'kr-anl1-srs',
                title: 'SRS disetujui klien',
                unit: 'number',
                label: 'dokumen',
                start: 0,
                target: 3,
                current: 0,
                weight: 50,
                owner: P.maya,
            },
            {
                id: 'kr-anl1-qa',
                title: 'Temuan QA tinggi terbuka',
                unit: 'number',
                label: 'temuan',
                start: 4,
                target: 0,
                current: 3,
                weight: 50,
                owner: P.sari,
            },
        ],
    ),
    objective(
        'q4-brd-1',
        '2026-Q4',
        'BRD',
        'Pipeline prospek baru untuk 2027',
        P.putri,
        null,
        [
            {
                id: 'kr-brd1-lead',
                title: 'Prospek baru masuk',
                unit: 'number',
                label: 'prospek',
                start: 0,
                target: 30,
                current: 7,
                weight: 50,
                owner: P.putri,
            },
            {
                id: 'kr-brd1-content',
                title: 'Konten terbit',
                unit: 'number',
                label: 'konten',
                start: 0,
                target: 48,
                current: 3,
                weight: 30,
                owner: P.putri,
            },
            {
                id: 'kr-brd1-tender',
                title: 'Tender dimenangkan',
                unit: 'number',
                label: 'tender',
                start: 0,
                target: 2,
                current: 0,
                weight: 20,
                owner: P.hendra,
            },
        ],
    ),
    objective(
        'q4-hr-1',
        '2026-Q4',
        'HR',
        'Administrasi SDM tepat waktu',
        P.hana,
        null,
        [
            {
                id: 'kr-hr1-payroll',
                title: 'Waktu rekap payroll bulanan',
                unit: 'number',
                label: 'menit',
                start: 90,
                target: 30,
                current: 85,
                weight: 50,
                owner: P.hana,
            },
            {
                id: 'kr-hr1-checkin',
                title: 'Karyawan absen lewat RuangKerja',
                unit: 'percent',
                start: 80,
                target: 95,
                current: 92,
                weight: 50,
                owner: P.hana,
            },
        ],
    ),
    // ---- Q3 2026 (closed) ----
    objective(
        'q3-ops-1',
        '2026-Q3',
        'OPS',
        'RuangKerja dipakai seluruh kantor',
        P.dimas,
        'Fase 1 RuangKerja dirilis bertahap ke semua divisi.',
        [
            {
                id: 'kr-q3ops-active',
                title: 'Karyawan aktif mingguan',
                unit: 'percent',
                start: 0,
                target: 95,
                current: 92,
                weight: 60,
                owner: P.dimas,
            },
            {
                id: 'kr-q3ops-modules',
                title: 'Modul Fase 1 dirilis',
                unit: 'number',
                label: 'modul',
                start: 0,
                target: 8,
                current: 7,
                weight: 40,
                owner: P.rizky,
            },
        ],
    ),
    objective(
        'q3-prg-1',
        '2026-Q3',
        'PRG',
        'Sprint Aplikasi Koperasi sesuai rencana',
        P.yoga,
        null,
        [
            {
                id: 'kr-q3prg-points',
                title: 'Poin sprint selesai',
                unit: 'number',
                label: 'poin',
                start: 0,
                target: 240,
                current: 168,
                weight: 70,
                owner: P.yoga,
            },
            {
                id: 'kr-q3prg-demo',
                title: 'Demo sprint diterima klien',
                unit: 'number',
                label: 'demo',
                start: 0,
                target: 6,
                current: 4,
                weight: 30,
                owner: P.fitri,
            },
        ],
    ),
    objective(
        'q3-imp-1',
        '2026-Q3',
        'IMP',
        'Infrastruktur SIMRS siap',
        P.bayu,
        null,
        [
            {
                id: 'kr-q3imp-server',
                title: 'Server produksi & cadangan terpasang',
                unit: 'number',
                label: 'server',
                start: 0,
                target: 2,
                current: 2,
                weight: 50,
                owner: P.bayu,
            },
            {
                id: 'kr-q3imp-migrate',
                title: 'Rekam medis termigrasi',
                unit: 'percent',
                start: 0,
                target: 100,
                current: 85,
                weight: 50,
                owner: P.lina,
            },
        ],
    ),
    objective('q3-brd-1', '2026-Q3', 'BRD', 'Rebranding SPKD', P.putri, null, [
        {
            id: 'kr-q3brd-logo',
            title: 'Alternatif logo siap dipilih',
            unit: 'number',
            label: 'konsep',
            start: 0,
            target: 3,
            current: 3,
            weight: 40,
            owner: P.putri,
        },
        {
            id: 'kr-q3brd-web',
            title: 'Halaman website baru selesai',
            unit: 'number',
            label: 'halaman',
            start: 0,
            target: 12,
            current: 8,
            weight: 60,
            owner: P.putri,
        },
    ]),
];

export const OKR_INDEX: OkrIndexProps = {
    today: OKR_TODAY,
    quarters: ['2026-Q4', '2026-Q3'],
    current_quarter: '2026-Q4',
    filters: { quarter: '2026-Q4', division: 'all' },
    divisions: DIVISIONS,
    objectives: OBJECTIVES,
    create: null,
};

export function findObjective(id: string): Objective | null {
    return OBJECTIVES.find((item) => item.id === id) ?? null;
}
