<?php

use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Actions\MoveTask;
use App\Domain\Tasks\Actions\ToggleTaskWatch;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Models\Label;
use App\Models\Task;
use App\Models\TaskPlan;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — B3-A1 "Tugas saya": scopes (ditugaskan · saya-amati · saya-buat),
| filters, sorting, stable pages, per-scope counts, header summary and the
| per-row hints (group, planner lane). "Today" is Tuesday 13 Oct 2026.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(CarbonImmutable::parse('2026-10-13 09:00', 'Asia/Jakarta'));

    $this->sari = User::factory()->create(['name' => 'Sari Staf']);
    $this->dimas = User::factory()->create(['name' => 'Dimas Pemimpin']);
    $this->maya = User::factory()->create(['name' => 'Maya Rekan']);
    $this->stranger = User::factory()->create(['name' => 'Orang Luar']);

    $this->personal = app(EnsurePersonalWorkspace::class)->handle($this->sari);
    $this->tms = Workspace::factory()->team()->ownedBy($this->dimas)->create(['key' => 'TMS', 'name' => 'Tim Sendiri']);
    $this->ops = Workspace::factory()->team()->ownedBy($this->dimas)->create(['key' => 'OPS', 'name' => 'Operasional']);
    foreach ([$this->tms, $this->ops] as $workspace) {
        addMember($workspace, $this->sari);
        addMember($workspace, $this->maya);
    }

    $this->bug = Label::factory()->create(['workspace_id' => $this->tms->id, 'name' => 'Bug', 'color' => 'red']);

    $make = fn (Workspace $ws, User $by, array $input): Task => app(CreateTask::class)->handle($ws, $by, $input);

    $this->late = $make($this->tms, $this->dimas, ['title' => 'Revisi laporan', 'due_date' => '2026-10-12', 'priority' => 1, 'assignee_ids' => [$this->sari->id], 'label_ids' => [$this->bug->id]]);
    $this->today = $make($this->tms, $this->dimas, ['title' => 'Kirim invoice', 'due_date' => '2026-10-13', 'priority' => 3, 'assignee_ids' => [$this->sari->id]]);
    $this->week = $make($this->ops, $this->dimas, ['title' => 'Cek gudang', 'due_date' => '2026-10-16', 'priority' => 2, 'assignee_ids' => [$this->sari->id]]);
    $this->later = $make($this->ops, $this->dimas, ['title' => 'Rencana kuartal', 'due_date' => '2026-10-20', 'assignee_ids' => [$this->sari->id]]);
    $this->undated = $make($this->tms, $this->dimas, ['title' => 'Rapikan arsip', 'assignee_ids' => [$this->sari->id]]);
    $this->created = $make($this->tms, $this->sari, ['title' => 'Titip ke Maya', 'due_date' => '2026-10-14', 'assignee_ids' => [$this->maya->id]]);
    $this->watched = $make($this->tms, $this->dimas, ['title' => 'Pantauan Sari', 'due_date' => '2026-10-15']);
    app(ToggleTaskWatch::class)->handle($this->watched, $this->sari, true);
    $this->done = $make($this->tms, $this->dimas, ['title' => 'Sudah beres', 'assignee_ids' => [$this->sari->id]]);
    app(MoveTask::class)->handle($this->done, $this->dimas, statusOf($this->tms, 'done'));
    $this->private = $make(app(EnsurePersonalWorkspace::class)->handle($this->stranger), $this->stranger, ['title' => 'Rahasia orang luar', 'assignee_ids' => [$this->stranger->id]]);

    Sanctum::actingAs($this->sari);
});

/** @return list<string> */
function titelTugas(array $rows): array
{
    return array_values(array_map(fn (array $row): string => $row['title'], $rows));
}

test('the assigned scope lists open and this weeks completed tasks, due date first with nulls last', function () {
    $response = $this->getJson('/api/v1/tugas?scope=ditugaskan')->assertOk();

    expect(titelTugas($response->json('tasks')))->toBe([
        'Revisi laporan', 'Kirim invoice', 'Cek gudang', 'Rencana kuartal', 'Rapikan arsip', 'Sudah beres',
    ])->and($response->json('meta.scope'))->toBe('ditugaskan');
});

