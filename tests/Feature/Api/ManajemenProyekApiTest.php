<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Enums\RiskLevel;
use App\Domain\Projects\Enums\RiskStatus;
use App\Models\Milestone;
use App\Models\ProjectDirection;
use App\Models\ProjectRisk;
use App\Models\ProjectUpdate;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\Support\AnalyticsFixtures as F;

require_once __DIR__.'/../../Support/project-helpers.php';

/*
| API v1 — Portofolio & proyek (Bagian 5 / B5-A): portofolio Direksi / proyek
| divisi Kadiv, detail proyek + `can`, riwayat update, aksi PIC (update,
| milestone, risiko) dan aksi Direksi (minta update, arahan, tandai keputusan
| selesai) — Query/Action/Policy web yang sama. Selasa 13 Okt 2026 10.00 WIB.
|
| PLQ (privat, divisi utama Operasional): pemilik = pengguna lain, PIC Sari,
| anggota Rizky, sponsor Hendra (Direksi). Dimas (Kadiv Operasional) melihat
| lewat divisinya (baca saja), HR & Direksi lihat saja, Budi (staf Keuangan)
| dan Lestari (Kadiv Keuangan) tidak melihat PLQ. AUD = proyek Keuangan.
*/

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-13 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();

    $owner = User::factory()->withRole(Role::Anggota)->create(['name' => 'Pemilik Proyek']);
    $this->plq = makeProject($owner, [
        'key' => 'PLQ',
        'name' => 'Peluncuran Q4',
        'division_id' => $org['ops']->id,
        'sponsor_user_id' => $org['direksi']->id,
        'start_date' => '2026-09-01',
        'target_date' => '2026-10-27',
    ]);
    addMember($this->plq, $org['sari']);
    addMember($this->plq, $org['rizky']);
    $this->plq->forceFill(['lead_user_id' => $org['sari']->id, 'health' => ProjectHealth::AtRisk, 'last_update_at' => now()->subDays(2)])->save();

    projectTasks($this->plq, 'done', 2);
    projectTasks($this->plq, 'todo', 2, ['due_date' => '2026-10-01']);

    $this->missed = Milestone::factory()->create(['workspace_id' => $this->plq->id, 'name' => 'Konsep disetujui', 'target_date' => '2026-10-05']);
    $this->next = Milestone::factory()->create(['workspace_id' => $this->plq->id, 'name' => 'Uji coba', 'target_date' => '2026-10-20']);

    $this->decision = ProjectUpdate::factory()->withDecision('Tambahan anggaran vendor video.')->create([
        'workspace_id' => $this->plq->id,
        'author_id' => $org['sari']->id,
        'health' => ProjectHealth::AtRisk,
        'summary' => 'Landing page 4/7 bagian.',
        'created_at' => now()->subDays(2),
    ]);

    ProjectRisk::factory()->create(['workspace_id' => $this->plq->id, 'title' => 'Vendor video telat', 'level' => RiskLevel::High]);
    ProjectRisk::factory()->create(['workspace_id' => $this->plq->id, 'title' => 'Server lama', 'status' => RiskStatus::Resolved, 'resolved_at' => now()->subDay()]);

    $this->keu = makeProject($org['kadivKeu'], ['key' => 'AUD', 'name' => 'Audit Keuangan', 'division_id' => $org['keu']->id]);
    $this->keu->forceFill(['health' => ProjectHealth::OnTrack, 'last_update_at' => now()])->save();
});

function proyekAs(object $test, string $who): User
{
    $user = $test->org[$who];
    Sanctum::actingAs($user);

    return $user;
}

