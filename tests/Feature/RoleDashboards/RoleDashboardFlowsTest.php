<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Projects\Actions\PostProjectUpdate;
use App\Domain\Projects\Enums\ProjectHealth;
use App\Domain\Projects\Notifications\ProjectDirectionNotification;
use App\Domain\Projects\Notifications\ProjectUpdateRequestedNotification;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\RoleDashboards\Enums\DashboardRole;
use App\Domain\Tasks\Enums\TaskStatusCategory;
use App\Domain\Workspaces\Enums\WorkspaceRole;
use App\Models\AuditLog;
use App\Models\Company;
use App\Models\Position;
use App\Models\ProjectDirection;
use App\Models\User;
use App\Models\Workspace;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;
use Tests\Support\RequestScenario;

require_once __DIR__.'/../../Support/project-helpers.php';

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    config(['features.role_dashboards' => true]);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
});

/** Gives $user a position carrying $role. */
function holdJob(User $user, DashboardRole $role): User
{
    $user->forceFill(['position_id' => Position::factory()->create(['dashboard_role' => $role->value])->id])->save();

    return $user;
}

/**
 * Warm gradients on one screen: warm KPIs + a warm side panel (DESIGN.md: at most one).
 *
 * @param  array<string, mixed>  $dashboard
 */
function warmCount(array $dashboard): int
{
    return count(array_filter($dashboard['kpis'], fn (array $kpi): bool => $kpi['tone'] === 'warm'))
        + ($dashboard['side']['warm'] && $dashboard['side']['items'] !== [] ? 1 : 0);
}

