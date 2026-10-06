<?php

namespace Database\Seeders;

use App\Domain\Meetings\Enums\MeetingPlatform;
use App\Domain\Meetings\Enums\MinutesStatus;
use App\Domain\Meetings\Enums\Recurrence;
use App\Domain\Meetings\Enums\Rsvp;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingMinuteVersion;
use App\Models\MeetingParticipant;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo Rapat & Kalender (local/testing, idempotent; F2-3), relative to the
 * current office week: the Operasional stand-up (Mon/Wed/Fri) of Dimas with
 * a final record whose first follow-up already became an OPS task and a
 * draft for the latest occurrence, the PLQ launch coordination, a vendor
 * review on Zoom with an external guest, the weekly board meeting and the
 * RuangKerja sprint review (leadership) with final minutes, and a 1:1.
 * Content adapted from the front-end prototype. Rows are written directly:
 * no notifications or jobs.
 */
class MeetingDemoSeeder extends Seeder
{
    /** Persona → demo account. */
    private const array PEOPLE = [
        'dimas' => 'kadiv@demo.test',
        'rizky' => 'anggota@demo.test',
        'sari' => 'sari.wulandari@demo.test',
        'bayu' => 'bayu.saputra@demo.test',
        'nadia' => 'nadia.putri@demo.test',
        'yoga' => 'yoga.pratama@demo.test',
        'fitri' => 'fitri.handayani@demo.test',
        'maya' => 'maya.lestari@demo.test',
        'putri' => 'putri.ramadhani@demo.test',
        'hendra' => 'direksi@demo.test',
        'lestari' => 'lestari.anggraini@demo.test',
        'agus' => 'agus.setiawan@demo.test',
        'hana' => 'hr@demo.test',
        'yudi' => 'yudi.hartono@demo.test',
        'arif' => 'programmer@demo.test',
    ];

    /** @var array<string, User> */
    private array $people = [];

    private CarbonImmutable $monday;

    private string $timezone;

    public function run(): void
    {
        foreach (self::PEOPLE as $persona => $email) {
            $user = User::query()->where('email', $email)->first();

            if ($user !== null) {
                $this->people[$persona] = $user;
            }
        }

        if (count($this->people) < count(self::PEOPLE) || Meeting::query()->where('title', 'Stand-up Divisi Operasional')->exists()) {
            return; // Organization not seeded, or meetings already seeded.
        }

        $this->timezone = config()->string('app.office_timezone');
        $this->monday = CarbonImmutable::now($this->timezone)->startOfWeek(CarbonImmutable::MONDAY)->startOfDay();
        $ops = Workspace::query()->where('key', 'OPS')->first();
        $plq = Workspace::query()->where('key', 'PLQ')->first();

        $this->standup($ops);

        $this->meeting('putri', [
            'title' => 'Koordinasi peluncuran Q4',
            'day' => 0, 'start' => '14:00', 'minutes' => 60,
            'platform' => MeetingPlatform::Meet, 'join_url' => 'https://meet.google.com/plq-rkja-q4x',
            'minute_taker' => 'maya', 'workspace' => $plq,
            'agenda' => ['Materi peluncuran', 'Anggaran vendor video', 'Jadwal presentasi ke Direksi'],
        ], ['dimas' => Rsvp::Yes, 'maya' => Rsvp::Yes, 'rizky' => Rsvp::Pending, 'hendra' => Rsvp::Maybe]);

        $this->meeting('dimas', [
            'title' => 'Review vendor logistik',
            'day' => 1, 'start' => '13:30', 'minutes' => 60,
            'platform' => MeetingPlatform::Zoom, 'join_url' => 'https://zoom.us/j/81234567890',
            'minute_taker' => 'bayu', 'workspace' => $ops,
            'agenda' => ['Evaluasi ketepatan pengiriman September', 'Penawaran harga kuartal IV', 'SLA klaim barang rusak'],
            'guests' => ['logistik@sinarlogistik.co.id'],
        ], ['bayu' => Rsvp::Yes, 'rizky' => Rsvp::Yes, 'fitri' => Rsvp::Pending]);

        $this->meeting('dimas', [
            'title' => '1:1 Dimas & Sari',
            'day' => 4, 'start' => '15:30', 'minutes' => 30,
            'platform' => MeetingPlatform::Room, 'location' => 'Ruang Rapat Lt. 2',
            'agenda' => ['Beban kerja Tim Gudang', 'Rencana cuti akhir tahun'],
        ], ['sari' => Rsvp::Yes]);

        $this->board();
        $this->sprintReview();
    }

