<?php

namespace Database\Seeders;

use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Domain\Reports\Support\ReportDay;
use App\Models\Announcement;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\Task;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;

/**
 * Demo of the 6 Oct 2026 owner decisions (local/testing only, idempotent,
 * no notifications): sent daily reports of the last working days for a few
 * staff members (a draft today for the programmer; the member has not
 * reported yet today) and two announcements (HR to everyone, the Kepala
 * Divisi to Operasional).
 */
class StaffDemoSeeder extends Seeder
{
    /** @var list<string> */
    private const array REPORTERS = ['anggota@demo.test', 'programmer@demo.test', 'maya.lestari@demo.test'];

    public function run(): void
    {
        $this->reports();
        $this->announcements();
    }

    private function reports(): void
    {
        $today = CarbonImmutable::parse(ReportDay::today(), config()->string('app.office_timezone'));
        $days = [];

        for ($date = $today->subDay(); count($days) < 3; $date = $date->subDay()) {
            if (! $date->isWeekend()) {
                $days[] = $date;
            }
        }

        foreach (self::REPORTERS as $email) {
            $user = User::query()->where('email', $email)->first();

            if ($user === null || DailyReport::query()->where('user_id', $user->id)->exists()) {
                continue;
            }

            $tasks = Task::query()
                ->whereHas('assignees', fn ($query) => $query->whereKey($user->id))
                ->with('workspace')
                ->orderBy('created_at')
                ->limit(4)
                ->get();

            foreach ($days as $index => $day) {
                $this->report($user, $day, $tasks->slice($index % max(1, $tasks->count()), 2)->values()->all(), true, $index);
            }

            if ($email === 'programmer@demo.test') {
                $this->report($user, $today, $tasks->take(1)->all(), false, 3);
            }
        }
    }

    /**
     * @param  list<Task>  $tasks
     */
    private function report(User $user, CarbonImmutable $day, array $tasks, bool $sent, int $variant): void
    {
        $notes = [
            'Menyelesaikan bagian utama dan meninjau ulang hasilnya.',
            'Melanjutkan pekerjaan kemarin, menunggu masukan dari tim.',
            'Merapikan data dan menyiapkan bahan untuk rapat.',
            'Memperbaiki temuan dari tinjauan sebelumnya.',
        ];

        $report = DailyReport::query()->create([
            'company_id' => $user->company_id,
            'user_id' => $user->id,
            'report_date' => $day->toDateString(),
            'summary' => $sent ? 'Pekerjaan utama berjalan sesuai rencana.' : null,
            'blockers' => $variant === 1 ? 'Data cabang belum lengkap, sudah diminta ke tim gudang.' : null,
            'notes' => $variant === 0 ? "Rapat pagi:\n- Prioritas minggu ini dibahas\n- Tenggat laporan stok Jumat" : null,
            'submitted_at' => $sent ? $day->setTime(16, 40 + $variant)->utc() : null,
        ]);

        foreach (array_values($tasks) as $position => $task) {
            DailyReportItem::query()->create([
                'daily_report_id' => $report->id,
                'task_id' => $task->id,
                'task_key' => $task->displayKey(),
                'task_title' => $task->title,
                'progress_note' => $notes[($variant + $position) % count($notes)],
                'percent' => [40, 60, 80, 100][($variant + $position) % 4],
                'hours' => [2, 3, 1.5, 2.5][($variant + $position) % 4],
                'position' => $position,
            ]);
        }

        DailyReportItem::query()->create([
            'daily_report_id' => $report->id,
            'progress_note' => 'Membantu rekan menyiapkan dokumen rapat.',
            'hours' => 1,
            'position' => count($tasks),
        ]);
    }

    private function announcements(): void
    {
        if (Announcement::withTrashed()->exists()) {
            return;
        }

        $hr = User::query()->where('email', 'hr@demo.test')->first();
        $kadiv = User::query()->where('email', 'kadiv@demo.test')->first();

        if ($hr !== null) {
            Announcement::query()->create([
                'company_id' => $hr->company_id,
                'author_id' => $hr->id,
                'title' => 'Laporan progres harian mulai berlaku',
                'body' => "Mulai pekan ini setiap karyawan menulis laporan progres harian di RuangKerja sebelum pulang.\nCukup pilih tugas yang dikerjakan dan tulis catatan singkat.",
                'audience' => AnnouncementAudience::All,
                'target_ids' => [],
                'published_at' => now()->subHours(3),
            ]);
        }

        if ($kadiv !== null && $kadiv->division_id !== null) {
            Announcement::query()->create([
                'company_id' => $kadiv->company_id,
                'author_id' => $kadiv->id,
                'title' => 'Stok opname gudang Jumat',
                'body' => 'Semua anggota Operasional ikut stok opname hari Jumat mulai pukul 08.00 di gudang utama.',
                'audience' => AnnouncementAudience::Division,
                'target_ids' => [$kadiv->division_id],
                'published_at' => now()->subHour(),
                'expires_at' => now()->addDays(7),
            ]);
        }
    }
}