describe('HR: tinjau pengajuan', function () {
    beforeEach(function () {
        $this->s = RequestScenario::make();
        holdJob($this->s->hr, DashboardRole::Hr);
        $this->request = $this->s->submit($this->s->employee, $this->s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
        $this->s->approve($this->s->manager, $this->request);
    });

    it('lists the HR step and opens it in the review flow, without attendance blocks', function () {
        $this->actingAs($this->s->hr)->get('/peran/hr')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('roles/show')
                ->missing('dashboard')
                ->where('flow.kind', 'leave-review')
                ->where('flow.total', 1)
                ->where('flow.selected.id', $this->request->id)
                ->where('flow.selected.can.decide', true)
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('dashboard.role', 'hr')
                    ->where('dashboard.flow', 'leave-review')
                    ->where('dashboard.kpis.0.label', 'Menunggu keputusan Anda')
                    ->where('dashboard.kpis.0.value', 1)
                    ->where('dashboard.list.rows.0.id', $this->request->id)
                    ->where('dashboard.list.rows.0.flow', true)
                    ->where('dashboard.secondary.href', '/absensi/hari-ini')
                    ->where('dashboard.kpis', fn ($kpis) => collect($kpis)->pluck('label')->intersect(['Hadir hari ini', 'Perlu ditinjau', 'Cuti & izin hari ini'])->isEmpty())
                    ->where('dashboard', fn ($dashboard) => warmCount($dashboard->toArray()) <= 1)));
    });

    it('approves through the dashboard with the Fase 1 action, audited', function () {
        $this->actingAs($this->s->hr)
            ->from('/peran/hr')
            ->post("/peran/hr/persetujuan/{$this->request->id}/setujui", ['note' => 'Selamat berlibur'])
            ->assertRedirect('/peran/hr')
            ->assertSessionHasNoErrors();

        expect($this->request->refresh()->status)->toBe(RequestStatus::Approved)
            ->and(AuditLog::query()->where('action', 'request.approved')->where('auditable_id', $this->request->id)->exists())->toBeTrue();

        $this->actingAs($this->s->hr)->get('/peran/hr')->assertInertia(fn (Assert $page) => $page->where('flow.total', 0)->where('flow.selected', null));
    });

    it('requires a reason to reject and a note to ask for revision', function () {
        $this->actingAs($this->s->hr)->post("/peran/hr/persetujuan/{$this->request->id}/tolak", ['note' => ''])
            ->assertSessionHasErrors(['note' => 'Alasan wajib diisi saat menolak.']);
        $this->actingAs($this->s->hr)->post("/peran/hr/persetujuan/{$this->request->id}/revisi", [])
            ->assertSessionHasErrors(['note' => 'Catatan wajib diisi saat meminta revisi.']);

        $this->actingAs($this->s->hr)->post("/peran/hr/persetujuan/{$this->request->id}/tolak", ['note' => 'Bertepatan dengan stok opname.'])
            ->assertRedirect();

        expect($this->request->refresh()->status)->toBe(RequestStatus::Rejected)
            ->and(AuditLog::query()->where('action', 'request.rejected')->where('auditable_id', $this->request->id)->exists())->toBeTrue();
    });

    it('respects the approval policy and the job', function () {
        $other = $this->s->submit($this->s->employee, $this->s->annual, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);

        // Step 1 waits for the manager, not HR.
        $this->actingAs($this->s->hr)->post("/peran/hr/persetujuan/{$other->id}/setujui")->assertForbidden();
        // A job without approvals.
        $this->actingAs($this->s->direksi)->post("/peran/dirut/persetujuan/{$this->request->id}/setujui")->assertNotFound();
        // A job the viewer does not hold.
        $this->actingAs($this->s->hr)->post("/peran/direktur/persetujuan/{$this->request->id}/setujui")->assertNotFound();

        expect($other->refresh()->current_step)->toBe(1)
            ->and($this->request->refresh()->status)->toBe(RequestStatus::Pending);
    });

    it('opens another waiting request on demand and ignores foreign ids', function () {
        $second = $this->s->submit($this->s->employee, $this->s->permit, ['start_date' => '2026-10-21', 'end_date' => '2026-10-21']);
        $this->s->approve($this->s->manager, $second);

        $this->actingAs($this->s->hr)->get("/peran/hr?pilih={$second->id}")
            ->assertInertia(fn (Assert $page) => $page->where('flow.selected.id', $second->id)->has('flow.items', 2));

        // Not waiting for HR (still at the manager): falls back to the queue.
        $foreign = $this->s->submit($this->s->employee, $this->s->annual, ['start_date' => '2026-10-27', 'end_date' => '2026-10-27']);
        $this->actingAs($this->s->hr)->get("/peran/hr?pilih={$foreign->id}")
            ->assertInertia(fn (Assert $page) => $page->where('flow.selected.id', $this->request->id));
    });
});

describe('Direktur: persetujuan beruntun', function () {
    beforeEach(function () {
        $this->s = RequestScenario::make();
        $this->s->useFlow($this->s->overtime, [[ApproverType::Role, Role::Direksi]]);
        $this->direktur = holdJob($this->s->direksi, DashboardRole::Direktur);
        $this->a = $this->s->submit($this->s->employee, $this->s->overtime, ['date' => '2026-10-06', 'start_time' => '17:00', 'end_time' => '19:00']);
        $this->b = $this->s->submit($this->s->employee, $this->s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '20:00']);
    });

    it('shows the queue and the portfolio summary only', function () {
        $this->actingAs($this->direktur)->get('/peran/direktur')
            ->assertInertia(fn (Assert $page) => $page
                ->where('flow.kind', 'approvals')
                ->where('flow.total', 2)
                ->has('flow.items', 2)
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('dashboard.kpis.0.label', 'Menunggu persetujuan Anda')
                    ->where('dashboard.kpis.0.value', 2)
                    ->where('dashboard.secondary.href', '/dashboard')
                    ->where('dashboard.kpis', fn ($kpis) => collect($kpis)->pluck('label')->intersect(['Kehadiran hari ini', 'Tugas proyek terlambat'])->isEmpty())
                    ->has('dashboard.list.rows', 2)));
    });

    it('approves and rejects item by item', function () {
        $this->actingAs($this->direktur)->post("/peran/direktur/persetujuan/{$this->a->id}/setujui")->assertRedirect();
        $this->actingAs($this->direktur)->post("/peran/direktur/persetujuan/{$this->b->id}/tolak", ['note' => 'Tidak mendesak.'])->assertRedirect();

        expect($this->a->refresh()->status)->toBe(RequestStatus::Approved)
            ->and($this->b->refresh()->status)->toBe(RequestStatus::Rejected);

        // Already decided: the policy refuses a second decision.
        $this->actingAs($this->direktur)->post("/peran/direktur/persetujuan/{$this->a->id}/setujui")->assertForbidden();
    });

    it('never decides a request of another company', function () {
        $foreignCompany = Company::factory()->create();
        $outsider = User::factory()->withRole(Role::Direksi)->forCompany($foreignCompany)->create();
        holdJob($outsider, DashboardRole::Direktur);

        $this->actingAs($outsider)->post("/peran/direktur/persetujuan/{$this->a->id}/setujui")->assertForbidden();
        expect($this->a->refresh()->status)->toBe(RequestStatus::Pending);
    });
});

