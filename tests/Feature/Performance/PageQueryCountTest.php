<?php

use App\Models\Channel;
use App\Models\DailyReport;
use App\Models\DailyReportItem;
use App\Models\EmployeeRequest;
use App\Models\Task;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Tests\Support\PerformanceFixtures as P;

/*
 * Sprint 10 N+1 sweep — query-count regression tests for every main page.
 *
 * Each group seeds the demo data, multiplies the listed rows (P::grow), counts
 * the queries of each page (visit + deferred props), multiplies the rows again
 * and counts once more:
 *   1. the count must not grow with the data (no N+1), and
 *   2. it must stay within the page's budget (measured + small headroom; a
 *      deliberate new query raises the budget in the same commit).
 * The shared Inertia props (sidebar, badges, shell check-in status) are ~18
 * queries of every count. Run with QUERY_COUNTS=1 to print the measured values.
 */

beforeEach(function () {
    // Fixed weekday: schedules, "today" lists and budgets do not depend on the run date.
    $this->travelTo(CarbonImmutable::parse('2026-10-07 09:00', 'Asia/Jakarta'));
    P::seed();
    P::grow();
});

/**
 * @param  array<string, array{0: string, 1: int}>  $pages  label => [who, budget]; label is the URL
 */
function assertQueryBudgets(array $pages): void
{
    $first = [];

    foreach ($pages as $url => [$who]) {
        // Warm-up visit: one-time work (default settings rows, Drive sync jobs
        // that run inline with the sync queue in tests) is not part of the page.
        P::queries($who, $url);
        $first[$url] = P::queries($who, $url);
    }

    P::grow(2);
    $failures = [];

    foreach ($pages as $url => [$who, $budget]) {
        $second = P::queries($who, $url);

        if (getenv('QUERY_COUNTS')) {
            fwrite(STDERR, sprintf("QUERIES %-8s %-50s %3d -> %3d (budget %d)\n", $who, $url, $first[$url], $second, $budget));
        }

        if ($second > $first[$url]) {
            $failures[] = "{$who} {$url}: {$first[$url]} → {$second} queries after adding rows (N+1)";
        }

        if ($first[$url] > $budget) {
            $failures[] = "{$who} {$url}: {$first[$url]} queries, budget {$budget}";
        }
    }

    expect($failures)->toBe([]);
}

it('keeps the dashboards and the portfolio free of N+1', function () {
    assertQueryBudgets([
        '/dashboard' => ['anggota', 72],
        '/dashboard/saya' => ['kadiv', 68],
        '/ruang-saya' => ['anggota', 14],
        // +3: "Laporan tim hari ini" (schedules, reports, sent items) — keputusan pemilik 6 Okt 2026.
        '/dashboard/divisi' => ['kadiv', 83],
        // −26: attendance lists and the recap moved to Absensi (keputusan pemilik 6 Okt 2026).
        '/dashboard/hr' => ['hr', 52],
        '/portofolio' => ['direksi', 41],
    ]);
});

/**
 * Daily reports with items for $count more people this week (work
 * monitoring), on project and personal tasks and free work.
 */
function growDailyReports(int $round): void
{
    $monday = CarbonImmutable::now('Asia/Jakarta')->startOfWeek();
    $tasks = Task::query()->orderBy('id')->limit(30)->pluck('id')->all();
    $people = User::query()->where('status', 'active')->orderBy('email')->offset(($round - 1) * 15)->limit(15)->get();

    foreach ($people as $index => $user) {
        foreach ([0, 1, 2] as $day) {
            $report = DailyReport::query()->firstOrCreate(
                ['user_id' => $user->id, 'report_date' => $monday->addDays($day)->toDateString()],
                ['company_id' => $user->company_id, 'summary' => 'Laporan uji', 'blockers' => $index % 3 === 0 ? 'Menunggu data' : null, 'submitted_at' => $index % 4 === 0 ? null : now()],
            );

            foreach ([0, 1] as $position) {
                DailyReportItem::query()->create([
                    'daily_report_id' => $report->id,
                    'task_id' => $tasks[($index + $day + $position) % max(1, count($tasks))] ?? null,
                    'task_key' => 'UJI-'.($index + $position),
                    'progress_note' => 'Progres',
                    'percent' => 40,
                    'hours' => 1.5,
                    'position' => $position,
                ]);
            }
        }
    }
}

