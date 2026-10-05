<?php

use App\Domain\Organization\Enums\Permission;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Domain\Requests\Services\ColleagueAbsences;
use App\Models\ApprovalDelegation;
use App\Models\EmployeeRequest;
use App\Models\Team;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

it('lists the approver queue with the sidebar badge count', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    $this->actingAs($s->manager)
        ->get('/persetujuan')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('approvals/index')
            ->where('approvals.pending', 1)
            ->where('counts.menunggu', 1)
            ->has('items', 1)
            ->where('items.0.id', $request->id)
            ->where('items.0.step_position', 1)
            ->where('items.0.step_count', 2)
            ->where('selected.can.decide', true)
            ->where('scope', 'Pengajuan anggota Divisi Operasional yang menunggu keputusan Anda.'),
        );

    $this->actingAs($s->hr)->get('/persetujuan')->assertInertia(fn (Assert $page) => $page->where('approvals.pending', 0)->has('items', 0));
    $this->actingAs($s->employee)->get('/dashboard')->assertInertia(fn (Assert $page) => $page->where('approvals.pending', 0));
});

it('approves, rejects and asks for revision over HTTP', function () {
    $s = $this->s;
    $a = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $b = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    $c = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-14', 'end_date' => '2026-10-14']);

    $this->actingAs($s->manager)->post("/persetujuan/{$a->id}/setujui", ['note' => 'OK'])->assertRedirect('/persetujuan');
    $this->actingAs($s->manager)->post("/persetujuan/{$b->id}/tolak", ['note' => ''])->assertSessionHasErrors(['note' => 'Alasan wajib diisi saat menolak.']);
    $this->actingAs($s->manager)->post("/persetujuan/{$b->id}/tolak", ['note' => 'Stok opname.'])->assertRedirect();
    $this->actingAs($s->manager)->post("/persetujuan/{$c->id}/revisi", ['note' => 'Ganti tanggal.', 'redirect' => 'next'])->assertRedirect('/persetujuan');

    expect($a->refresh()->current_step)->toBe(2)
        ->and($b->refresh()->status)->toBe(RequestStatus::Rejected)
        ->and($c->refresh()->status)->toBe(RequestStatus::RevisionRequested);

    // Not their turn / their own request.
    $this->actingAs($s->employee)->post("/persetujuan/{$a->id}/setujui")->assertForbidden();
    $this->actingAs($s->manager)->post("/persetujuan/{$a->id}/setujui")->assertForbidden();

    $this->actingAs($s->hr)->post("/persetujuan/{$a->id}/setujui")->assertRedirect();
    expect($a->refresh()->status)->toBe(RequestStatus::Approved);

    $this->actingAs($s->manager)->get('/persetujuan?tab=diputus')
        ->assertInertia(fn (Assert $page) => $page->where('tab', 'diputus')->has('items', 3)->where('counts.diputus', 3));
});

it('bulk-approves the selected requests and reports failures', function () {
    $s = $this->s;
    $a = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $b = $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '19:00']);
    $foreign = $s->submit($s->manager, $s->annual, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);

    $this->actingAs($s->manager)
        ->post('/persetujuan/massal', ['ids' => [$a->id, $b->id, $foreign->id]])
        ->assertRedirect('/persetujuan');

    expect($a->refresh()->current_step)->toBe(2)
        ->and($b->refresh()->current_step)->toBe(2)
        ->and($foreign->refresh()->current_step)->toBe(1);
});

it('shows the mobile detail with queue position', function () {
    $s = $this->s;
    $first = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $this->travel(5)->minutes();
    $second = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);

    $this->actingAs($s->manager)
        ->get("/persetujuan/{$first->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->component('approvals/show')
            ->where('queue.position', 1)
            ->where('queue.total', 2)
            ->where('queue.next_id', $second->id),
        );

    $this->actingAs($s->manager)
        ->post("/persetujuan/{$first->id}/setujui", ['redirect' => 'next'])
        ->assertRedirect("/persetujuan/{$second->id}");
});