describe('Dirut: keputusan proyek', function () {
    beforeEach(function () {
        $owner = User::factory()->withRole(Role::KepalaDivisi)->create();
        $this->dirut = holdJob(User::factory()->withRole(Role::Direksi)->create(['name' => 'Hendra Wijaya']), DashboardRole::Dirut);
        $this->project = makeProject($owner, ['key' => 'DEP', 'name' => 'Dashboard Eksekutif Pemda', 'sponsor_user_id' => $this->dirut->id]);
        $this->pic = memberWithRole($this->project, WorkspaceRole::Member, Role::KepalaDivisi);
        $this->project->forceFill(['lead_user_id' => $this->pic->id])->save();
        $this->update = app(PostProjectUpdate::class)->handle($this->project, $this->pic, [
            'health' => ProjectHealth::OffTrack,
            'summary' => 'API Pemda belum tersedia.',
            'decision_needed' => 'Perpanjang timeline 3 minggu?',
        ]);
    });

    it('lists the open decision with the project progress', function () {
        $this->actingAs($this->dirut)->get('/peran/dirut')
            ->assertInertia(fn (Assert $page) => $page
                ->where('flow.kind', 'decision')
                ->where('flow.total', 1)
                ->where('flow.items.0.id', $this->update->id)
                ->where('flow.items.0.project.key', 'DEP')
                ->where('flow.items.0.can_resolve', true)
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('dashboard.primary.flow', true)
                    ->where('dashboard.kpis.1.label', 'Butuh keputusan Anda')
                    ->where('dashboard.kpis.1.value', 1)
                    ->where('dashboard.kpis.1.tone', 'warm')
                    ->where('dashboard.list.rows.0.id', $this->update->id)
                    ->where('dashboard.secondary.href', '/dashboard')
                    ->where('dashboard.kpis', fn ($kpis) => collect($kpis)->pluck('label')->intersect(['Kehadiran hari ini', 'Tugas proyek terlambat'])->isEmpty())
                    ->where('dashboard', fn ($dashboard) => warmCount($dashboard->toArray()) <= 1)));
    });

    it('records the decision as a direction and closes it, audited', function () {
        $this->actingAs($this->dirut)
            ->post("/peran/dirut/keputusan/{$this->update->id}", ['decision' => 'Setuju perpanjangan 3 minggu.'])
            ->assertRedirect()
            ->assertSessionHasNoErrors();

        $update = $this->update->fresh();
        expect($update?->decision_resolved_at)->not->toBeNull()
            ->and($update?->decision_resolved_by)->toBe($this->dirut->id)
            ->and(ProjectDirection::query()->where('project_update_id', $this->update->id)->value('body'))->toBe('Setuju perpanjangan 3 minggu.')
            ->and(AuditLog::query()->where('action', 'project.decision_resolved')->where('auditable_id', $this->update->id)->exists())->toBeTrue();
        Notification::assertSentTo($this->pic, ProjectDirectionNotification::class);

        // Already resolved.
        $this->actingAs($this->dirut)->post("/peran/dirut/keputusan/{$this->update->id}")->assertForbidden();
    });

    it('closes without a direction when no text is given', function () {
        $this->actingAs($this->dirut)->post("/peran/dirut/keputusan/{$this->update->id}")->assertRedirect();

        expect($this->update->fresh()?->hasOpenDecision())->toBeFalse()
            ->and(ProjectDirection::query()->count())->toBe(0);
    });

    it('asks the PIC for a fresh update', function () {
        $this->actingAs($this->dirut)->post("/peran/dirut/keputusan/{$this->update->id}/minta-update")->assertRedirect();

        Notification::assertSentTo($this->pic, ProjectUpdateRequestedNotification::class);
    });

    it('keeps the decision endpoints for the Direktur Utama job and Direksi', function () {
        // Holder of the dirut position without the Direksi role: no portfolio.view.
        $holder = holdJob(User::factory()->withRole(Role::Anggota)->create(), DashboardRole::Dirut);
        $status = $this->actingAs($holder)->post("/peran/dirut/keputusan/{$this->update->id}")->status();
        expect($status)->toBeIn([403, 404]);

        $this->actingAs($this->dirut)->post("/peran/direktur/keputusan/{$this->update->id}")->assertNotFound();
        expect($this->update->fresh()?->hasOpenDecision())->toBeTrue();
    });
});