    /** Mon/Wed/Fri stand-up: final minutes a week ago, draft for the latest occurrence. */
    private function standup(?Workspace $ops): void
    {
        $team = ['rizky', 'sari', 'bayu', 'nadia', 'yoga'];
        $standup = $this->meeting('dimas', [
            'title' => 'Stand-up Divisi Operasional',
            'day' => -28, 'start' => '09:00', 'minutes' => 30,
            'platform' => MeetingPlatform::Meet, 'join_url' => 'https://meet.google.com/ops-rkja-stp',
            'minute_taker' => 'dimas', 'workspace' => $ops,
            'recurrence' => Recurrence::MonWedFri,
            'agenda' => ['Status stok & gudang', 'Tugas terlambat divisi', 'Persiapan audit stok Oktober'],
        ], array_fill_keys($team, Rsvp::Yes));

        $lastWeek = $this->date(-3); // Friday of last week
        $task = $ops !== null
            ? Task::query()->where('workspace_id', $ops->id)->whereHas('assignees', fn ($query) => $query->where('users.id', $this->people['rizky']->id))->orderBy('number')->first()
            : null;

        $this->minutes($standup, $lastWeek, MinutesStatus::Final, $this->attendance($team, ['nadia' => 'cuti']), [
            ['title' => 'Status stok & gudang', 'body' => "Selisih stok rak C turun dari 42 ke 18 SKU setelah hitung ulang.\nMigrasi batch 2 sedang diimpor."],
            ['title' => 'Tugas terlambat divisi', 'body' => 'Lima tugas terlambat, tiga milik Rizky. Fitri membantu input tagihan vendor.'],
            ['title' => 'Persiapan audit stok Oktober', 'body' => 'Hitung fisik Sabtu pekan depan, butuh 4 orang.'],
        ], [
            'Hitung fisik audit stok dilakukan Sabtu pukul 08.00–12.00.',
            'Laporan selisih stok mingguan dikirim setiap Jumat ke Kepala Divisi.',
        ], [
            ['Selesaikan rekap stok September', 'rizky', 1, $task],
            ['Bagikan hasil impor batch 2 ke tim gudang', 'sari', -1, null, true],
            ['Kalibrasi timbangan rak C', 'yoga', -1],
        ]);

        // Draft of today's occurrence (or the latest one this week).
        $draftDay = min(CarbonImmutable::now($this->timezone)->dayOfWeekIso, 5);
        $draftOffset = match (true) {
            $draftDay >= 5 => 4,
            $draftDay >= 3 => 2,
            default => 0,
        };

        $this->minutes($standup, $this->date($draftOffset), MinutesStatus::Draft, $this->attendance($team, ['nadia' => 'cuti']), [
            ['title' => 'Status stok & gudang', 'body' => 'Selisih rak C tinggal 6 SKU. Impor batch 3 dijadwalkan besok.'],
            ['title' => 'Tugas terlambat divisi', 'body' => ''],
            ['title' => 'Persiapan audit stok Oktober', 'body' => 'Lembur hitung fisik sudah diajukan.'],
        ], ['Rizky fokus ke rekap stok sampai Rabu.'], [
            ['Kirim jadwal servis 2 kendaraan ke vendor', 'dimas', 2],
            ['Siapkan formulir hitung fisik', 'bayu', 3],
        ]);
    }

    /** Weekly board meeting (leadership), final minutes for last week. */
    private function board(): void
    {
        $board = $this->meeting('hendra', [
            'title' => 'Rapat direksi mingguan',
            'day' => -21, 'start' => '10:00', 'minutes' => 90,
            'platform' => MeetingPlatform::Room, 'location' => 'Ruang Direksi Lt. 5',
            'minute_taker' => 'hana', 'leadership' => true,
            'recurrence' => Recurrence::Weekly,
            'agenda' => ['Tender Dinas Kominfo', 'Kebutuhan programmer', 'Kesiapan peluncuran Q4'],
        ], ['lestari' => Rsvp::Yes, 'hana' => Rsvp::Yes, 'agus' => Rsvp::Yes, 'putri' => Rsvp::Maybe]);

        $this->minutes($board, $this->date(-7), MinutesStatus::Final, $this->attendance(['lestari', 'hana', 'agus', 'putri'], []), [
            ['title' => 'Tender Dinas Kominfo', 'body' => 'Dokumen teknis lengkap; harga final menunggu Keuangan.'],
            ['title' => 'Kebutuhan programmer', 'body' => 'Rekrut satu programmer tambahan untuk RuangKerja tahap 2.'],
            ['title' => 'Kesiapan peluncuran Q4', 'body' => 'Anggaran vendor video disetujui dengan batas 10% di atas rencana.'],
        ], [
            'Materi tender dikirim paling lambat Jumat pukul 13.00.',
            'Rekrutmen programmer dibuka bulan ini.',
        ], [
            ['Kirim materi tender Kominfo', 'putri', 4],
            ['Buka lowongan programmer', 'hana', -2],
            ['Finalkan harga tender', 'agus', -4, null, true],
        ]);
    }

