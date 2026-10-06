<?php

use App\Models\Channel;
use App\Models\EmployeeRequest;
use App\Models\Meeting;
use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingParticipant;
use App\Models\Note;
use App\Models\NoteShare;
use App\Models\NoteVersion;
use App\Models\Objective;
use App\Models\PasswordResetRequest;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
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
        '/dashboard/divisi' => ['kadiv', 80],
        '/dashboard/hr' => ['hr', 76],
        '/portofolio' => ['direksi', 41],
    ]);
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
        // Staff get a 404 here since 6 Oct 2026 (keputusan pemilik).
        '/organisasi/struktur' => ['kadiv', 36],
        // Akun & kata sandi (6 Okt 2026): own password page for every role.
        '/settings/security' => ['anggota', 30],
    ]);
});

it('keeps the "Lupa kata sandi" requests on Admin › Karyawan free of N+1', function () {
    $hr = P::user('hr');
    $make = function (int $count) use ($hr): void {
        foreach (range(1, $count) as $i) {
            $employee = User::factory()->forCompany($hr->company)->create();
            PasswordResetRequest::query()->create([
                'company_id' => $hr->company_id,
                'user_id' => $employee->id,
                'email' => $employee->email,
                'request_token_hash' => hash('sha256', $employee->id),
                'expires_at' => now()->addDay(),
            ]);
        }
    };

    $make(1);
    P::queries('hr', '/admin/karyawan');
    $one = P::queries('hr', '/admin/karyawan');

    $make(5);
    $six = P::queries('hr', '/admin/karyawan');

    expect($six)->toBeLessThanOrEqual($one);
});

it('keeps Data Saya free of N+1', function () {
    assertQueryBudgets([
        '/privasi' => ['kadiv', 66],
    ]);
});

it('keeps Otomasi and Kinerja saya free of N+1', function () {
    config(['features.automation' => true]);

    assertQueryBudgets([
        '/otomasi' => ['kadiv', 40],
        '/otomasi/berulang' => ['kadiv', 38],
        '/otomasi/template' => ['kadiv', 42],
        // Metric blocks are cached per viewer + period (MetricCache).
        '/kinerja' => ['anggota', 44],
        '/kinerja?periode=kuartal' => ['anggota', 44],
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

it('keeps Dashboard per jabatan free of N+1', function () {
    config(['features.role_dashboards' => true]);

    assertQueryBudgets([
        // Visit (flow closure: queue / decisions / one request in full) + deferred dashboard.
        '/peran/dirut' => ['direksi', 58],
        '/peran/direktur' => ['direksi', 65],
        '/peran/hr' => ['hr', 78],
        '/peran/implementer' => ['kadiv', 78],
    ]);
});

it('keeps OKR free of N+1', function () {
    config(['features.okr' => true]);
    $objective = Objective::query()->where('quarter', '2026-Q4')->whereHas('division', fn ($division) => $division->where('code', 'OPS'))->orderBy('created_at')->firstOrFail();

    assertQueryBudgets([
        '/okr' => ['kadiv', 40],
        '/okr?kuartal=2026-Q3' => ['direksi', 30],
        "/okr/{$objective->id}" => ['kadiv', 42],
    ]);
});

it('keeps Catatan free of N+1', function () {
    config(['features.notes' => true, 'collab.secret' => '']);
    $ops = Workspace::query()->where('key', 'OPS')->firstOrFail();
    $note = Note::query()->where('workspace_id', $ops->id)->where('title', 'SOP Penerimaan Barang')->firstOrFail();
    $pages = [
        '/catatan' => ['kadiv', 38],
        '/catatan?q=barang' => ['kadiv', 39],
        "/catatan/{$note->id}" => ['kadiv', 47],
        '/w/OPS/catatan' => ['kadiv', 54],
    ];
    $first = [];

    foreach ($pages as $url => [$who]) {
        P::queries($who, $url);
        $first[$url] = P::queries($who, $url);
    }

    // More notes, folders, authors, shares and versions.
    $authors = User::query()->whereIn('id', WorkspaceMember::query()->where('workspace_id', $ops->id)->select('user_id'))->limit(6)->get();
    $folder = Note::factory()->folder()->in($ops)->by($authors->first())->create(['title' => 'Arsip barang']);

    foreach ($authors as $index => $author) {
        $extra = Note::factory()->in($ops)->by($author)->create(['title' => "Catatan barang {$index}", 'parent_id' => $index % 2 === 0 ? $folder->id : null]);
        NoteShare::factory()->create(['note_id' => $extra->id, 'user_id' => $authors->last()->id, 'role' => 'edit']);
        NoteVersion::factory()->of($extra)->create();
    }

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
});

it('keeps Rapat & Kalender free of N+1', function () {
    config(['features.meetings' => true]);
    $kadiv = P::user('kadiv');
    $standup = Meeting::query()->where('title', 'Stand-up Divisi Operasional')->firstOrFail();
    $draft = MeetingMinutes::query()->where('meeting_id', $standup->id)->where('status', 'draft')->firstOrFail();
    $pages = [
        '/rapat' => ['kadiv', 42],
        '/rapat/baru' => ['kadiv', 36],
        "/rapat/{$standup->id}" => ['kadiv', 38],
        "/rapat/{$standup->id}/notulen?tanggal={$draft->occurrence_date->toDateString()}" => ['kadiv', 39],
        '/kalender' => ['kadiv', 40],
        '/manajemen/jadwal' => ['direksi', 28],
    ];

    // Meetings are not part of P::grow(): add participants, meetings, minutes and follow-ups here.
    $growMeetings = function () use ($kadiv, $standup, $draft): void {
        $today = CarbonImmutable::now('Asia/Jakarta')->toDateString();
        $people = User::factory()->count(5)->create(['company_id' => $kadiv->company_id]);
        Meeting::factory()->count(4)->by($kadiv)->at($today.' 15:00')->withParticipants($people->all())->create();
        Meeting::factory()->count(2)->by(P::user('direksi'))->leadership()->at($today.' 08:00')->withParticipants($people->all())->create();

        foreach ($people as $person) {
            MeetingParticipant::query()->create(['meeting_id' => $standup->id, 'user_id' => $person->id]);
            MeetingActionItem::query()->create(['minutes_id' => $draft->id, 'text' => 'Butir', 'assignee_id' => $person->id, 'due_date' => '2026-10-09']);
            MeetingActionItem::query()->create(['minutes_id' => $draft->id, 'text' => 'Butir saya', 'assignee_id' => $kadiv->id, 'due_date' => '2026-10-09']);
        }
    };

    $first = [];

    foreach ($pages as $url => [$who]) {
        P::queries($who, $url);
        $first[$url] = P::queries($who, $url);
    }

    $growMeetings();
    $growMeetings();
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
});

it('keeps laporan harian and pengumuman free of N+1', function () {
    assertQueryBudgets([
        '/laporan' => ['kadiv', 56],
        '/laporan/hari-ini' => ['anggota', 43],
        '/laporan/tugas?q=la' => ['anggota', 14],
        '/pengumuman' => ['hr', 36],
        '/pengumuman/spanduk' => ['anggota', 10],
    ]);
});