describe('portofolio', function () {
    it('gives Direksi every project with KPIs, decisions and the feed, without the roadmap', function () {
        proyekAs($this, 'direksi');

        $response = $this->getJson('/api/v1/portofolio')
            ->assertOk()
            ->assertJsonPath('mode', 'direksi')
            ->assertJsonPath('can.steer', true)
            ->assertJsonPath('filters.periode', 'kuartal')
            ->assertJsonPath('kpis.active.count', 2)
            ->assertJsonPath('kpis.decisions.count', 1)
            ->assertJsonPath('kpis.missed_milestones.count', 1)
            ->assertJsonPath('kpis.overdue_tasks.count', 2)
            ->assertJsonPath('decisions.0.id', $this->decision->id)
            ->assertJsonPath('decisions.0.can_resolve', true)
            ->assertJsonPath('decisions.0.project.key', 'PLQ')
            ->assertJsonPath('feed.0.project.key', 'PLQ')
            ->assertJsonMissingPath('roadmap')
            ->assertJsonStructure(['attendance' => ['present', 'total', 'on_leave', 'not_checked_in'], 'health_options', 'division_options', 'completed', 'attention']);

        expect(collect($response->json('projects'))->pluck('key')->all())->toBe(['PLQ', 'AUD'])
            ->and($response->json('projects.0.metrics.actual'))->toEqual(50)
            ->and($response->json('projects.0.next_milestone.name'))->toBe('Uji coba')
            ->and($response->json('projects.0.metrics.flags'))->toContain('missed_milestone');
    });

    it('filters on health and division', function () {
        proyekAs($this, 'direksi');

        $this->getJson('/api/v1/portofolio?status=on_track')->assertOk()
            ->assertJsonPath('filters.status', 'on_track')
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.key', 'AUD');

        $this->getJson('/api/v1/portofolio?divisi='.$this->org['ops']->id)->assertOk()
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.key', 'PLQ');
    });

    it('gives a Kepala Divisi the projects of their division, read only', function () {
        proyekAs($this, 'kadiv');

        $this->getJson('/api/v1/portofolio')
            ->assertOk()
            ->assertJsonPath('mode', 'divisi')
            ->assertJsonPath('can.steer', false)
            ->assertJsonPath('attendance', null)
            ->assertJsonCount(1, 'projects')
            ->assertJsonPath('projects.0.key', 'PLQ')
            ->assertJsonPath('decisions.0.can_resolve', false);
    });

    it('is closed to HR, staff and guests like the web', function () {
        proyekAs($this, 'hr');
        $this->getJson('/api/v1/portofolio')->assertForbidden();

        proyekAs($this, 'rizky');
        $this->getJson('/api/v1/portofolio')->assertForbidden();
    });

    it('needs a token', function () {
        $this->getJson('/api/v1/portofolio')->assertUnauthorized();
    });
});

describe('detail proyek', function () {
    it('shows Direksi the summary with steering abilities in view-only mode', function () {
        proyekAs($this, 'direksi');

        $response = $this->getJson('/api/v1/proyek/PLQ')
            ->assertOk()
            ->assertJsonPath('project.key', 'PLQ')
            ->assertJsonPath('project.lead.name', 'Sari Wulandari')
            ->assertJsonPath('project.sponsor.name', 'Hendra Direksi')
            ->assertJsonPath('can', [
                'post_update' => false,
                'manage_milestones' => false,
                'manage_risks' => false,
                'request_update' => true,
                'give_direction' => true,
                'resolve_decision' => true,
                'view_only' => true,
                'archived' => false,
            ])
            ->assertJsonPath('project_can.steer', true)
            ->assertJsonPath('updates_total', 1)
            ->assertJsonPath('updates.0.id', $this->decision->id)
            ->assertJsonPath('updates.0.can_resolve', true)
            ->assertJsonPath('status_counts.done', 2)
            ->assertJsonStructure(['burnup' => ['points', 'start_date', 'target_date'], 'overdue_tasks', 'team_load' => ['members', 'idle', 'open_total'], 'directions', 'task_options', 'health_options', 'risk_level_options']);

        $milestones = collect($response->json('milestones'))->keyBy('name');
        expect($milestones['Konsep disetujui']['status'])->toBe('missed')
            ->and($milestones['Uji coba']['status'])->toBe('not_started')
            ->and(collect($response->json('risks'))->pluck('status')->all())->toBe(['open', 'resolved'])
            ->and($response->json('task_options'))->toBe([]);
    });

    it('lets the PIC write and resolves the project by ULID too', function () {
        proyekAs($this, 'sari');

        $this->getJson('/api/v1/proyek/'.$this->plq->id)
            ->assertOk()
            ->assertJsonPath('can.post_update', true)
            ->assertJsonPath('can.manage_milestones', true)
            ->assertJsonPath('can.manage_risks', true)
            ->assertJsonPath('can.request_update', false)
            ->assertJsonPath('can.give_direction', false)
            ->assertJsonPath('can.view_only', false)
            ->assertJsonPath('updates.0.can_resolve', false)
            ->assertJsonCount(4, 'task_options');
    });

    it('is read only for a member and for the Kepala Divisi of the main division', function () {
        foreach (['rizky', 'kadiv'] as $who) {
            proyekAs($this, $who);

            $this->getJson('/api/v1/proyek/PLQ')->assertOk()
                ->assertJsonPath('can.post_update', false)
                ->assertJsonPath('can.manage_milestones', false)
                ->assertJsonPath('can.request_update', false)
                ->assertJsonPath('can.view_only', false);
        }
    });

    it('is a 404 for outsiders and for a workspace that is not a project', function () {
        proyekAs($this, 'budi');
        $this->getJson('/api/v1/proyek/PLQ')->assertNotFound();

        proyekAs($this, 'kadivKeu');
        $this->getJson('/api/v1/proyek/PLQ')->assertNotFound();

        $team = Workspace::factory()->internal()->state(['type' => 'team'])->create(['key' => 'TIM']);
        proyekAs($this, 'direksi');
        $this->getJson('/api/v1/proyek/TIM')->assertNotFound();
        $this->getJson('/api/v1/proyek/TIDAKADA')->assertNotFound();
    });

    it('pages the update history newest first with filters', function () {
        foreach (range(1, 11) as $day) {
            ProjectUpdate::factory()->create([
                'workspace_id' => $this->plq->id,
                'author_id' => $this->org['sari']->id,
                'summary' => "Minggu {$day}",
                'created_at' => now()->subDays(20 + $day),
            ]);
        }
        ProjectDirection::query()->create(['workspace_id' => $this->plq->id, 'project_update_id' => $this->decision->id, 'author_id' => $this->org['direksi']->id, 'body' => 'Pakai vendor cadangan.']);

        proyekAs($this, 'rizky');

        $first = $this->getJson('/api/v1/proyek/PLQ/update')->assertOk()
            ->assertJsonPath('filter', 'semua')
            ->assertJsonCount(10, 'updates')
            ->assertJsonPath('updates.0.id', $this->decision->id)
            ->assertJsonPath('updates.0.directions.0.body', 'Pakai vendor cadangan.')
            ->assertJsonPath('updates.0.can_resolve', false)
            ->assertJsonPath('updates.1.summary', 'Minggu 1');

        $cursor = $first->json('next_cursor');
        expect($cursor)->toBe($first->json('updates.9.id'));

        $this->getJson("/api/v1/proyek/PLQ/update?sebelum={$cursor}")->assertOk()
            ->assertJsonCount(2, 'updates')
            ->assertJsonPath('updates.1.summary', 'Minggu 11')
            ->assertJsonPath('next_cursor', null);

        $this->getJson('/api/v1/proyek/PLQ/update?filter=keputusan')->assertOk()->assertJsonCount(1, 'updates');
        $this->getJson('/api/v1/proyek/PLQ/update?filter=arahan')->assertOk()->assertJsonCount(1, 'updates');

        proyekAs($this, 'budi');
        $this->getJson('/api/v1/proyek/PLQ/update')->assertNotFound();
    });
});