    /** RuangKerja sprint review (leadership) on Thursday, no minutes yet. */
    private function sprintReview(): void
    {
        $this->meeting('yudi', [
            'title' => 'Sprint review RuangKerja',
            'day' => 3, 'start' => '14:00', 'minutes' => 60,
            'platform' => MeetingPlatform::Meet, 'join_url' => 'https://meet.google.com/prg-rkja-rvw',
            'minute_taker' => 'arif', 'leadership' => true,
            'agenda' => ['Demo fitur rapat & kalender', 'Rencana sprint berikutnya'],
        ], ['arif' => Rsvp::Yes, 'hendra' => Rsvp::Yes, 'dimas' => Rsvp::Pending]);
    }

    /**
     * @param  array<string, mixed>  $spec
     * @param  array<string, Rsvp>  $participants
     */
    private function meeting(string $organizer, array $spec, array $participants): Meeting
    {
        $start = CarbonImmutable::parse($this->date((int) $spec['day']).' '.$spec['start'], $this->timezone);
        $owner = $this->people[$organizer];

        $meeting = Meeting::query()->create([
            'company_id' => $owner->company_id,
            'organizer_id' => $owner->id,
            'title' => $spec['title'],
            'starts_at' => $start->utc(),
            'ends_at' => $start->addMinutes((int) $spec['minutes'])->utc(),
            'platform' => $spec['platform'],
            'location' => $spec['location'] ?? null,
            'join_url' => $spec['join_url'] ?? null,
            'minute_taker_id' => isset($spec['minute_taker']) ? $this->people[$spec['minute_taker']]->id : null,
            'workspace_id' => ($spec['workspace'] ?? null)?->id,
            'agenda' => $spec['agenda'],
            'recurrence' => $spec['recurrence'] ?? Recurrence::None,
            'reminders' => [15, 5],
            'leadership' => $spec['leadership'] ?? false,
        ]);

        MeetingParticipant::query()->create(['meeting_id' => $meeting->id, 'user_id' => $owner->id, 'rsvp' => Rsvp::Yes, 'responded_at' => now()]);

        foreach ($participants as $persona => $rsvp) {
            MeetingParticipant::query()->create([
                'meeting_id' => $meeting->id,
                'user_id' => $this->people[$persona]->id,
                'rsvp' => $rsvp,
                'responded_at' => $rsvp === Rsvp::Pending ? null : now(),
            ]);
        }

        foreach ($spec['guests'] ?? [] as $email) {
            MeetingParticipant::query()->create(['meeting_id' => $meeting->id, 'email' => $email]);
        }

        return $meeting;
    }

    /**
     * Minutes of one occurrence.
     *
     * @param  list<array{user_id: string, present: bool, reason?: string}>  $attendance
     * @param  list<array{title: string, body: string}>  $sections
     * @param  list<string>  $decisions
     * @param  list<array{0: string, 1: string, 2: int, 3?: Task|null, 4?: bool}>  $items  [text, persona, due day offset, task, done]
     */
    private function minutes(Meeting $meeting, string $date, MinutesStatus $status, array $attendance, array $sections, array $decisions, array $items): void
    {
        $author = $meeting->minute_taker_id ?? $meeting->organizer_id;
        $minutes = MeetingMinutes::query()->create([
            'meeting_id' => $meeting->id,
            'occurrence_date' => $date,
            'status' => $status,
            'attendance' => $attendance,
            'sections' => $sections,
            'decisions' => $decisions,
            'version' => $status === MinutesStatus::Final ? 3 : 2,
            'updated_by' => $author,
            'finalized_at' => $status === MinutesStatus::Final ? CarbonImmutable::parse($date.' 12:00', $this->timezone)->utc() : null,
            'finalized_by' => $status === MinutesStatus::Final ? $author : null,
        ]);

        foreach (range(1, $minutes->version) as $ignored) {
            MeetingMinuteVersion::query()->create(['minutes_id' => $minutes->id, 'content' => $minutes->content(), 'created_by' => $author]);
        }

        foreach ($items as $position => $item) {
            MeetingActionItem::query()->create([
                'minutes_id' => $minutes->id,
                'position' => $position + 1,
                'text' => $item[0],
                'assignee_id' => $this->people[$item[1]]->id,
                'due_date' => $this->date($item[2]),
                'task_id' => ($item[3] ?? null)?->id,
                'done_at' => ($item[4] ?? false) ? now() : null,
            ]);
        }
    }

    /**
     * @param  list<string>  $present
     * @param  array<string, string>  $absent  persona => reason
     * @return list<array{user_id: string, present: bool, reason?: string}>
     */
    private function attendance(array $present, array $absent): array
    {
        return array_map(fn (string $persona): array => isset($absent[$persona])
            ? ['user_id' => $this->people[$persona]->id, 'present' => false, 'reason' => $absent[$persona]]
            : ['user_id' => $this->people[$persona]->id, 'present' => true], $present);
    }

    /** Office date `$offset` days after this week's Monday. */
    private function date(int $offset): string
    {
        return $this->monday->addDays($offset)->toDateString();
    }
}