test('the old saya flag still means assigned and a plain call stays the visible list', function () {
    expect(titelTugas($this->getJson('/api/v1/tugas?saya=1')->assertOk()->json('tasks')))->toContain('Revisi laporan')->not->toContain('Titip ke Maya');

    $all = titelTugas($this->getJson('/api/v1/tugas')->assertOk()->json('tasks'));
    expect($all)->toContain('Titip ke Maya', 'Pantauan Sari')->not->toContain('Rahasia orang luar');
});

test('watching and created scopes follow MyTasks', function () {
    // The creator of a task follows it (CreateTask), so Sari watches her own "Titip ke Maya" too.
    expect(titelTugas($this->getJson('/api/v1/tugas?scope=saya-amati')->assertOk()->json('tasks')))->toBe(['Titip ke Maya', 'Pantauan Sari']);

    expect(titelTugas($this->getJson('/api/v1/tugas?scope=saya-buat')->assertOk()->json('tasks')))->toBe(['Titip ke Maya']);
});

test('meta carries the per-scope counts and the header summary of the scope', function () {
    $this->getJson('/api/v1/tugas?scope=ditugaskan')->assertOk()
        ->assertJsonPath('meta.counts', ['ditugaskan' => 5, 'saya-amati' => 2, 'saya-buat' => 1])
        ->assertJsonPath('meta.summary', ['aktif' => 5, 'terlambat' => 1, 'hari_ini' => 1])
        ->assertJsonPath('meta.today', '2026-10-13');

    // The header ignores the chips: filtering changes the rows, not the summary.
    $this->getJson('/api/v1/tugas?scope=ditugaskan&workspace=OPS')->assertOk()
        ->assertJsonPath('meta.total', 2)
        ->assertJsonPath('meta.summary.aktif', 5);
});

test('every row carries its due-date group and the callers planner lane', function () {
    TaskPlan::factory()->create(['user_id' => $this->sari->id, 'task_id' => $this->later->id, 'bucket' => 'today', 'planned_for' => '2026-10-13', 'position' => 'a']);

    $rows = collect($this->getJson('/api/v1/tugas?scope=ditugaskan')->assertOk()->json('tasks'))->keyBy('title');

    expect($rows['Revisi laporan']['group'])->toBe('terlambat')
        ->and($rows['Revisi laporan']['days_late'])->toBe(1)
        ->and($rows['Kirim invoice']['group'])->toBe('hari-ini')
        ->and($rows['Cek gudang']['group'])->toBe('minggu-ini')
        ->and($rows['Rencana kuartal']['group'])->toBe('nanti')
        ->and($rows['Rapikan arsip']['group'])->toBe('tanpa-tenggat')
        ->and($rows['Sudah beres']['group'])->toBe('selesai')
        ->and($rows['Rencana kuartal']['plan'])->toBe(['bucket' => 'today', 'lane' => 'today'])
        ->and($rows['Cek gudang']['plan'])->toBe(['bucket' => null, 'lane' => 'week'])
        ->and($rows['Revisi laporan']['labels'])->toBe([['id' => $this->bug->id, 'name' => 'Bug', 'color' => 'red']])
        ->and($rows['Revisi laporan']['workspace'])->toMatchArray(['key' => 'TMS', 'type' => 'team'])
        ->and($rows['Revisi laporan']['assignee_people'][0])->toMatchArray(['id' => $this->sari->id, 'name' => 'Sari Staf']);
});

