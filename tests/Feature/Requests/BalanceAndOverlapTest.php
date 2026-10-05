<?php

use App\Domain\Requests\Actions\CancelRequest;
use App\Domain\Requests\Actions\RequestRevision;
use App\Domain\Requests\Actions\SubmitRequest;
use App\Domain\Requests\Enums\ApprovalStatus;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\LeaveBalance;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
    $this->s = RequestScenario::make();
});

function balanceOf(RequestScenario $s): LeaveBalance
{
    return LeaveBalance::query()->where(['user_id' => $s->employee->id, 'leave_type_id' => $s->annual->id, 'year' => 2026])->sole();
}

it('never lets a balance go negative', function () {
    $s = $this->s;

    // 13 working days (12–28 Oct) > 12 available.
    expect(fn () => $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-28']))
        ->toThrow(ValidationException::class, 'Saldo cuti tahunan tidak cukup: sisa 12 hari, diajukan 13 hari.');

    // Pending days count: 7 + 7 > 12.
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-20']);
    expect(balanceOf($s)->pending_days)->toBe(7.0);
    expect(fn () => $s->submit($s->employee, $s->annual, ['start_date' => '2026-11-02', 'end_date' => '2026-11-10']))
        ->toThrow(ValidationException::class, 'sisa 5 hari, diajukan 7 hari');

    expect(balanceOf($s)->pending_days)->toBe(7.0);
});

it('rejects negative balances at the database level too', function () {
    $s = $this->s;
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);

    expect(fn () => DB::transaction(fn () => balanceOf($s)->forceFill(['used_days' => 12])->save()))
        ->toThrow(QueryException::class);
});

it('moves pending to used on approval and back on cancel', function () {
    $s = $this->s;
    $first = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);
    $second = $s->submit($s->employee, $s->annual, ['start_date' => '2026-11-02', 'end_date' => '2026-11-04']);

    expect(balanceOf($s)->pending_days)->toBe(5.0);

    app(CancelRequest::class)->handle($s->employee, $second);
    expect($second->refresh()->status)->toBe(RequestStatus::Canceled)
        ->and(balanceOf($s)->pending_days)->toBe(2.0);
    expect($second->load('approvals')->currentSteps()->pluck('status')->all())->each->toBe(ApprovalStatus::Skipped);

    $s->approve($s->hr, $s->approve($s->manager, $first));
    expect(balanceOf($s)->pending_days)->toBe(0.0)->and(balanceOf($s)->used_days)->toBe(2.0);

    expect(fn () => app(CancelRequest::class)->handle($s->employee, $first->refresh()))->toThrow(ValidationException::class);
});

it('only lets the requester cancel', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-13']);

    expect(fn () => app(CancelRequest::class)->handle($s->manager, $request))->toThrow(AuthorizationException::class);
});

it('rejects overlapping requests', function () {
    $s = $this->s;
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    expect(fn () => $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-14', 'end_date' => '2026-10-15']))
        ->toThrow(ValidationException::class, 'Tumpang tindih dengan pengajuan CUT-2026-10-0001 (Cuti tahunan, 12–14 Okt 2026).');

    // Different absence categories clash too (sick, trip, permit).
    expect(fn () => $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']))
        ->toThrow(ValidationException::class);
    expect(fn () => $s->submit($s->employee, $s->permit, ['date' => '2026-10-12', 'start_time' => '13:00', 'end_time' => '15:00']))
        ->toThrow(ValidationException::class);

    // Overtime is not an absence; overtime clashes only with overtime.
    $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '17:00', 'end_time' => '20:00']);
    expect(fn () => $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '19:00', 'end_time' => '21:00']))
        ->toThrow(ValidationException::class);
    $s->submit($s->employee, $s->overtime, ['date' => '2026-10-07', 'start_time' => '20:00', 'end_time' => '21:00']);

    // Back-to-back days are fine; other people are unaffected.
    $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-15', 'end_date' => '2026-10-15']);
    $s->submit($s->manager, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);
});

it('does not count canceled or rejected requests as overlapping', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);
    app(CancelRequest::class)->handle($s->employee, $request);

    expect($s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14'])->status)
        ->toBe(RequestStatus::Pending);
});

it('numbers requests per type code and office month without gaps', function () {
    $s = $this->s;

    $a = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-12']);
    $b = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-13']);
    $c = $s->submit($s->employee, $s->sick, ['start_date' => '2026-10-20', 'end_date' => '2026-10-20']);

    // 31 Oct 23:30 Jakarta is still October; 1 Nov 00:30 Jakarta is November (UTC still October).
    $this->travelTo(CarbonImmutable::parse('2026-10-31 23:30', 'Asia/Jakarta'));
    $d = $s->submit($s->employee, $s->annual, ['start_date' => '2026-11-16', 'end_date' => '2026-11-16']);
    $this->travelTo(CarbonImmutable::parse('2026-11-01 00:30', 'Asia/Jakarta'));
    $e = $s->submit($s->employee, $s->annual, ['start_date' => '2026-11-17', 'end_date' => '2026-11-17']);

    expect([$a->number, $b->number, $c->number, $d->number, $e->number])
        ->toBe(['CUT-2026-10-0001', 'CUT-2026-10-0002', 'SKT-2026-10-0001', 'CUT-2026-10-0003', 'CUT-2026-11-0001']);
});

it('keeps the number and starts a new round after a revision', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    app(RequestRevision::class)->handle($s->manager, $request, 'Mohon ubah ke tanggal 13–14 saja.');
    $request->refresh()->load('approvals');

    expect($request->status)->toBe(RequestStatus::RevisionRequested)
        ->and(balanceOf($s)->pending_days)->toBe(0.0)
        ->and($request->currentSteps()[0]->status)->toBe(ApprovalStatus::RevisionRequested);

    $resubmitted = app(SubmitRequest::class)->handle(
        $s->employee,
        RequestScenario::input($s->annual, ['start_date' => '2026-10-13', 'end_date' => '2026-10-14']),
        $request,
    )->fresh('approvals');

    expect($resubmitted->number)->toBe($request->number)
        ->and($resubmitted->round)->toBe(2)
        ->and($resubmitted->status)->toBe(RequestStatus::Pending)
        ->and($resubmitted->days)->toBe(2.0)
        ->and($resubmitted->approvals)->toHaveCount(4)
        ->and($resubmitted->currentSteps()[0]->status)->toBe(ApprovalStatus::Waiting)
        ->and(balanceOf($s)->pending_days)->toBe(2.0);
});

it('refuses to submit a request that is already pending', function () {
    $s = $this->s;
    $request = $s->submit($s->employee, $s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']);

    expect(fn () => app(SubmitRequest::class)->handle($s->employee, RequestScenario::input($s->annual, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']), $request))
        ->toThrow(ValidationException::class);
});
