<?php

use App\Domain\Announcements\Enums\AnnouncementAudience;
use App\Domain\Requests\Enums\RequestCategory;
use App\Models\Announcement;
use App\Models\ApprovalFlow;
use App\Models\LeaveType;
use App\Models\Note;
use App\Models\User;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Routing\Middleware\ThrottleRequestsWithRedis;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;

require_once __DIR__.'/../../Support/tenancy-helpers.php';

/*
 * Plan item #8 (Fase 1), the wider net: id fields validated only by format
 * (`ulid`), and checked later by the Action, may never make a row of company
 * A point at a row of company B (a B person in an A chat, a B task in an A
 * milestone, a B division in an A announcement, …). Each case sends B's ids
 * in an otherwise valid body; afterwards no A row references a B id that did
 * not before, and B's data is unchanged. The response may be a validation
 * error or a success that silently ignored the foreign ids.
 */

beforeEach(function () {
    $this->withoutMiddleware([ThrottleRequests::class, ThrottleRequestsWithRedis::class]);
    $this->home = homeWorld();
    $this->foreign = foreignWorld();
});

/**
 * Rows of $companyId (config/tenancy.php) whose text/json columns contain any
 * of $ids, per table.
 *
 * @param  list<string>  $ids
 * @return array<string, int>
 */
function crossCompanyReferences(string $companyId, array $ids): array
{
    $counts = [];

    foreach (tenancyScopedTables() as $table => [$where, $placeholders]) {
        if (str_contains($where, ':morph')) {
            continue;
        }

        $columns = DB::select(
            "select column_name, data_type from information_schema.columns
              where table_schema = current_schema() and table_name = ?
                and data_type in ('character', 'character varying', 'text', 'jsonb', 'json', 'ARRAY')",
            [$table],
        );
        $checks = [];

        foreach ($columns as $column) {
            $name = '"'.$column->column_name.'"';
            $checks[] = in_array($column->data_type, ['jsonb', 'json', 'ARRAY'], true)
                ? "exists (select 1 from unnest(?::text[]) as x(v) where {$table}.{$name}::text like '%' || x.v || '%')"
                : "{$table}.{$name}::text = any(?::text[])";
        }

        if ($checks === []) {
            continue;
        }

        $list = '{'.implode(',', $ids).'}';
        $count = DB::selectOne(
            "select count(*) as c from {$table} where ({$where}) and (".implode(' or ', $checks).')',
            [...array_fill(0, $placeholders, $companyId), ...array_fill(0, count($checks), $list)],
        );

        if ((int) $count->c > 0) {
            $counts[$table] = (int) $count->c;
        }
    }

    return $counts;
}

/**
 * @return array{0: string, 1: Closure(object, object): array{0: User, 1: string, 2: string, 3: array<string, mixed>}}
 */