test('filters narrow the list: workspace, priority, status, label, due, range and q', function () {
    $titles = fn (string $query): array => titelTugas($this->getJson("/api/v1/tugas?scope=ditugaskan&{$query}")->assertOk()->json('tasks'));

    expect($titles('workspace[]=OPS'))->toBe(['Cek gudang', 'Rencana kuartal'])
        ->and($titles('workspace='.$this->tms->id.','.$this->ops->key))->toHaveCount(6)
        ->and($titles('prioritas[]=1&prioritas[]=2'))->toBe(['Revisi laporan', 'Cek gudang'])
        ->and($titles('prioritas=3'))->toBe(['Kirim invoice'])
        ->and($titles('status[]=done'))->toBe(['Sudah beres'])
        ->and($titles('label[]='.$this->bug->id))->toBe(['Revisi laporan'])
        ->and($titles('tenggat=overdue'))->toBe(['Revisi laporan'])
        ->and($titles('tenggat=today'))->toBe(['Kirim invoice'])
        ->and($titles('tenggat=week'))->toBe(['Kirim invoice', 'Cek gudang'])
        ->and($titles('tenggat=none'))->toBe(['Rapikan arsip', 'Sudah beres'])
        ->and($titles('tenggat_dari=2026-10-14&tenggat_sampai=2026-10-20'))->toBe(['Cek gudang', 'Rencana kuartal'])
        ->and($titles('q=invoice'))->toBe(['Kirim invoice'])
        ->and($titles('q=TMS-'.$this->late->number))->toBe(['Revisi laporan'])
        ->and($titles('penanggung=saya'))->toHaveCount(6)
        ->and($titles('penanggung[]='.$this->maya->id))->toBe([])
        ->and($titles('selesai=tidak'))->not->toContain('Sudah beres');
});

test('a filter can never reach a workspace the caller may not see', function () {
    $other = Workspace::query()->where('type', 'personal')->where('owner_id', $this->stranger->id)->firstOrFail();

    $this->getJson('/api/v1/tugas?workspace[]='.$other->key.'&workspace[]='.$other->id)->assertOk()->assertJsonPath('meta.total', 0);
    $this->getJson('/api/v1/tugas?q=Rahasia')->assertOk()->assertJsonPath('meta.total', 0);
});

test('sorting by priority puts urgent first and none last, descending flips the due date', function () {
    expect(titelTugas($this->getJson('/api/v1/tugas?scope=ditugaskan&urut=prioritas')->assertOk()->json('tasks')))
        ->toBe(['Revisi laporan', 'Cek gudang', 'Kirim invoice', 'Rencana kuartal', 'Rapikan arsip', 'Sudah beres']);

    $desc = titelTugas($this->getJson('/api/v1/tugas?scope=ditugaskan&urut=tenggat&arah=desc')->assertOk()->json('tasks'));
    expect(array_slice($desc, 0, 4))->toBe(['Rencana kuartal', 'Cek gudang', 'Kirim invoice', 'Revisi laporan']);

    expect(titelTugas($this->getJson('/api/v1/tugas?scope=ditugaskan&urut=judul')->assertOk()->json('tasks'))[0])->toBe('Cek gudang');
});

test('pages are stable: no task repeats or is skipped, even with equal due dates', function () {
    // Five tasks with the same due date and priority force the id tiebreak.
    foreach (range(1, 5) as $n) {
        app(CreateTask::class)->handle($this->tms, $this->dimas, ['title' => "Kembar {$n}", 'due_date' => '2026-10-30', 'priority' => 2, 'assignee_ids' => [$this->sari->id]]);
    }

    $everything = collect($this->getJson('/api/v1/tugas?scope=ditugaskan&per_page=50')->assertOk()->json('tasks'))->pluck('id')->all();
    $paged = [];

    foreach ([1, 2, 3, 4] as $page) {
        $response = $this->getJson("/api/v1/tugas?scope=ditugaskan&per_page=3&page={$page}")->assertOk();
        $paged = [...$paged, ...collect($response->json('tasks'))->pluck('id')->all()];
    }

    expect($paged)->toBe($everything)->and(array_unique($paged))->toHaveCount(count($paged));
});

test('bad query values are rejected in Indonesian', function () {
    $this->getJson('/api/v1/tugas?scope=semua')->assertUnprocessable()->assertJsonValidationErrors('scope');
    $this->getJson('/api/v1/tugas?prioritas[]=9')->assertUnprocessable()->assertJsonValidationErrors('prioritas.0');
    $this->getJson('/api/v1/tugas?per_page=500')->assertUnprocessable()->assertJsonPath('errors.per_page.0', 'per_page harus antara 1 dan 50.');
    $this->getJson('/api/v1/tugas?tenggat_dari=besok')->assertUnprocessable()->assertJsonValidationErrors('tenggat_dari');
});

test('the list needs a token', function () {
    app('auth')->forgetGuards();
    $this->getJson('/api/v1/tugas')->assertUnauthorized();
});
