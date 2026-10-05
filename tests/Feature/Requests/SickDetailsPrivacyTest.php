<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Actions\SaveApprovalDelegation;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Search\Providers\RequestSearchProvider;
use App\Http\Presenters\RequestPresenter;
use App\Models\EmployeeRequest;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

/*
 * Fitur pengajuan #5: a substitute approver (delegate) of a sick request sees
 * dates, duration and status only — never the reason, decision notes or attachments.
 */

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    Storage::fake('local');
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
    // Substitute approver from another part of the company (no line management, no view_all).
    $this->substitute = User::factory()->withRole(Role::Anggota)->create(['name' => 'Bima Sakti']);
    $this->outsider = User::factory()->withRole(Role::Anggota)->create();

    app(SaveApprovalDelegation::class)->handle($this->s->manager, [
        'delegate_id' => $this->substitute->id,
        'starts_on' => '2026-10-05',
        'ends_on' => '2026-10-09',
    ]);
});

function sickRequest(RequestScenario $s): EmployeeRequest
{
    return $s->submit($s->employee, $s->sick, [
        'start_date' => '2026-10-05',
        'end_date' => '2026-10-06',
        'reason' => 'Demam berdarah, rawat jalan.',
        'attachments' => [UploadedFile::fake()->create('surat dokter.pdf', 50, 'application/pdf')],
    ]);
}

it('routes the step to the substitute approver', function () {
    $request = sickRequest($this->s);
    $step = $request->waitingStep();

    expect($step?->approver_id)->toBe($this->substitute->id)
        ->and($step?->delegated_from_id)->toBe($this->s->manager->id)
        ->and(Gate::forUser($this->substitute)->allows('decide', $request))->toBeTrue();
});

it('withholds health details only from someone who decides via delegation', function (string $who, bool $view, bool $health) {
    $s = $this->s;
    $request = sickRequest($s);
    $actor = match ($who) {
        'requester' => $s->employee,
        'hr' => $s->hr,
        'direksi' => $s->direksi,
        'direct approver (delegator)' => $s->manager,
        'substitute approver' => $this->substitute,
        'outsider' => $this->outsider,
    };

    expect(Gate::forUser($actor)->allows('view', $request))->toBe($view)
        ->and(Gate::forUser($actor)->allows('viewHealthDetails', $request))->toBe($health)
        ->and(Gate::forUser($actor)->allows('viewAttachment', $request))->toBe($health);
})->with([
    ['requester', true, true],
    ['hr', true, true],
    ['direksi', true, true],
    ['direct approver (delegator)', true, true],
    ['substitute approver', true, false],
    ['outsider', false, false],
]);

it('keeps full details of non-sick requests for the substitute approver', function () {
    $s = $this->s;
    $leave = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-07', 'end_date' => '2026-10-07', 'reason' => 'Acara keluarga.']);

    expect(Gate::forUser($this->substitute)->allows('viewHealthDetails', $leave))->toBeTrue();

    $this->actingAs($this->substitute)->get("/persetujuan/{$leave->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.reason', 'Acara keluarga.')
            ->where('request.health_details_hidden', false));
});

it('shows the substitute dates, duration and status only', function () {
    $s = $this->s;
    $request = sickRequest($s);

    $this->actingAs($this->substitute)->get("/persetujuan/{$request->id}")
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('approvals/show')
            ->where('request.health_details_hidden', true)
            ->where('request.reason', '')
            ->where('request.attachments', [])
            ->where('request.days', 2)
            ->where('request.status', 'pending')
            ->where('request.start_at', $request->start_at->toIso8601String())
            ->where('request.can.decide', true));

    $this->actingAs($s->manager)->get("/persetujuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.health_details_hidden', false)
            ->where('request.reason', 'Demam berdarah, rawat jalan.')
            ->has('request.attachments', 1));

    $this->actingAs($s->hr)->get("/pengajuan/{$request->id}")
        ->assertInertia(fn (Assert $page) => $page
            ->where('request.reason', 'Demam berdarah, rawat jalan.')
            ->has('request.attachments', 1));
});

it('hides earlier decision notes from the substitute in the timeline', function () {
    $s = $this->s;
    $reviewer = User::factory()->withRole(Role::Anggota)->create(['name' => 'Rina Reviewer']);
    // Step 1 Atasan langsung (Dimas → delegated to Bima), step 2 a named user without delegation.
    $s->useFlow($s->sick, [[ApproverType::User, $reviewer], [ApproverType::DirectManager]]);

    $request = sickRequest($s);
    $request = $s->approve($reviewer, $request, 'Surat dokter: DBD, sudah dicek.');

    $detail = app(RequestPresenter::class)->detail($request->fresh() ?? $request, $this->substitute);
    $first = collect($detail['timeline'])->firstWhere('step_order', 1);

    expect($detail['health_details_hidden'])->toBeTrue()
        ->and($first['status'])->toBe('approved')
        ->and($first['note'])->toBeNull();

    $full = app(RequestPresenter::class)->detail($request->fresh() ?? $request, $s->hr);
    expect(collect($full['timeline'])->firstWhere('step_order', 1)['note'])->toBe('Surat dokter: DBD, sudah dicek.');
});

it('refuses the attachment download to the substitute approver', function () {
    $s = $this->s;
    $request = sickRequest($s);
    $attachment = $request->attachments()->sole();
    $url = "/pengajuan/{$request->id}/lampiran/{$attachment->id}";

    $this->actingAs($this->substitute)->get($url)->assertForbidden();
    $this->actingAs($this->outsider)->get($url)->assertForbidden();
    $this->actingAs($s->manager)->get($url)->assertOk();
    $this->actingAs($s->hr)->get($url)->assertOk();
    $this->actingAs($s->employee)->get($url)->assertOk();
});

it('does not let the substitute find a sick request by its reason', function () {
    $s = $this->s;
    sickRequest($s);
    $search = app(RequestSearchProvider::class);

    expect($search->search($this->substitute, 'Demam', 10))->toBe([])
        ->and($search->search($this->substitute, 'Rizky', 10))->toHaveCount(1)
        ->and($search->search($s->employee, 'Demam', 10))->toHaveCount(1);
});