it('keeps the Direksi, HR and management dashboards and Absensi tabs free of N+1 (keputusan pemilik 6 Okt 2026)', function () {
    $pages = [
        '/dashboard' => ['direksi', 64],
        '/dashboard/direksi?tanggal=2026-10-06' => ['direksi', 64],
        '/dashboard/hr' => ['hr', 52],
        '/dashboard/divisi' => ['kadiv', 85],
        '/manajemen' => ['direksi', 69],
        '/absensi/hari-ini' => ['hr', 55],
        '/absensi/kedisiplinan' => ['hr', 55],
    ];
    growDailyReports(1);
    $first = [];

    foreach ($pages as $url => [$who]) {
        P::queries($who, $url);
        $first[$url] = P::queries($who, $url);
    }

    P::grow(2);
    growDailyReports(2);
    $failures = [];

    foreach ($pages as $url => [$who, $budget]) {
        $second = P::queries($who, $url);

        if (getenv('QUERY_COUNTS')) {
            fwrite(STDERR, sprintf("QUERIES %-8s %-50s %3d -> %3d (budget %d)\n", $who, $url, $first[$url], $second, $budget));
        }

        if ($second > $first[$url]) {
            $failures[] = "{$who} {$url}: {$first[$url]} → {$second} queries after adding rows (N+1)";
        }

        if ($first[$url] > $budget) {
            $failures[] = "{$who} {$url}: {$first[$url]} queries, budget {$budget}";
        }
    }

    expect($failures)->toBe([])
        ->and(DailyReport::query()->count())->toBeGreaterThan(60);
});

it('keeps the attendance pages free of N+1', function () {
    assertQueryBudgets([
        '/absensi' => ['anggota', 74],
        '/absensi/riwayat' => ['anggota', 44],
        // +1: shared prop chatUnread (Obrolan Dock badge), one query on every page.
        '/absensi/hari-ini' => ['hr', 53],
        '/absensi/rekap' => ['hr', 46],
        '/admin/absensi' => ['hr', 41],
        '/admin/absensi/penugasan' => ['hr', 36],
    ]);
});

it('keeps requests and approvals free of N+1', function () {
    $request = EmployeeRequest::query()->whereNotNull('number')->orderBy('created_at')->firstOrFail();

    assertQueryBudgets([
        '/pengajuan' => ['anggota', 47],
        '/pengajuan/baru' => ['anggota', 33],
        "/pengajuan/{$request->id}" => ['hr', 40],
        '/persetujuan' => ['kadiv', 60], // +2: shared prop chatUnread (one query) and its visible-channel subquery
        "/persetujuan/{$request->id}" => ['hr', 41],
        '/admin/pengajuan' => ['hr', 40],
        '/admin/saldo-cuti' => ['hr', 35],
    ]);
});

it('keeps workspaces, boards and my tasks free of N+1', function () {
    $project = Workspace::query()->where('type', 'project')->orderBy('key')->firstOrFail();

    assertQueryBudgets([
        '/workspace' => ['kadiv', 35],
        '/w/OPS' => ['kadiv', 53],
        '/w/OPS?view=list' => ['kadiv', 53],
        '/w/OPS?view=calendar' => ['kadiv', 53],
        '/w/OPS/dokumen' => ['kadiv', 60],
        '/w/OPS/file' => ['kadiv', 61],
        '/w/OPS/aktivitas' => ['kadiv', 49],
        '/w/OPS/pengaturan' => ['kadiv', 56],
        "/w/{$project->key}/ringkasan" => ['direksi', 59],
        '/tugas' => ['anggota', 40],
    ]);
});

it('keeps inbox, search, settings and the menu free of N+1', function () {
    assertQueryBudgets([
        '/inbox' => ['hr', 33],
        '/inbox/feed' => ['anggota', 12],
        '/cari/hasil?q=la' => ['anggota', 22],
        // +3 when the seeded user happens to have a task due today: the digest
        // preview's "Tenggat hari ini" section (list, workspaces, count) only
        // queries when it has rows. Constant, not N+1.
        // +4 since F2-1: shared prop chatUnread and the chat.message preference row.
        '/pengaturan/notifikasi' => ['anggota', 49],
        '/menu' => ['anggota', 29],
    ]);
});

it('keeps the admin and organization pages free of N+1', function () {
    $employee = P::user('anggota');

    assertQueryBudgets([
        '/admin/karyawan' => ['hr', 45],
        "/admin/karyawan/{$employee->id}" => ['hr', 41],
        '/admin/organisasi/divisi' => ['hr', 38],
        '/admin/organisasi/tim' => ['hr', 39],
        '/admin/organisasi/jabatan' => ['hr', 37],
        '/admin/audit' => ['admin', 29],
        '/organisasi/struktur' => ['anggota', 36],
    ]);
});

it('keeps Data Saya free of N+1', function () {
    assertQueryBudgets([
        '/privasi' => ['kadiv', 66],
    ]);
});

it('keeps Obrolan free of N+1', function () {
    config(['features.chat' => true]);
    $plq = Channel::query()->where('type', 'workspace')
        ->whereIn('workspace_id', Workspace::query()->where('key', 'PLQ')->select('id'))
        ->firstOrFail();

    assertQueryBudgets([
        '/obrolan' => ['kadiv', 36],
        "/obrolan/{$plq->id}" => ['kadiv', 50],
        "/obrolan/{$plq->id}/pesan" => ['kadiv', 18],
    ]);
});