describe('division jobs', function () {
    it('shows the division numbers and an honest held card', function () {
        $org = F::org();
        holdJob($org['kadiv'], DashboardRole::Implementer);
        // Created with the division (SyncDivisionWorkspace).
        $board = Workspace::query()->where('type', 'division')->where('division_id', $org['ops']->id)->firstOrFail();
        $late = F::task($board, TaskStatusCategory::Todo, [$org['rizky']], ['title' => 'Instal server klien', 'due_date' => '2026-10-01']);

        $this->actingAs($org['kadiv'])->get('/peran/implementer')
            ->assertInertia(fn (Assert $page) => $page
                ->where('flow', null)
                ->where('division', $org['ops']->id)
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('dashboard.unit', 'Operasional')
                    ->where('dashboard.flow', null)
                    ->where('dashboard.held.title', 'Tiket klien & check-in di klien')
                    ->where('dashboard.primary.href', '/w/'.$board->key)
                    ->where('dashboard.kpis.1.label', 'Tugas terlambat')
                    ->where('dashboard.kpis.1.value', 1)
                    ->where('dashboard.list.rows.0.id', $late->id)
                    ->where('dashboard.list.rows.0.flow', false)));
    });

    it('lets Direksi pick the division, defaulting to the job holder\'s', function () {
        $org = F::org();
        holdJob($org['kadivKeu'], DashboardRole::Analis);

        $this->actingAs($org['direksi'])->get('/peran/analis')
            ->assertInertia(fn (Assert $page) => $page->where('division', $org['keu']->id)->has('divisions', 2));
        $this->actingAs($org['direksi'])->get("/peran/analis?divisi={$org['ops']->id}")
            ->assertInertia(fn (Assert $page) => $page->where('division', $org['ops']->id));
    });

    it('shows a staff holder only their own numbers', function () {
        $org = F::org();
        holdJob($org['rizky'], DashboardRole::Programming);

        $this->actingAs($org['rizky'])->get('/peran/programming')
            ->assertInertia(fn (Assert $page) => $page
                ->where('division', null)
                ->has('divisions', 0)
                ->loadDeferredProps(fn (Assert $reload) => $reload
                    ->where('dashboard.subtitle', 'Data Anda sendiri')
                    ->where('dashboard.secondary', null)));
    });
});
