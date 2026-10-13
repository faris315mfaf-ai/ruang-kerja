<?php

use App\Domain\Google\Enums\DriveFileKind;
use App\Domain\Google\Testing\FakeDriveClient;
use App\Domain\Organization\Enums\Role;
use App\Domain\Tasks\Actions\CreateTask;
use App\Domain\Tasks\Enums\TaskPriority;
use App\Domain\Tasks\Services\DefaultTaskStatuses;
use App\Domain\Workspaces\Actions\EnsurePersonalWorkspace;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\Activity;
use App\Models\AutomationRule;
use App\Models\AutomationRun;
use App\Models\DriveFile;
use App\Models\Label;
use App\Models\Note;
use App\Models\RecurringTask;
use App\Models\Task;
use App\Models\TaskStatus;
use App\Models\TaskTemplate;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;
use App\Models\WorkspaceTemplate;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Contracts\Auth\Factory;
use Laravel\Sanctum\Sanctum;
use Tests\Fixtures\Google\GoogleTesting;

require_once __DIR__.'/../../Support/workspace-helpers.php';

/*
| API v1 — B3-A2 Workspace & otomasi: daftar terkelompok + lencana, buat
| workspace (dan dari template), favorit, detail + read-only, dokumen/file,
| aktivitas, anggota (tulis lewat Action web), pengaturan baca-saja, papan,
| daftar, kalender, pindah kartu, dan otomasi (baca + jeda + pakai template).
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);

    $this->lead = User::factory()->withRole(Role::KepalaDivisi)->create(['name' => 'Dimas Pratama']);
    $this->member = User::factory()->create(['name' => 'Sari Wulandari']);
    $this->admin = User::factory()->create(['name' => 'Rizky Admin']);
    $this->viewer = User::factory()->create(['name' => 'Putri Viewer']);
    $this->outsider = User::factory()->create(['name' => 'Orang Luar']);
    $this->direksi = User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Direksi']);

    $this->team = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'TMS', 'name' => 'Tim Operasional']);
    addMember($this->team, $this->member);
    addMember($this->team, $this->admin, WorkspaceRole::Admin);
    addMember($this->team, $this->viewer, WorkspaceRole::Viewer);
});

function sebagaiA2(?User $user): void
{
    app(Factory::class)->forgetGuards();

    if ($user !== null) {
        Sanctum::actingAs($user);
    }
}

function tugasA2(Workspace $workspace, User $creator, array $attributes = []): Task
{
    return app(CreateTask::class)->handle($workspace, $creator, ['title' => 'Tugas uji', ...$attributes]);
}

// ---------------------------------------------------------------------------
// Daftar, buat, favorit
// ---------------------------------------------------------------------------

test('the list carries badges, favorites first and what the caller may create', function () {
    $second = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'ABC', 'name' => 'Alfa Tim']);
    addMember($second, $this->member);

    tugasA2($this->team, $this->lead, ['title' => 'Terbuka']);
    tugasA2($this->team, $this->lead, ['title' => 'Lewat tenggat', 'due_date' => CarbonImmutable::now()->subDays(3)->toDateString()]);
    $done = tugasA2($this->team, $this->lead, ['title' => 'Selesai']);
    $done->forceFill(['status_category' => 'done', 'status_id' => statusOf($this->team, 'done')->id])->saveQuietly();

    // ABC sorts before TMS by name; starring TMS must put it first.
    sebagaiA2($this->member);
    $this->postJson('/api/v1/workspace/TMS/favorit')->assertOk()->assertExactJson(['favorit' => true]);

    $response = $this->getJson('/api/v1/workspace')->assertOk();
    $items = collect($response->json('groups'))->firstWhere('jenis', 'divisi')['items'];

    expect(array_column($items, 'key'))->toBe(['TMS', 'ABC']);

    $tms = $items[0];
    expect($tms['members_count'])->toBe(4)
        ->and($tms['open_tasks_count'])->toBe(2)
        ->and($tms['overdue_tasks_count'])->toBe(1)
        ->and($tms['my_role'])->toBe('member')
        ->and($tms['favorit'])->toBeTrue()
        ->and($tms['is_member'])->toBeTrue()
        ->and($tms['view_only'])->toBeFalse()
        ->and($tms['type'])->toBe('team')
        ->and($tms['group'])->toBe('divisi');

    $response->assertJsonPath('can_create.team', false)->assertJsonPath('can_create.project', false);

    sebagaiA2($this->lead);
    $this->getJson('/api/v1/workspace')->assertJsonPath('can_create.team', true)->assertJsonPath('can_create.project', true);
});

test('management that is not a member sees the Lainnya group as view only', function () {
    sebagaiA2($this->direksi);
    $groups = collect($this->getJson('/api/v1/workspace')->assertOk()->json('groups'));
    $other = $groups->firstWhere('jenis', 'lainnya')['items'];

    expect(array_column($other, 'key'))->toContain('TMS');
    $tms = collect($other)->firstWhere('key', 'TMS');
    expect($tms['view_only'])->toBeTrue()->and($tms['is_member'])->toBeFalse()->and($tms['my_role'])->toBeNull();
});

test('favorites are for members only and idempotent', function () {
    sebagaiA2($this->member);
    $this->postJson('/api/v1/workspace/TMS/favorit')->assertOk();
    $this->postJson('/api/v1/workspace/TMS/favorit')->assertOk();
    $this->deleteJson('/api/v1/workspace/TMS/favorit')->assertOk()->assertExactJson(['favorit' => false]);

    // Direksi sees TMS but is no member: forbidden. An outsider cannot see it at all.
    sebagaiA2($this->direksi);
    $this->postJson('/api/v1/workspace/TMS/favorit')->assertForbidden();
    sebagaiA2($this->outsider);
    $this->postJson('/api/v1/workspace/TMS/favorit')->assertNotFound();
});

test('creating a workspace follows the web policy and key rules', function () {
    sebagaiA2($this->lead);
    $response = $this->postJson('/api/v1/workspace', ['type' => 'project', 'name' => 'Peluncuran Produk', 'key' => 'plq', 'visibility' => 'internal'])
        ->assertCreated();

    expect($response->json('workspace.key'))->toBe('PLQ')
        ->and($response->json('workspace.type'))->toBe('project')
        ->and($response->json('workspace.my_role'))->toBe('owner')
        ->and($response->json('workspace.visibility'))->toBe('internal')
        ->and($response->json('message'))->toBe('Workspace Peluncuran Produk dibuat.');

    $created = Workspace::query()->where('key', 'PLQ')->firstOrFail();
    expect($created->owner_id)->toBe($this->lead->id)
        ->and(TaskStatus::query()->where('workspace_id', $created->id)->count())->toBe(5);

    // Defaults to private, key generated when omitted.
    $this->postJson('/api/v1/workspace', ['type' => 'team', 'name' => 'Gudang Utara'])->assertCreated()->assertJsonPath('workspace.visibility', 'private');

    // Key already taken, invalid key, missing name/type.
    $this->postJson('/api/v1/workspace', ['type' => 'team', 'name' => 'Lagi', 'key' => 'TMS'])
        ->assertUnprocessable()->assertJsonValidationErrors('key');
    $this->postJson('/api/v1/workspace', ['type' => 'team', 'name' => 'Lagi', 'key' => '9X'])
        ->assertUnprocessable()->assertJsonValidationErrors('key');
    $this->postJson('/api/v1/workspace', ['name' => 'Tanpa jenis'])->assertUnprocessable()->assertJsonValidationErrors('type');
    $this->postJson('/api/v1/workspace', ['type' => 'division', 'name' => 'Divisi'])->assertUnprocessable();

    // Staff cannot create; Direksi may start a project but not a team.
    sebagaiA2($this->member);
    $this->postJson('/api/v1/workspace', ['type' => 'team', 'name' => 'Tim saya'])->assertForbidden();
    sebagaiA2($this->direksi);
    $this->postJson('/api/v1/workspace', ['type' => 'project', 'name' => 'Proyek Direksi'])->assertCreated();
    $this->postJson('/api/v1/workspace', ['type' => 'team', 'name' => 'Tim Direksi'])->assertForbidden();
});

test('a workspace template builds the workspace through the same action, behind the automation flag', function () {
    $template = WorkspaceTemplate::factory()->create(['name' => 'Proyek standar']);

    sebagaiA2($this->lead);
    config(['features.automation' => false]);
    $this->getJson('/api/v1/workspace/templat')->assertNotFound();
    $this->postJson('/api/v1/workspace', ['template_id' => $template->id, 'name' => 'Dari Templat'])->assertNotFound();

    config(['features.automation' => true]);
    $list = $this->getJson('/api/v1/workspace/templat')->assertOk()->json('templat');
    expect($list)->toHaveCount(1)
        ->and($list[0]['id'])->toBe($template->id)
        ->and($list[0]['can_use'])->toBeTrue()
        ->and($list[0]['statuses'])->not->toBeEmpty();

    $created = $this->postJson('/api/v1/workspace', ['template_id' => $template->id, 'name' => 'Dari Templat', 'key' => 'DRT'])
        ->assertCreated()
        ->assertJsonPath('workspace.type', 'project');

    $workspace = Workspace::query()->where('key', 'DRT')->firstOrFail();
    expect(TaskStatus::query()->where('workspace_id', $workspace->id)->pluck('name')->all())->toContain('Ide', 'Rencana')
        ->and($created->json('workspace.id'))->toBe($workspace->id)
        ->and($template->fresh()->used_count)->toBe(1);

    // Staff may see the templates but not use them.
    sebagaiA2($this->member);
    expect($this->getJson('/api/v1/workspace/templat')->json('templat.0.can_use'))->toBeFalse();
    $this->postJson('/api/v1/workspace', ['template_id' => $template->id, 'name' => 'Nope'])->assertForbidden();
});

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

test('the detail carries role, counts, abilities, tabs and the read-only reasons', function () {
    tugasA2($this->team, $this->lead);
    DriveFile::factory()->create(['workspace_id' => $this->team->id]);
    DriveFile::factory()->pdf()->create(['workspace_id' => $this->team->id, 'kind' => DriveFileKind::Pdf]);

    sebagaiA2($this->admin);
    $detail = $this->getJson('/api/v1/workspace/TMS')->assertOk()->json();

    expect($detail['workspace']['key'])->toBe('TMS')
        ->and($detail['my_role'])->toBe('admin')
        ->and($detail['read_only'])->toBe(['read_only' => false, 'reason' => null, 'code' => null])
        ->and($detail['can']['edit_tasks'])->toBeTrue()
        ->and($detail['can']['manage'])->toBeTrue()
        ->and($detail['can']['manage_members'])->toBeTrue()
        ->and($detail['counts']['members'])->toBe(4)
        ->and($detail['counts']['open_tasks'])->toBe(1)
        ->and($detail['counts']['columns'])->toBe(5)
        ->and($detail['counts']['documents'])->toBe(1)
        ->and($detail['counts']['files'])->toBe(2)
        ->and($detail['tabs'])->toContain('tugas', 'dokumen', 'file', 'aktivitas', 'anggota', 'pengaturan')
        ->and($detail['project'])->toBeNull();

    sebagaiA2($this->viewer);
    $this->getJson('/api/v1/workspace/TMS')->assertJsonPath('read_only.code', 'peran_viewer')
        ->assertJsonPath('read_only.reason', 'Peran Anda di workspace ini hanya bisa melihat.')
        ->assertJsonPath('can.edit_tasks', false);

    sebagaiA2($this->direksi);
    $this->getJson('/api/v1/workspace/TMS')->assertJsonPath('read_only.code', 'lihat_saja')
        ->assertJsonPath('can.view_only', true)->assertJsonPath('my_role', null);

    $this->team->forceFill(['archived_at' => now()])->saveQuietly();
    sebagaiA2($this->member);
    $this->getJson('/api/v1/workspace/TMS')->assertJsonPath('read_only.code', 'arsip')->assertJsonPath('workspace.arsip', true);
    sebagaiA2($this->outsider);
    $this->getJson('/api/v1/workspace/TMS')->assertNotFound();
});

test('a project exposes its tracking fields', function () {
    $project = Workspace::factory()->project()->ownedBy($this->lead)->create([
        'key' => 'PRJ', 'start_date' => '2026-10-01', 'target_date' => '2026-12-31', 'project_status' => 'active', 'health' => 'at_risk',
    ]);
    addMember($project, $this->member);

    sebagaiA2($this->member);
    $this->getJson('/api/v1/workspace/PRJ')->assertOk()
        ->assertJsonPath('project.status', 'active')
        ->assertJsonPath('project.health', 'at_risk')
        ->assertJsonPath('project.target_date', '2026-12-31')
        ->assertJsonPath('tabs.6', 'ringkasan');
});

// ---------------------------------------------------------------------------
// Dokumen, file, drive
// ---------------------------------------------------------------------------

test('documents and files come from the drive cache and honour visibility', function () {
    GoogleTesting::disable();
    config(['features.notes' => false]);
    $root = 'folderroot1234567890';
    $this->team->forceFill(['drive_folder_id' => $root])->saveQuietly();
    DriveFile::factory()->create(['workspace_id' => $this->team->id, 'parent_google_id' => $root, 'name' => 'Brief']);
    DriveFile::factory()->pdf()->create(['workspace_id' => $this->team->id, 'parent_google_id' => $root, 'name' => 'Kontrak.pdf']);
    DriveFile::factory()->create(['workspace_id' => $this->team->id, 'parent_google_id' => $root, 'name' => 'Arsip', 'kind' => DriveFileKind::Folder, 'mime_type' => 'application/vnd.google-apps.folder']);

    sebagaiA2($this->viewer);
    $docs = $this->getJson('/api/v1/workspace/TMS/dokumen')->assertOk();
    expect(array_column($docs->json('documents'), 'name'))->toBe(['Brief'])
        ->and($docs->json('drive.enabled'))->toBeFalse()
        ->and($docs->json('drive.can_contribute'))->toBeFalse()
        ->and($docs->json('counts'))->toBe(['documents' => 1, 'files' => 2])
        ->and($docs->json('notes'))->toBe([]);

    $files = $this->getJson('/api/v1/workspace/TMS/file')->assertOk();
    expect(array_column($files->json('files'), 'name'))->toBe(['Arsip', 'Brief', 'Kontrak.pdf'])
        ->and($files->json('files.0.kind'))->toBe('folder')
        ->and($files->json('breadcrumbs.0.id'))->toBeNull();

    $this->getJson('/api/v1/workspace/TMS/file?folder=doesnotexist1234567')->assertNotFound();

    sebagaiA2($this->outsider);
    $this->getJson('/api/v1/workspace/TMS/dokumen')->assertNotFound();
    $this->getJson('/api/v1/workspace/TMS/file')->assertNotFound();
});

test('the documents tab lists the notes of the workspace when notes are on', function () {
    GoogleTesting::disable();
    config(['features.notes' => true]);

    sebagaiA2($this->member);
    $this->getJson('/api/v1/workspace/TMS/dokumen')->assertOk()->assertJsonPath('notes', []);

    $note = Note::factory()->create(['workspace_id' => $this->team->id, 'title' => 'Notulen mingguan', 'created_by' => $this->lead->id]);
    $notes = $this->getJson('/api/v1/workspace/TMS/dokumen')->json('notes');

    expect($notes)->toHaveCount(1)->and($notes[0]['id'])->toBe($note->id)->and($notes[0]['title'])->toBe('Notulen mingguan');
});

test('drive writes answer 503 drive_belum_siap until Google is configured', function () {
    GoogleTesting::disable();

    sebagaiA2($this->member);
    $this->postJson('/api/v1/workspace/TMS/dokumen', ['type' => 'document', 'name' => 'Rencana'])
        ->assertStatus(503)
        ->assertExactJson(['code' => 'drive_belum_siap', 'message' => 'Integrasi Google Drive belum diaktifkan. Hubungi admin RuangKerja.']);
    $this->postJson('/api/v1/workspace/TMS/file/folder', ['name' => 'Kontrak'])
        ->assertStatus(503)->assertJsonPath('code', 'drive_belum_siap');

    // Permission is checked first: a viewer is 403, an outsider 404, whatever Google says.
    sebagaiA2($this->viewer);
    $this->postJson('/api/v1/workspace/TMS/dokumen', ['type' => 'document'])->assertForbidden();
    sebagaiA2($this->outsider);
    $this->postJson('/api/v1/workspace/TMS/dokumen', ['type' => 'document'])->assertNotFound();
});

test('with Drive available a member creates a document and a folder (fake Google)', function () {
    $drive = FakeDriveClient::fake();
    $root = $drive->seedFolder('Tim Operasional [TMS]');
    $this->team->forceFill(['drive_folder_id' => $root->id])->saveQuietly();

    sebagaiA2($this->member);
    $this->postJson('/api/v1/workspace/TMS/dokumen', ['type' => 'spreadsheet', 'name' => 'Anggaran'])
        ->assertCreated()
        ->assertJsonPath('file.kind', 'sheet')
        ->assertJsonPath('file.added_by.id', $this->member->id);
    $drive->assertFileCreated('Anggaran', 'application/vnd.google-apps.spreadsheet', $root->id);

    $this->postJson('/api/v1/workspace/TMS/file/folder', ['name' => 'Legal'])
        ->assertCreated()->assertJsonPath('file.kind', 'folder');
    $drive->assertFolderCreated('Legal', $root->id);

    $this->getJson('/api/v1/workspace/TMS/dokumen')->assertJsonPath('documents.0.name', 'Anggaran')->assertJsonPath('drive.enabled', true);
    $this->postJson('/api/v1/workspace/TMS/dokumen', ['type' => 'bogus'])->assertUnprocessable();
});

// ---------------------------------------------------------------------------
// Aktivitas, anggota, pengaturan
// ---------------------------------------------------------------------------

test('the activity feed is paginated and phrased in Indonesian', function () {
    $task = tugasA2($this->team, $this->lead, ['title' => 'Siapkan gudang']);
    Activity::query()->create([
        'workspace_id' => $this->team->id, 'subject_type' => Task::class, 'subject_id' => $task->id, 'causer_id' => $this->member->id,
        'event' => 'task.assigned', 'properties' => ['key' => 'TMS-1', 'user_ids' => [$this->admin->id]], 'created_at' => now()->addMinute(),
    ]);
    for ($i = 0; $i < 31; $i++) {
        Activity::query()->create([
            'workspace_id' => $this->team->id, 'subject_type' => Workspace::class, 'subject_id' => $this->team->id, 'causer_id' => null,
            'event' => 'workspace.updated', 'properties' => [], 'created_at' => now()->subMinutes($i + 5),
        ]);
    }

    sebagaiA2($this->viewer);
    $first = $this->getJson('/api/v1/workspace/TMS/aktivitas')->assertOk();

    expect($first->json('aktivitas'))->toHaveCount(30)
        ->and($first->json('aktivitas.0.text'))->toBe('menugaskan TMS-1 ke Rizky Admin')
        ->and($first->json('aktivitas.0.subject_type'))->toBe('task')
        ->and($first->json('aktivitas.0.task_key'))->toBe('TMS-1')
        ->and($first->json('aktivitas.0.actor.name'))->toBe('Sari Wulandari')
        ->and($first->json('meta.has_more'))->toBeTrue()
        ->and($first->json('meta.total'))->toBe(33);

    $second = $this->getJson('/api/v1/workspace/TMS/aktivitas?page=2')->assertOk();
    expect($second->json('aktivitas'))->toHaveCount(3)->and($second->json('meta.has_more'))->toBeFalse();

    sebagaiA2($this->outsider);
    $this->getJson('/api/v1/workspace/TMS/aktivitas')->assertNotFound();
});

test('members list carries role, Drive access and who may be changed', function () {
    WorkspaceMember::query()->where('workspace_id', $this->team->id)->where('user_id', $this->member->id)
        ->update(['drive_access' => 'writer', 'drive_synced_at' => now()]);
    WorkspaceMember::query()->where('workspace_id', $this->team->id)->where('user_id', $this->viewer->id)
        ->update(['drive_error' => 'invalidSharingRequest']);
    GoogleTesting::disable();
    config(['google.fake' => true]);

    sebagaiA2($this->admin);
    $response = $this->getJson('/api/v1/workspace/TMS/anggota')->assertOk();
    $rows = collect($response->json('anggota'))->keyBy('id');

    expect($response->json('can.manage_members'))->toBeTrue()
        ->and($response->json('role_options'))->toBe([
            ['value' => 'admin', 'label' => 'Admin'], ['value' => 'member', 'label' => 'Member'], ['value' => 'viewer', 'label' => 'Viewer'],
        ])
        ->and($rows[$this->lead->id]['role'])->toBe('owner')
        ->and($rows[$this->lead->id]['can_change_role'])->toBeFalse()
        ->and($rows[$this->member->id]['drive_access']['status'])->toBe('tersinkron')
        ->and($rows[$this->viewer->id]['drive_access']['status'])->toBe('gagal')
        ->and($rows[$this->viewer->id]['drive_access']['error'])->toBe('invalidSharingRequest')
        ->and($rows[$this->admin->id]['drive_access']['status'])->toBe('menunggu')
        ->and($rows[$this->member->id]['can_remove'])->toBeTrue();

    sebagaiA2($this->member);
    $this->getJson('/api/v1/workspace/TMS/anggota')->assertJsonPath('can.manage_members', false)
        ->assertJsonPath('anggota.0.can_change_role', false);
});

test('admins add, change and remove members through the web actions', function () {
    sebagaiA2($this->admin);

    $this->getJson('/api/v1/workspace/TMS/anggota/kandidat?q=luar')->assertOk()
        ->assertJsonPath('kandidat.0.id', $this->outsider->id);

    $this->postJson('/api/v1/workspace/TMS/anggota', ['user_id' => $this->outsider->id, 'role' => 'member'])
        ->assertCreated()
        ->assertJsonPath('anggota.role', 'member')
        ->assertJsonPath('message', 'Orang Luar ditambahkan sebagai Member.');
    expect($this->team->roleOf($this->outsider))->toBe(WorkspaceRole::Member);

    $this->postJson('/api/v1/workspace/TMS/anggota', ['user_id' => $this->outsider->id, 'role' => 'member'])
        ->assertUnprocessable()->assertJsonValidationErrors('user_id');
    $this->postJson('/api/v1/workspace/TMS/anggota', ['user_id' => $this->direksi->id, 'role' => 'owner'])
        ->assertUnprocessable()->assertJsonValidationErrors('role');

    $this->patchJson("/api/v1/workspace/TMS/anggota/{$this->outsider->id}", ['role' => 'viewer'])
        ->assertOk()->assertJsonPath('anggota.role', 'viewer')
        ->assertJsonPath('message', 'Peran Orang Luar diubah menjadi Viewer.');
    $this->patchJson("/api/v1/workspace/TMS/anggota/{$this->lead->id}", ['role' => 'member'])
        ->assertUnprocessable()->assertJsonValidationErrors('role');

    $this->deleteJson("/api/v1/workspace/TMS/anggota/{$this->outsider->id}")->assertOk()
        ->assertJsonPath('message', 'Orang Luar dikeluarkan dari workspace.');
    expect($this->team->roleOf($this->outsider))->toBeNull();

    $this->deleteJson("/api/v1/workspace/TMS/anggota/{$this->lead->id}")->assertUnprocessable();

    expect(Activity::query()->where('workspace_id', $this->team->id)->pluck('event')->all())
        ->toContain('workspace.member_added', 'workspace.member_role_changed', 'workspace.member_removed');
});

test('plain members cannot change members and outsiders see nothing', function () {
    sebagaiA2($this->member);
    $this->postJson('/api/v1/workspace/TMS/anggota', ['user_id' => $this->outsider->id, 'role' => 'member'])->assertForbidden();
    $this->patchJson("/api/v1/workspace/TMS/anggota/{$this->viewer->id}", ['role' => 'member'])->assertForbidden();
    $this->deleteJson("/api/v1/workspace/TMS/anggota/{$this->viewer->id}")->assertForbidden();
    $this->getJson('/api/v1/workspace/TMS/anggota/kandidat')->assertForbidden();

    sebagaiA2($this->outsider);
    $this->postJson('/api/v1/workspace/TMS/anggota', ['user_id' => $this->outsider->id, 'role' => 'member'])->assertNotFound();
    $this->deleteJson("/api/v1/workspace/TMS/anggota/{$this->viewer->id}")->assertNotFound();
});

test('members synced from the organization cannot be removed by hand and archived workspaces are locked', function () {
    WorkspaceMember::query()->where('workspace_id', $this->team->id)->where('user_id', $this->member->id)->update(['is_synced' => true]);

    sebagaiA2($this->admin);
    $this->deleteJson("/api/v1/workspace/TMS/anggota/{$this->member->id}")->assertUnprocessable()->assertJsonValidationErrors('user_id');

    $this->team->forceFill(['archived_at' => now()])->saveQuietly();
    $this->postJson('/api/v1/workspace/TMS/anggota', ['user_id' => $this->outsider->id, 'role' => 'member'])->assertForbidden();
});

test('settings are read-only: columns, labels and the desktop hint', function () {
    Label::query()->create(['workspace_id' => $this->team->id, 'name' => 'Penting', 'color' => 'red']);
    tugasA2($this->team, $this->lead);

    sebagaiA2($this->admin);
    $settings = $this->getJson('/api/v1/workspace/TMS/pengaturan')->assertOk();

    expect($settings->json('workspace.key'))->toBe('TMS')
        ->and($settings->json('edit_on_desktop'))->toBeTrue()
        ->and(array_column($settings->json('statuses'), 'kategori'))->toBe(['backlog', 'todo', 'in_progress', 'review', 'done'])
        ->and(array_sum(array_column($settings->json('statuses'), 'tasks_count')))->toBe(1)
        ->and($settings->json('labels.0.name'))->toBe('Penting')
        ->and($settings->json('can.manage'))->toBeTrue();

    sebagaiA2($this->viewer);
    $this->getJson('/api/v1/workspace/TMS/pengaturan')->assertOk()->assertJsonPath('edit_on_desktop', false);
    sebagaiA2($this->outsider);
    $this->getJson('/api/v1/workspace/TMS/pengaturan')->assertNotFound();
});

// ---------------------------------------------------------------------------
// Papan, daftar, kalender, pindah kartu
// ---------------------------------------------------------------------------

test('the board reports abilities, read-only reasons and a can.move per card', function () {
    $task = tugasA2($this->team, $this->lead, ['title' => 'Kartu satu']);
    Label::query()->create(['workspace_id' => $this->team->id, 'name' => 'Bug', 'color' => 'red']);

    sebagaiA2($this->member);
    $board = $this->getJson('/api/v1/workspace/TMS/papan')->assertOk();
    $cards = collect($board->json('columns'))->flatMap(fn ($column) => $column['tasks']);

    expect($board->json('can.edit_tasks'))->toBeTrue()
        ->and($board->json('read_only.read_only'))->toBeFalse()
        ->and($board->json('labels.0.name'))->toBe('Bug')
        ->and($board->json('members_count'))->toBe(4)
        ->and($cards->firstWhere('id', $task->id)['can'])->toBe(['move' => true])
        ->and($cards->firstWhere('id', $task->id)['assignees'])->toBe([]);

    sebagaiA2($this->viewer);
    $viewerBoard = $this->getJson('/api/v1/workspace/TMS/papan')->assertOk();
    expect($viewerBoard->json('can.move'))->toBeFalse()
        ->and($viewerBoard->json('read_only.code'))->toBe('peran_viewer')
        ->and(collect($viewerBoard->json('columns'))->flatMap(fn ($c) => $c['tasks'])->first()['can'])->toBe(['move' => false]);
});

test('moving a card answers the fresh order of the target column and obeys the policy', function () {
    $todo = statusOf($this->team, 'todo');
    $progress = statusOf($this->team, 'in_progress');
    $a = tugasA2($this->team, $this->lead, ['title' => 'A', 'status_id' => $progress->id]);
    $b = tugasA2($this->team, $this->lead, ['title' => 'B', 'status_id' => $progress->id]);
    $c = tugasA2($this->team, $this->lead, ['title' => 'C', 'status_id' => $todo->id]);

    // New tasks land on top of their column: [b, a]. Drop c between them.
    expect(columnIds($progress))->toBe([$b->id, $a->id]);

    sebagaiA2($this->member);
    $response = $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$c->id}", [
        'status_id' => $progress->id, 'after_id' => $b->id, 'before_id' => $a->id,
    ])->assertOk();

    expect(array_column($response->json('column.tasks'), 'id'))->toBe([$b->id, $c->id, $a->id])
        ->and($response->json('column.kategori'))->toBe('in_progress')
        ->and($response->json('task.status_category'))->toBe('in_progress')
        ->and($response->json('task.id'))->toBe($c->id)
        ->and($response->json('message'))->toContain('dipindah ke');
    expect(columnIds($progress))->toBe([$b->id, $c->id, $a->id]);

    // Move to the top of an empty column; wrong column of another workspace → 422.
    $other = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'OTH']);
    addMember($other, $this->member);
    $foreign = statusOf($other, 'todo');
    $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$c->id}", ['status_id' => $foreign->id])->assertUnprocessable()->assertJsonValidationErrors('status_id');
    $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$c->id}", [])->assertUnprocessable()->assertJsonValidationErrors('status_id');

    // A card of another workspace is not found through this path.
    $outside = tugasA2($other, $this->lead);
    $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$outside->id}", ['status_id' => $todo->id])->assertNotFound();

    sebagaiA2($this->viewer);
    $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$a->id}", ['status_id' => $todo->id])->assertForbidden();
    sebagaiA2($this->direksi);
    $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$a->id}", ['status_id' => $todo->id])->assertForbidden();
    sebagaiA2($this->outsider);
    $this->patchJson("/api/v1/workspace/TMS/papan/kartu/{$a->id}", ['status_id' => $todo->id])->assertNotFound();
});

test('the list view filters, searches and paginates', function () {
    $today = CarbonImmutable::now(config('app.office_timezone'))->toDateString();
    $urgent = tugasA2($this->team, $this->lead, ['title' => 'Perbaiki rak', 'priority' => TaskPriority::Urgent, 'due_date' => CarbonImmutable::parse($today)->subDay()->toDateString(), 'assignee_ids' => [$this->member->id]]);
    $low = tugasA2($this->team, $this->lead, ['title' => 'Cat dinding', 'priority' => TaskPriority::Low, 'due_date' => $today]);
    $none = tugasA2($this->team, $this->lead, ['title' => 'Tanpa tenggat']);
    $closed = tugasA2($this->team, $this->lead, ['title' => 'Sudah beres']);
    $closed->forceFill(['status_category' => 'done', 'status_id' => statusOf($this->team, 'done')->id, 'completed_at' => now()->subDays(40)])->saveQuietly();
    $label = Label::query()->create(['workspace_id' => $this->team->id, 'name' => 'Bug', 'color' => 'red']);
    $none->labels()->attach($label->id);

    sebagaiA2($this->member);
    $ids = fn (string $query) => array_column($this->getJson('/api/v1/workspace/TMS/tugas'.$query)->assertOk()->json('tasks'), 'id');

    // Default scope = the board's: closed work older than 30 days is out; tenggat order, nulls last.
    expect($ids(''))->toBe([$urgent->id, $low->id, $none->id]);
    expect($ids('?selesai=1'))->toContain($closed->id);
    expect($ids('?kategori=done'))->toBe([$closed->id]);
    expect($ids('?tenggat=overdue'))->toBe([$urgent->id]);
    expect($ids('?tenggat=today'))->toBe([$low->id]);
    expect($ids('?tenggat=none'))->toBe([$none->id]);
    expect($ids('?prioritas=1'))->toBe([$urgent->id]);
    expect($ids('?assignee=me'))->toBe([$urgent->id]);
    expect($ids('?assignee=none'))->toBe([$low->id, $none->id]);
    expect($ids('?label='.$label->id))->toBe([$none->id]);
    expect($ids('?q=rak'))->toBe([$urgent->id]);
    expect($ids('?q=TMS-'.$low->number))->toBe([$low->id]);
    expect($ids('?urut=prioritas'))->toBe([$urgent->id, $low->id, $none->id]);
    expect($ids('?urut=nomor'))->toBe([$urgent->id, $low->id, $none->id]);

    $page = $this->getJson('/api/v1/workspace/TMS/tugas?per_page=2')->assertOk();
    expect($page->json('tasks'))->toHaveCount(2)
        ->and($page->json('meta'))->toMatchArray(['current_page' => 1, 'last_page' => 2, 'per_page' => 2, 'total' => 3, 'has_more' => true])
        ->and($page->json('statuses'))->toHaveCount(5)
        ->and($page->json('tasks.0.status.name'))->toBeString()
        ->and($page->json('tasks.0.assignees.0.nama'))->toBe('Sari Wulandari');

    $this->getJson('/api/v1/workspace/TMS/tugas?tenggat=bogus')->assertUnprocessable()->assertJsonValidationErrors('tenggat');
    $this->getJson('/api/v1/workspace/TMS/tugas?prioritas=9')->assertUnprocessable();

    sebagaiA2($this->outsider);
    $this->getJson('/api/v1/workspace/TMS/tugas')->assertNotFound();
});

test('the calendar fills the month grid, lists undated work and counts overdue', function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-14 09:00', 'Asia/Jakarta'));

    $inMonth = tugasA2($this->team, $this->lead, ['title' => 'Rapat vendor', 'due_date' => '2026-10-20']);
    $edge = tugasA2($this->team, $this->lead, ['title' => 'Akhir pekan', 'due_date' => '2026-11-01']); // Sunday inside the grid
    tugasA2($this->team, $this->lead, ['title' => 'Bulan lain', 'due_date' => '2026-12-05']);
    $late = tugasA2($this->team, $this->lead, ['title' => 'Terlambat', 'due_date' => '2026-10-02']);
    $undated = tugasA2($this->team, $this->lead, ['title' => 'Tanpa tenggat']);

    sebagaiA2($this->member);
    $calendar = $this->getJson('/api/v1/workspace/TMS/kalender?bulan=2026-10')->assertOk();

    expect($calendar->json('bulan'))->toBe('2026-10')
        ->and($calendar->json('today'))->toBe('2026-10-14')
        ->and($calendar->json('range'))->toBe(['from' => '2026-09-28', 'to' => '2026-11-01'])
        ->and(array_column($calendar->json('tasks'), 'id'))->toBe([$late->id, $inMonth->id, $edge->id])
        ->and($calendar->json('tasks.0.overdue'))->toBeTrue()
        ->and($calendar->json('tasks.1.overdue'))->toBeFalse()
        ->and(array_column($calendar->json('tanpa_tenggat'), 'id'))->toBe([$undated->id])
        ->and($calendar->json('terlambat'))->toBe(1);

    // Default month = this one; a bad month is rejected.
    $this->getJson('/api/v1/workspace/TMS/kalender')->assertOk()->assertJsonPath('bulan', '2026-10');
    $this->getJson('/api/v1/workspace/TMS/kalender?bulan=2026-13')->assertUnprocessable()->assertJsonValidationErrors('bulan');

    sebagaiA2($this->outsider);
    $this->getJson('/api/v1/workspace/TMS/kalender')->assertNotFound();
});

// ---------------------------------------------------------------------------
// Otomasi
// ---------------------------------------------------------------------------

test('automation endpoints are 404 while the feature is off', function () {
    config(['features.automation' => false]);

    sebagaiA2($this->admin);
    foreach (['/api/v1/otomasi/aturan', '/api/v1/otomasi/berulang', '/api/v1/otomasi/templat/tugas'] as $url) {
        $this->getJson($url)->assertNotFound();
    }
    $this->postJson('/api/v1/workspace/TMS/tugas-dari-templat', [])->assertNotFound();
});

test('rules are listed for members with a sentence, can_manage and the 7-day log', function () {
    config(['features.automation' => true]);
    $label = Label::query()->create(['workspace_id' => $this->team->id, 'name' => 'Ditinjau', 'color' => 'teal']);
    $rule = AutomationRule::factory()->forWorkspace($this->team)->create([
        'name' => 'Selesai ke Dimas',
        'trigger' => ['type' => 'task_moved', 'category' => 'done'],
        'condition' => ['type' => 'priority', 'priority' => 1],
        'actions' => [
            ['type' => 'notify', 'target' => ['kind' => 'user', 'id' => $this->lead->id]],
            ['type' => 'add_label', 'label_id' => $label->id],
        ],
    ]);
    $hidden = Workspace::factory()->create();
    AutomationRule::factory()->forWorkspace($hidden)->create(['name' => 'Rahasia']);
    $task = tugasA2($this->team, $this->lead);
    foreach ([['success', 1], ['failed', 2], ['success', 9]] as [$result, $days]) {
        AutomationRun::query()->create(['rule_id' => $rule->id, 'task_id' => $task->id, 'task_key' => 'TMS-1', 'task_title' => 'Uji', 'result' => $result, 'detail' => 'x', 'ran_at' => now()->subDays($days)]);
    }

    sebagaiA2($this->member);
    $list = $this->getJson('/api/v1/otomasi/aturan')->assertOk();

    expect($list->json('aturan'))->toHaveCount(1)
        ->and($list->json('aturan.0.name'))->toBe('Selesai ke Dimas')
        ->and($list->json('aturan.0.can_manage'))->toBeFalse()
        ->and($list->json('aturan.0.workspace.key'))->toBe('TMS')
        ->and($list->json('aturan.0.sentence'))->toBe('Jika tugas di Tim Operasional pindah ke kolom Selesai dan prioritasnya Urgent, maka beri tahu Dimas Pratama dan tambah label "Ditinjau".')
        ->and($list->json('aturan.0.jika'))->toBe('pindah ke kolom Selesai dan prioritasnya Urgent')
        ->and($list->json('aturan.0.maka'))->toBe(['beri tahu Dimas Pratama', 'tambah label "Ditinjau"'])
        ->and($list->json('aturan.0.runs_7d'))->toBe(2)
        ->and($list->json('aturan.0.failed_7d'))->toBe(1)
        ->and($list->json('stats'))->toBe(['rules' => 1, 'active' => 1, 'runs_7d' => 2, 'success_7d' => 1, 'failed_7d' => 1])
        ->and($list->json('create_on_desktop'))->toBeTrue();

    expect($this->getJson('/api/v1/otomasi/aturan?workspace=TMS')->json('aturan'))->toHaveCount(1);
    expect($this->getJson('/api/v1/otomasi/aturan?workspace='.$hidden->id)->json('aturan'))->toBe([]);
    expect($this->getJson('/api/v1/otomasi/aturan?workspace=NOPE')->json('aturan'))->toBe([]);

    $detail = $this->getJson("/api/v1/otomasi/aturan/{$rule->id}")->assertOk();
    expect($detail->json('runs'))->toHaveCount(3)
        ->and($detail->json('runs.0.result'))->toBe('success')
        ->and($detail->json('runs.0.result_label'))->toBe('Berhasil');

    sebagaiA2($this->outsider);
    $this->getJson("/api/v1/otomasi/aturan/{$rule->id}")->assertNotFound();
    expect($this->getJson('/api/v1/otomasi/aturan')->json('aturan'))->toBe([]);
});

test('only owner or admin pause and resume a rule', function () {
    config(['features.automation' => true]);
    $rule = AutomationRule::factory()->forWorkspace($this->team)->create();

    sebagaiA2($this->member);
    $this->patchJson("/api/v1/otomasi/aturan/{$rule->id}/jeda", ['paused' => true])->assertForbidden();
    expect($rule->fresh()->is_active)->toBeTrue();

    sebagaiA2($this->admin);
    $this->patchJson("/api/v1/otomasi/aturan/{$rule->id}/jeda", ['paused' => true])
        ->assertOk()->assertJsonPath('aturan.paused', true)->assertJsonPath('aturan.can_manage', true)
        ->assertJsonPath('message', "\"{$rule->name}\" dijeda.");
    expect($rule->fresh()->is_active)->toBeFalse();

    $this->patchJson("/api/v1/otomasi/aturan/{$rule->id}/jeda", ['paused' => false])->assertOk()->assertJsonPath('aturan.is_active', true);
    $this->patchJson("/api/v1/otomasi/aturan/{$rule->id}/jeda", [])->assertUnprocessable()->assertJsonValidationErrors('paused');

    sebagaiA2($this->outsider);
    $this->patchJson("/api/v1/otomasi/aturan/{$rule->id}/jeda", ['paused' => true])->assertNotFound();
});

test('recurring tasks are listed read-only with their pattern and next dates', function () {
    config(['features.automation' => true]);
    $this->travelTo(CarbonImmutable::parse('2026-10-14 09:00', 'Asia/Jakarta'));
    RecurringTask::factory()->forWorkspace($this->team)->create(['title' => 'Rekap mingguan', 'assignee_id' => $this->member->id]);
    RecurringTask::factory()->forWorkspace($this->team)->create(['title' => 'Dijeda', 'is_active' => false]);
    RecurringTask::factory()->forWorkspace(Workspace::factory()->create())->create(['title' => 'Tak terlihat']);

    sebagaiA2($this->member);
    $list = $this->getJson('/api/v1/otomasi/berulang')->assertOk();
    $items = collect($list->json('berulang'))->keyBy('title');

    expect($items->keys()->all())->toContain('Rekap mingguan', 'Dijeda')->not->toContain('Tak terlihat')
        ->and($items['Rekap mingguan']['pattern_label'])->toBe('Setiap Senin')
        ->and($items['Rekap mingguan']['next_dates'])->toBe(['2026-10-19', '2026-10-26', '2026-11-02'])
        ->and($items['Rekap mingguan']['assignee_name'])->toBe('Sari Wulandari')
        ->and($items['Rekap mingguan']['workspace']['key'])->toBe('TMS')
        ->and($items['Rekap mingguan']['can_manage'])->toBeFalse()
        ->and($items['Dijeda']['next_dates'])->toBe([]);

    expect($this->getJson('/api/v1/otomasi/berulang?workspace=NOPE')->json('berulang'))->toBe([]);
});

test('task templates are listed and applied into a workspace the caller may edit', function () {
    config(['features.automation' => true]);
    $company = TaskTemplate::factory()->create(['name' => 'Kunjungan klien', 'title' => 'Kunjungan [klien]']);
    $own = TaskTemplate::factory()->forWorkspace($this->team)->create(['name' => 'Opname gudang']);
    TaskTemplate::factory()->forWorkspace(Workspace::factory()->create())->create(['name' => 'Rahasia']);

    sebagaiA2($this->member);
    $list = $this->getJson('/api/v1/otomasi/templat/tugas')->assertOk()->json('templat');
    $names = array_column($list, 'name');
    expect($names)->toContain('Kunjungan klien', 'Opname gudang')->not->toContain('Rahasia');
    expect(collect($list)->firstWhere('id', $company->id)['scope'])->toBe('semua')
        ->and(collect($list)->firstWhere('id', $own->id)['scope'])->toBe('workspace')
        ->and(collect($list)->firstWhere('id', $company->id)['checklist'])->toHaveCount(3);

    $created = $this->postJson('/api/v1/workspace/TMS/tugas-dari-templat', ['template_id' => $company->id, 'title' => 'Kunjungan PT Maju', 'due_date' => '2026-10-30'])
        ->assertCreated();

    expect($created->json('task.title'))->toBe('Kunjungan PT Maju')
        ->and($created->json('task.key'))->toStartWith('TMS-')
        ->and($created->json('task.due_date'))->toBe('2026-10-30')
        ->and($created->json('task.priority.value'))->toBe(3)
        ->and($created->json('skipped_labels'))->toBe([])
        ->and($company->fresh()->used_count)->toBe(1);
    expect(Task::query()->where('title', 'Kunjungan PT Maju')->firstOrFail()->checklistItems()->count())->toBe(3);

    // The workspace template stays inside its workspace; invisible templates are 404.
    $other = Workspace::factory()->team()->ownedBy($this->lead)->create(['key' => 'OTH']);
    addMember($other, $this->member);
    $this->postJson('/api/v1/workspace/OTH/tugas-dari-templat', ['template_id' => $own->id, 'title' => 'X'])->assertForbidden();
    $this->postJson('/api/v1/workspace/TMS/tugas-dari-templat', ['template_id' => TaskTemplate::query()->where('name', 'Rahasia')->value('id'), 'title' => 'X'])->assertNotFound();
    $this->postJson('/api/v1/workspace/TMS/tugas-dari-templat', ['template_id' => $company->id])->assertUnprocessable()->assertJsonValidationErrors('title');

    // A viewer cannot create tasks; an outsider cannot even see the workspace.
    sebagaiA2($this->viewer);
    $this->postJson('/api/v1/workspace/TMS/tugas-dari-templat', ['template_id' => $company->id, 'title' => 'X'])->assertForbidden();
    sebagaiA2($this->outsider);
    $this->postJson('/api/v1/workspace/TMS/tugas-dari-templat', ['template_id' => $company->id, 'title' => 'X'])->assertNotFound();
});

test('every B3-A2 endpoint rejects requests without a token', function () {
    sebagaiA2(null);
    $id = $this->team->id;

    foreach ([
        ['getJson', "/api/v1/workspace/{$id}"], ['postJson', '/api/v1/workspace'], ['getJson', '/api/v1/workspace/templat'],
        ['postJson', "/api/v1/workspace/{$id}/favorit"], ['getJson', "/api/v1/workspace/{$id}/tugas"],
        ['getJson', "/api/v1/workspace/{$id}/kalender"], ['getJson', "/api/v1/workspace/{$id}/aktivitas"],
        ['getJson', "/api/v1/workspace/{$id}/dokumen"], ['getJson', "/api/v1/workspace/{$id}/file"],
        ['getJson', "/api/v1/workspace/{$id}/pengaturan"], ['postJson', "/api/v1/workspace/{$id}/anggota"],
        ['getJson', '/api/v1/otomasi/aturan'], ['getJson', '/api/v1/otomasi/berulang'],
    ] as [$method, $url]) {
        $this->{$method}($url)->assertUnauthorized();
    }
});

test('a personal workspace keeps its owner role and never leaks to others', function () {
    $personal = app(EnsurePersonalWorkspace::class)->handle($this->member);
    app(DefaultTaskStatuses::class)->ensure($personal);

    sebagaiA2($this->member);
    $this->getJson("/api/v1/workspace/{$personal->id}")->assertOk()
        ->assertJsonPath('my_role', 'owner')->assertJsonPath('read_only.read_only', false)->assertJsonPath('can.manage', true);

    sebagaiA2($this->direksi);
    $this->getJson("/api/v1/workspace/{$personal->id}")->assertNotFound();
});
