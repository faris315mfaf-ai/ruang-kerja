<?php

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\Process\Process;

/*
 * Numbering under real concurrency. RefreshDatabase keeps the default
 * connection inside an uncommitted transaction, so the fixtures are written
 * through a second, auto-committing connection to the same test database and
 * removed again afterwards.
 */

beforeEach(function () {
    config(['database.connections.committed' => config('database.connections.'.config('database.default'))]);
    $this->db = DB::connection('committed');

    $now = now();
    $this->companyId = strtolower((string) Str::ulid());
    $this->userId = strtolower((string) Str::ulid());
    $this->workspaceId = strtolower((string) Str::ulid());

    $this->db->table('companies')->insert([
        'id' => $this->companyId, 'name' => 'PT Paralel', 'google_domain' => 'paralel-'.Str::lower(Str::random(8)).'.test',
        'timezone' => 'Asia/Jakarta', 'settings' => '{}', 'created_at' => $now, 'updated_at' => $now,
    ]);
    $this->db->table('users')->insert([
        'id' => $this->userId, 'company_id' => $this->companyId, 'name' => 'Penguji Paralel',
        'email' => 'paralel-'.Str::lower(Str::random(8)).'@example.test', 'created_at' => $now, 'updated_at' => $now,
    ]);
    $this->db->table('workspaces')->insert([
        'id' => $this->workspaceId, 'company_id' => $this->companyId, 'type' => 'project', 'name' => 'Proyek Paralel',
        'key' => 'PAR'.Str::upper(Str::random(3)), 'visibility' => 'private', 'owner_id' => $this->userId,
        'task_sequence' => 0, 'created_at' => $now, 'updated_at' => $now,
    ]);
    $this->db->table('workspace_members')->insert([
        'workspace_id' => $this->workspaceId, 'user_id' => $this->userId, 'role' => 'owner',
        'joined_at' => $now, 'created_at' => $now, 'updated_at' => $now,
    ]);
    $this->db->table('task_statuses')->insert([
        'id' => strtolower((string) Str::ulid()), 'workspace_id' => $this->workspaceId, 'name' => 'Todo',
        'category' => 'todo', 'color' => 'slate', 'position' => 'V', 'created_at' => $now, 'updated_at' => $now,
    ]);
});

afterEach(function () {
    $taskIds = $this->db->table('tasks')->where('workspace_id', $this->workspaceId)->pluck('id');
    $this->db->table('task_watchers')->whereIn('task_id', $taskIds)->delete();
    $this->db->table('activities')->where('workspace_id', $this->workspaceId)->delete();
    $this->db->table('tasks')->where('workspace_id', $this->workspaceId)->delete();
    $this->db->table('task_statuses')->where('workspace_id', $this->workspaceId)->delete();
    $this->db->table('workspace_members')->where('workspace_id', $this->workspaceId)->delete();
    $this->db->table('workspaces')->where('id', $this->workspaceId)->delete();
    $this->db->table('users')->where('id', $this->userId)->delete();
    $this->db->table('companies')->where('id', $this->companyId)->delete();
    DB::purge('committed');
});

it('gives unique, gap-free numbers when several processes create tasks at once', function () {
    $processes = 4;
    $perProcess = 12;
    $env = [
        'APP_ENV' => 'testing',
        'DB_CONNECTION' => config('database.default'),
        'DB_DATABASE' => config('database.connections.'.config('database.default').'.database'),
        'BROADCAST_CONNECTION' => 'null',
        'QUEUE_CONNECTION' => 'sync',
        'CACHE_STORE' => 'array',
        'SESSION_DRIVER' => 'array',
        'PULSE_ENABLED' => 'false',
    ];

    $running = [];

    for ($i = 0; $i < $processes; $i++) {
        $process = new Process([PHP_BINARY, base_path('tests/Support/create-tasks.php'), $this->workspaceId, $this->userId, (string) $perProcess], base_path(), $env, null, 120);
        $process->start();
        $running[] = $process;
    }

    foreach ($running as $process) {
        $process->wait();
        expect($process->isSuccessful())->toBeTrue($process->getErrorOutput().$process->getOutput());
    }

    $numbers = $this->db->table('tasks')->where('workspace_id', $this->workspaceId)->orderBy('number')->pluck('number')->map(fn ($n) => (int) $n)->all();
    $total = $processes * $perProcess;

    expect($numbers)->toBe(range(1, $total))
        ->and((int) $this->db->table('workspaces')->where('id', $this->workspaceId)->value('task_sequence'))->toBe($total);
});

it('holds a row lock on the workspace until the numbering transaction commits', function () {
    config(['database.connections.second' => config('database.connections.committed')]);
    $second = DB::connection('second');

    $this->db->beginTransaction();

    try {
        $this->db->selectOne('UPDATE workspaces SET task_sequence = task_sequence + 1 WHERE id = ? RETURNING task_sequence', [$this->workspaceId]);

        expect(fn () => $second->select('SELECT id FROM workspaces WHERE id = ? FOR UPDATE NOWAIT', [$this->workspaceId]))
            ->toThrow(QueryException::class);
    } finally {
        $this->db->rollBack();
        DB::purge('second');
    }
});