it('manages delegations and reroutes waiting steps immediately', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $delegate = User::factory()->create();

    $this->actingAs($s->manager)
        ->post('/persetujuan/delegasi', ['delegate_id' => $delegate->id, 'starts_on' => '2026-10-05', 'ends_on' => '2026-10-09', 'reason' => 'Cuti'])
        ->assertRedirect()
        ->assertSessionHasNoErrors();

    expect($request->fresh('approvals')->currentSteps()[0]->approver_id)->toBe($delegate->id);

    $this->actingAs($s->manager)
        ->post('/persetujuan/delegasi', ['delegate_id' => $delegate->id, 'starts_on' => '2026-10-08', 'ends_on' => '2026-10-10'])
        ->assertSessionHasErrors('starts_on');
    $this->actingAs($s->manager)
        ->post('/persetujuan/delegasi', ['delegate_id' => $s->manager->id, 'starts_on' => '2026-11-01', 'ends_on' => '2026-11-02'])
        ->assertSessionHasErrors('delegate_id');

    $delegation = ApprovalDelegation::query()->sole();
    $this->actingAs($s->employee)->delete("/persetujuan/delegasi/{$delegation->id}")->assertForbidden();
    $this->actingAs($s->manager)->delete("/persetujuan/delegasi/{$delegation->id}")->assertRedirect();
    expect(ApprovalDelegation::query()->count())->toBe(0);
});

it('bulk-approves role steps for approvers without requests.view_all (review #8)', function () {
    $s = $this->s;
    $s->useFlow($s->annual, [[ApproverType::Role, Role::KepalaDivisi]]);
    // A Kepala Divisi of another division: holds the role, cannot see the request otherwise.
    $otherHead = User::factory()->withRole(Role::KepalaDivisi)->create();
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    expect($otherHead->hasPermission(Permission::RequestsViewAll))->toBeFalse()
        ->and(EmployeeRequest::query()->visibleTo($otherHead)->whereKey($request->id)->exists())->toBeFalse();

    $this->actingAs($otherHead)
        ->post('/persetujuan/massal', ['ids' => [$request->id]])
        ->assertRedirect('/persetujuan');

    expect($request->refresh()->status)->toBe(RequestStatus::Approved);
});

it('builds the approval queue with a fixed number of queries (review #9)', function () {
    $s = $this->s;
    $teams = [Team::factory()->create(['division_id' => $s->division->id]), null];

    $queries = function (int $count) use ($s, $teams): int {
        foreach (range(1, $count) as $i) {
            $employee = User::factory()->inDivision($s->division, $teams[$i % 2])->managedBy($s->manager)->create();
            $s->submit($employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
        }

        $this->actingAs($s->manager)->get('/persetujuan')->assertOk(); // warms the permission cache
        DB::flushQueryLog();
        DB::enableQueryLog();
        $this->actingAs($s->manager)->get('/persetujuan')->assertOk();
        DB::disableQueryLog();

        return count(DB::getQueryLog());
    };

    $few = $queries(2);
    $many = $queries(6); // 8 waiting cards now

    expect($many)->toBe($few);
});

it('shows the same colleague warning on queue cards as on the detail (review #9)', function () {
    $s = $this->s;
    $nadia = User::factory()->inDivision($s->division)->managedBy($s->manager)->create(['name' => 'Nadia Putri']);
    $s->submit($nadia, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    $expected = app(ColleagueAbsences::class)->around($s->employee, $request->start_at, $request->end_at, $request->id);

    $this->actingAs($s->manager)->get('/persetujuan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('items', fn ($items) => collect($items)->firstWhere('id', $request->id)['colleagues'] === $expected));

    expect($expected['people'])->toHaveCount(1)->and($expected['people'][0]['dates'])->toBe(['2026-10-13']);
});