describe('aksi PIC', function () {
    it('posts a weekly update with the progress snapshot', function () {
        proyekAs($this, 'sari');

        $this->postJson('/api/v1/proyek/PLQ/update', [
            'health' => 'off_track',
            'summary' => ' Vendor mundur dua minggu. ',
            'blockers' => 'Kontrak belum ditandatangani.',
            'decision_needed' => '',
        ])->assertCreated()
            ->assertJsonPath('message', 'Update proyek terkirim.')
            ->assertJsonPath('update.health', 'off_track')
            ->assertJsonPath('update.summary', 'Vendor mundur dua minggu.')
            ->assertJsonPath('update.decision_needed', null)
            ->assertJsonPath('update.progress_snapshot', 50)
            ->assertJsonPath('update.author.name', 'Sari Wulandari');

        expect($this->plq->fresh()?->health)->toBe(ProjectHealth::OffTrack);
    });

    it('validates the update form in Indonesian', function () {
        proyekAs($this, 'sari');

        $this->postJson('/api/v1/proyek/PLQ/update', ['health' => 'great', 'summary' => ''])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['health', 'summary'])
            ->assertJsonPath('errors.summary.0', 'Ringkasan wajib diisi.');
    });

    it('refuses updates from people who only read the project', function () {
        foreach (['direksi', 'rizky', 'kadiv', 'hr'] as $who) {
            proyekAs($this, $who);
            $this->postJson('/api/v1/proyek/PLQ/update', ['health' => 'on_track', 'summary' => 'x'])->assertForbidden();
        }

        proyekAs($this, 'budi');
        $this->postJson('/api/v1/proyek/PLQ/update', ['health' => 'on_track', 'summary' => 'x'])->assertNotFound();
    });

    it('creates, edits, completes, reopens and deletes a milestone', function () {
        proyekAs($this, 'sari');
        $task = $this->plq->tasks()->firstOrFail();

        $created = $this->postJson('/api/v1/proyek/PLQ/milestone', [
            'name' => 'Siaran pers',
            'target_date' => '2026-10-23',
            'description' => 'Rilis ke media.',
            'task_ids' => [$task->id],
        ])->assertCreated()
            ->assertJsonPath('message', 'Milestone ditambahkan.')
            ->assertJsonPath('milestone.name', 'Siaran pers')
            ->assertJsonPath('milestone.target_date', '2026-10-23')
            ->assertJsonPath('milestone.tasks.0.id', $task->id)
            ->assertJsonPath('milestone.tasks.0.code', 'PLQ-'.$task->number);

        $id = $created->json('milestone.id');

        $this->patchJson("/api/v1/proyek/PLQ/milestone/{$id}", ['name' => 'Siaran pers nasional', 'target_date' => '2026-10-24'])
            ->assertOk()->assertJsonPath('milestone.name', 'Siaran pers nasional');

        $this->patchJson("/api/v1/proyek/PLQ/milestone/{$id}/selesai", ['completed' => true])
            ->assertOk()->assertJsonPath('message', 'Milestone ditandai selesai.')
            ->assertJsonPath('milestone.completed_at', fn ($value) => is_string($value));

        $this->patchJson("/api/v1/proyek/PLQ/milestone/{$id}/selesai", ['completed' => false])
            ->assertOk()->assertJsonPath('message', 'Milestone dibuka kembali.')
            ->assertJsonPath('milestone.completed_at', null);

        $this->patchJson("/api/v1/proyek/PLQ/milestone/{$id}/selesai", [])->assertUnprocessable()->assertJsonValidationErrors('completed');

        $this->deleteJson("/api/v1/proyek/PLQ/milestone/{$id}")->assertNoContent();
        expect(Milestone::query()->find($id))->toBeNull();
    });

    it('validates milestones and scopes them to their project', function () {
        proyekAs($this, 'sari');

        $this->postJson('/api/v1/proyek/PLQ/milestone', ['name' => '', 'target_date' => '13/10/2026'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.name.0', 'Nama milestone wajib diisi.')
            ->assertJsonPath('errors.target_date.0', 'Target tanggal tidak valid.');

        $other = Milestone::factory()->create(['workspace_id' => $this->keu->id]);
        $this->patchJson("/api/v1/proyek/PLQ/milestone/{$other->id}/selesai", ['completed' => true])->assertNotFound();

        proyekAs($this, 'rizky');
        $this->patchJson("/api/v1/proyek/PLQ/milestone/{$this->next->id}/selesai", ['completed' => true])->assertForbidden();
        $this->deleteJson("/api/v1/proyek/PLQ/milestone/{$this->next->id}")->assertForbidden();
    });

    it('manages risks: create, edit, resolve, reopen, delete', function () {
        proyekAs($this, 'sari');

        $id = $this->postJson('/api/v1/proyek/PLQ/risiko', [
            'title' => 'Anggaran iklan terpotong',
            'level' => 'medium',
            'owner_id' => $this->org['rizky']->id,
        ])->assertCreated()
            ->assertJsonPath('risk.title', 'Anggaran iklan terpotong')
            ->assertJsonPath('risk.status', 'open')
            ->assertJsonPath('risk.owner.name', 'Rizky Aditya')
            ->json('risk.id');

        $this->patchJson("/api/v1/proyek/PLQ/risiko/{$id}", ['title' => 'Anggaran iklan dipangkas', 'level' => 'high', 'owner_id' => $this->org['rizky']->id])
            ->assertOk()->assertJsonPath('risk.level', 'high');

        $this->patchJson("/api/v1/proyek/PLQ/risiko/{$id}/status", ['status' => 'resolved'])
            ->assertOk()
            ->assertJsonPath('message', 'Risiko ditandai teratasi.')
            ->assertJsonPath('risk.status', 'resolved')
            ->assertJsonPath('risk.owner.name', 'Rizky Aditya')
            ->assertJsonPath('risk.title', 'Anggaran iklan dipangkas');

        $this->patchJson("/api/v1/proyek/PLQ/risiko/{$id}/status", ['status' => 'open'])
            ->assertOk()->assertJsonPath('message', 'Risiko dibuka lagi.')->assertJsonPath('risk.resolved_at', null);

        $this->patchJson("/api/v1/proyek/PLQ/risiko/{$id}/status", ['status' => 'hilang'])->assertUnprocessable();

        $this->deleteJson("/api/v1/proyek/PLQ/risiko/{$id}")->assertNoContent();
        expect(ProjectRisk::query()->find($id))->toBeNull();
    });

    it('validates the risk owner and refuses readers', function () {
        proyekAs($this, 'sari');

        $this->postJson('/api/v1/proyek/PLQ/risiko', ['title' => 'X', 'level' => 'high', 'owner_id' => $this->org['budi']->id])
            ->assertUnprocessable()
            ->assertJsonPath('errors.owner_id.0', 'Pemilik risiko harus anggota workspace.');

        $risk = ProjectRisk::query()->where('workspace_id', $this->plq->id)->firstOrFail();
        proyekAs($this, 'direksi');
        $this->patchJson("/api/v1/proyek/PLQ/risiko/{$risk->id}/status", ['status' => 'resolved'])->assertForbidden();
        $this->postJson('/api/v1/proyek/PLQ/risiko', ['title' => 'X', 'level' => 'high'])->assertForbidden();
    });
});

describe('aksi Direksi', function () {
    it('requests an update from the PIC', function () {
        proyekAs($this, 'direksi');

        $this->postJson('/api/v1/proyek/PLQ/minta-update', ['note' => 'Mohon kabar vendor.'])
            ->assertOk()
            ->assertJsonPath('message', 'Permintaan update dikirim ke Sari Wulandari.')
            ->assertJsonPath('recipient.id', $this->org['sari']->id);

        $this->postJson('/api/v1/proyek/PLQ/minta-update', ['note' => str_repeat('a', 501)])
            ->assertUnprocessable()->assertJsonPath('errors.note.0', 'Catatan maksimal 500 karakter.');
    });

    it('gives a direction, optionally on an update', function () {
        proyekAs($this, 'direksi');

        $this->postJson('/api/v1/proyek/PLQ/arahan', ['body' => 'Pakai vendor cadangan.', 'project_update_id' => $this->decision->id])
            ->assertCreated()
            ->assertJsonPath('message', 'Arahan terkirim ke PIC.')
            ->assertJsonPath('direction.body', 'Pakai vendor cadangan.')
            ->assertJsonPath('direction.project_update_id', $this->decision->id)
            ->assertJsonPath('direction.author.name', 'Hendra Direksi');

        $foreign = ProjectUpdate::factory()->create(['workspace_id' => $this->keu->id]);
        $this->postJson('/api/v1/proyek/PLQ/arahan', ['body' => 'x', 'project_update_id' => $foreign->id])
            ->assertUnprocessable()->assertJsonPath('errors.project_update_id.0', 'Update proyek tidak ditemukan.');
        $this->postJson('/api/v1/proyek/PLQ/arahan', ['body' => ''])
            ->assertUnprocessable()->assertJsonPath('errors.body.0', 'Tulis arahan untuk PIC.');
    });

    it('marks a decision done once', function () {
        proyekAs($this, 'direksi');

        $this->postJson("/api/v1/proyek/PLQ/update/{$this->decision->id}/keputusan")
            ->assertOk()
            ->assertJsonPath('message', 'Keputusan ditandai selesai.')
            ->assertJsonPath('update.decision_resolved_by', 'Hendra Direksi')
            ->assertJsonPath('update.can_resolve', false);

        $this->postJson("/api/v1/proyek/PLQ/update/{$this->decision->id}/keputusan")
            ->assertForbidden()
            ->assertJsonPath('message', 'Keputusan ini sudah ditandai selesai.');
    });

    it('keeps steering to Direksi and Super Admin', function () {
        foreach (['sari', 'kadiv', 'hr', 'rizky'] as $who) {
            proyekAs($this, $who);
            $this->postJson('/api/v1/proyek/PLQ/minta-update')->assertForbidden();
            $this->postJson('/api/v1/proyek/PLQ/arahan', ['body' => 'Arahan'])->assertForbidden();
            $this->postJson("/api/v1/proyek/PLQ/update/{$this->decision->id}/keputusan")->assertForbidden();
        }

        // Super Admin needs TOTP before the API answers (EnsureApiAccountUsable).
        $this->org['admin']->forceFill(['two_factor_secret' => encrypt('secret'), 'two_factor_recovery_codes' => encrypt('[]'), 'two_factor_confirmed_at' => now()])->save();
        proyekAs($this, 'admin');
        $this->postJson('/api/v1/proyek/PLQ/minta-update')->assertOk();

        proyekAs($this, 'budi');
        $this->postJson('/api/v1/proyek/PLQ/minta-update')->assertNotFound();
    });

    it('refuses steering an archived project', function () {
        $this->plq->forceFill(['archived_at' => now()])->save();
        proyekAs($this, 'direksi');

        $this->getJson('/api/v1/proyek/PLQ')->assertOk()
            ->assertJsonPath('can.request_update', false)
            ->assertJsonPath('can.archived', true);
        $this->postJson('/api/v1/proyek/PLQ/minta-update')->assertForbidden();
    });
});