dataset('foreign ids validated by the action', [
    'obrolan langsung' => [fn (object $a, object $b): array => [
        $a->anggota, 'web', route('chat.channels.direct'), ['user_ids' => [$b->anggota->id, $b->kadiv->id]],
    ]],
    'kanal baru + anggota' => [fn (object $a, object $b): array => [
        $a->kadiv, 'web', route('chat.channels.store'), ['name' => 'Kanal uji', 'private' => true, 'member_ids' => [$b->anggota->id]],
    ]],
    'obrolan api' => [fn (object $a, object $b): array => [
        $a->anggota, 'api', route('api.v1.chat.store'), ['jenis' => 'langsung', 'user_ids' => [$b->anggota->id]],
    ]],
    'kanal api' => [fn (object $a, object $b): array => [
        $a->kadiv, 'api', route('api.v1.chat.store'), ['jenis' => 'kanal', 'name' => 'Kanal uji', 'private' => true, 'member_ids' => [$b->anggota->id]],
    ]],
    'milestone + tugas' => [fn (object $a, object $b): array => [
        $a->kadiv, 'web', route('projects.milestones.store', $a->project), ['name' => 'Milestone uji', 'target_date' => now()->addMonth()->toDateString(), 'task_ids' => [$b->task->id, $b->projectTask->id]],
    ]],
    'pengumuman divisi' => [fn (object $a, object $b): array => [
        $a->direksi, 'web', route('announcements.store'), ['title' => 'Uji', 'body' => 'Isi uji', 'audience' => AnnouncementAudience::Division->value, 'target_ids' => [$b->division->id]],
    ]],
    'pengumuman tim' => [fn (object $a, object $b): array => [
        $a->direksi, 'web', route('announcements.store'), ['title' => 'Uji', 'body' => 'Isi uji', 'audience' => AnnouncementAudience::Team->value, 'target_ids' => [$b->team->id]],
    ]],
    'delegasi persetujuan' => [fn (object $a, object $b): array => [
        $a->kadiv, 'web', route('approvals.delegations.store'), ['delegate_id' => $b->kadiv->id, 'starts_on' => now()->toDateString(), 'ends_on' => now()->addWeek()->toDateString()],
    ]],
    'delegasi persetujuan api' => [fn (object $a, object $b): array => [
        $a->kadiv, 'api', route('api.v1.approvals.delegations.store'), ['delegate_id' => $b->kadiv->id, 'starts_on' => now()->toDateString(), 'ends_on' => now()->addWeek()->toDateString()],
    ]],
    'divisi baru' => [fn (object $a, object $b): array => [
        $a->hr, 'web', route('admin.organization.divisions.store'), ['name' => 'Divisi uji', 'code' => 'UJI', 'head_user_id' => $b->kadiv->id, 'parent_id' => $b->division->id],
    ]],
    'tim baru' => [fn (object $a, object $b): array => [
        $a->hr, 'web', route('admin.organization.teams.store'), ['division_id' => $b->division->id, 'name' => 'Tim uji', 'lead_user_id' => $b->kadiv->id],
    ]],
    'tim baru, ketua asing' => [fn (object $a, object $b): array => [
        $a->hr, 'web', route('admin.organization.teams.store'), ['division_id' => $a->division->id, 'name' => 'Tim uji', 'lead_user_id' => $b->kadiv->id],
    ]],
    'alur persetujuan' => [fn (object $a, object $b): array => [
        $a->hr, 'web', route('admin.approval-flows.store'), [
            'name' => 'Alur uji',
            'leave_type_id' => LeaveType::query()->where('company_id', $b->company->id)->value('id'),
            'steps' => [['approver_type' => 'user', 'approver_user_id' => $b->hr->id]],
        ],
    ]],
    'jenis pengajuan' => [fn (object $a, object $b): array => [
        $a->hr, 'web', route('admin.leave-types.store'), [
            'code' => 'UJI', 'name' => 'Izin uji', 'category' => RequestCategory::Permit->value,
            'approval_flow_id' => ApprovalFlow::query()->where('company_id', $b->company->id)->value('id'),
        ],
    ]],
    'objective okr' => [fn (object $a, object $b): array => [
        $a->direksi, 'web', route('okr.store'), ['division_id' => $a->division->id, 'quarter' => '2026-Q4', 'title' => 'Objective uji', 'owner_id' => $b->kadiv->id],
    ]],
    'catatan baru' => [fn (object $a, object $b): array => [
        $a->kadiv, 'web', route('notes.store'), ['title' => 'Catatan uji', 'workspace_id' => $b->teamWorkspace->id, 'parent_id' => Note::query()->where('workspace_id', $b->teamWorkspace->id)->value('id')],
    ]],
    'catatan baru, induk asing' => [fn (object $a, object $b): array => [
        $a->kadiv, 'web', route('notes.store'), ['title' => 'Catatan uji', 'workspace_id' => $a->workspace->id, 'parent_id' => Note::query()->where('workspace_id', $b->teamWorkspace->id)->value('id')],
    ]],
    'tugas api' => [fn (object $a, object $b): array => [
        $a->kadiv, 'api', route('api.v1.tasks.store'), ['workspace_id' => $b->teamWorkspace->id, 'title' => 'Tugas uji'],
    ]],
]);

it('never links a row of company A to company B', function (Closure $case) {
    [$actor, $channel, $url, $payload] = $case($this->home, $this->foreign);
    $foreignIds = tenancyRowIds($this->foreign->company->id);
    $references = crossCompanyReferences($this->home->company->id, $foreignIds);
    $fingerprint = tenancyFingerprint($this->foreign->company->id);

    if ($channel === 'api') {
        Sanctum::actingAs($actor);
        $response = $this->postJson($url, $payload);
    } else {
        $response = $this->actingAs($actor)->post($url, $payload);
    }

    if (getenv('TENANCY_DEBUG')) {
        fwrite(STDERR, "[tenancy] {$url}: {$response->getStatusCode()}\n");
    }

    expect($response->getStatusCode())->toBeLessThan(500)
        ->and(crossCompanyReferences($this->home->company->id, $foreignIds))->toBe($references)
        ->and(tenancyFingerprint($this->foreign->company->id))->toBe($fingerprint);
})->with('foreign ids validated by the action');

it('sees a link from company A to company B (control)', function () {
    $foreignIds = tenancyRowIds($this->foreign->company->id);
    $before = crossCompanyReferences($this->home->company->id, $foreignIds);

    DB::table('workspace_members')->insert(['workspace_id' => $this->home->workspace->id, 'user_id' => $this->foreign->anggota->id, 'role' => 'member', 'joined_at' => now()]);
    Announcement::factory()->create(['company_id' => $this->home->company->id, 'audience' => AnnouncementAudience::Division, 'target_ids' => [$this->foreign->division->id]]);

    $after = crossCompanyReferences($this->home->company->id, $foreignIds);

    expect($after['workspace_members'] ?? 0)->toBe(($before['workspace_members'] ?? 0) + 1)
        ->and($after['announcements'] ?? 0)->toBe(($before['announcements'] ?? 0) + 1);
});
