<?php

use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\RequestCategory;
use App\Domain\Requests\Services\BalanceLedger;
use App\Domain\Requests\Services\RequestDurationCalculator;
use App\Models\ApprovalFlow;
use App\Models\Company;
use App\Models\LeaveBalance;
use App\Models\LeaveType;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RequestSeeder;
use Database\Seeders\RoleSeeder;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\RequestScenario;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    Notification::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 09:00', 'Asia/Jakarta'));
});

it('seeds the new leave defaults as provisional, with their rules', function () {
    Company::factory()->create();
    $this->seed(RequestSeeder::class);

    $types = LeaveType::query()->with('approvalFlow')->get()->keyBy('code');

    expect($types->keys()->sort()->values()->all())->toBe(['CAP', 'CBR', 'CLT', 'CML', 'CUT', 'DNS', 'IZN', 'KOR', 'LBR', 'SKT'])
        ->and($types->every(fn (LeaveType $type): bool => $type->is_provisional_default))->toBeTrue();

    // Cuti & lembur are locked until the SOP exists (keputusan pemilik 6 Okt 2026).
    expect($types->filter(fn (LeaveType $type): bool => $type->isLocked())->keys()->sort()->values()->all())
        ->toBe(['CAP', 'CBR', 'CLT', 'CML', 'CUT', 'LBR'])
        ->and($types->get('CUT')?->locked_reason)->toBe(LeaveType::SOP_LOCK_REASON);

    // Izin stays one type (per jam / per hari toggle on the form).
    expect($types->filter(fn (LeaveType $type): bool => $type->category === RequestCategory::Permit))->toHaveCount(1);

    $maternity = $types->get('CML');
    expect($maternity->category)->toBe(RequestCategory::Leave)
        ->and($maternity->counts_calendar_days)->toBeTrue()
        ->and($maternity->max_days_per_request)->toBe(90.0)
        ->and($maternity->hasQuota())->toBeFalse()
        ->and($maternity->requires_attachment_after_days)->toBe(0)
        ->and($maternity->is_paid)->toBeTrue();

    $important = $types->get('CAP');
    expect($important->counts_calendar_days)->toBeFalse()
        ->and($important->max_days_per_request)->toBe(3.0)
        ->and($important->hasQuota())->toBeFalse();

    $unpaid = $types->get('CLT');
    expect($unpaid->is_paid)->toBeFalse()
        ->and($unpaid->hasQuota())->toBeFalse()
        ->and($unpaid->approvalFlow?->name)->toBe('Cuti besar');
});

it('never overwrites a type HR edited when seeding again', function () {
    Company::factory()->create();
    $this->seed(RequestSeeder::class);

    $hr = User::factory()->withRole(Role::Hr)->create();
    $maternity = LeaveType::query()->where('code', 'CML')->sole();

    $this->actingAs($hr)->put("/admin/pengajuan/jenis/{$maternity->id}", [
        'code' => 'CML', 'name' => 'Cuti melahirkan (perusahaan)', 'category' => 'leave',
        'requires_attachment_after_days' => 0, 'counts_calendar_days' => true, 'max_days_per_request' => 120,
    ])->assertSessionHasNoErrors();

    expect($maternity->refresh()->is_provisional_default)->toBeFalse()
        ->and($maternity->max_days_per_request)->toBe(120.0);

    // A deleted default is not brought back either.
    LeaveType::query()->where('code', 'CAP')->sole()->delete();

    $this->seed(RequestSeeder::class);

    expect($maternity->refresh()->name)->toBe('Cuti melahirkan (perusahaan)')
        ->and($maternity->max_days_per_request)->toBe(120.0)
        ->and($maternity->is_provisional_default)->toBeFalse()
        ->and(LeaveType::query()->where('code', 'CAP')->exists())->toBeFalse()
        ->and(LeaveType::withTrashed()->where('code', 'CAP')->count())->toBe(1);
});

it('clears the provisional marker when HR assigns a flow to the type', function () {
    $s = RequestScenario::make();
    $s->annual->update(['is_provisional_default' => true]);

    $this->actingAs($s->hr)->post('/admin/pengajuan/alur', [
        'name' => 'Alur cuti',
        'leave_type_id' => $s->annual->id,
        'steps' => [['approver_type' => 'direct_manager']],
    ])->assertSessionHasNoErrors();

    expect($s->annual->refresh()->is_provisional_default)->toBeFalse();
});

it('shows the provisional marker to HR and on the request form', function () {
    $s = RequestScenario::make();
    $s->annual->update(['is_provisional_default' => true]);

    $this->actingAs($s->hr)->get('/admin/pengajuan')
        ->assertInertia(fn (Assert $page) => $page
            ->where('types.0.code', 'CUT')
            ->where('types.0.is_provisional_default', true)
            ->where('types.1.is_provisional_default', false));

    $this->actingAs($s->employee)->get('/pengajuan/baru')
        ->assertInertia(fn (Assert $page) => $page
            ->where('categories.0.types.0.is_provisional_default', true)
            ->where('categories.0.types.0.day_unit', 'hari kerja'));
});

it('counts calendar days and enforces the per-request maximum', function () {
    $s = RequestScenario::make();
    $calc = app(RequestDurationCalculator::class);
    $maternity = LeaveType::factory()->category(RequestCategory::Leave)->withoutQuota()->withFlow($s->flow)
        ->create(['code' => 'CML', 'counts_calendar_days' => true, 'max_days_per_request' => 90, 'allow_half_day' => false]);

    // Sat 10 Oct – Fri 16 Oct: 7 calendar days (5 working days are marked on attendance).
    $period = $calc->compute($s->employee, RequestScenario::input($maternity, ['start_date' => '2026-10-10', 'end_date' => '2026-10-16']));
    expect($period->days)->toBe(7.0)
        ->and($period->workDates)->toHaveCount(5);

    // A weekend alone is still a valid calendar-day period.
    expect($calc->compute($s->employee, RequestScenario::input($maternity, ['start_date' => '2026-10-10', 'end_date' => '2026-10-11']))->days)->toBe(2.0);

    // 12 Oct 2026 + 89 days = 9 Jan 2027: exactly 90 days is fine, 91 is not.
    expect($calc->compute($s->employee, RequestScenario::input($maternity, ['start_date' => '2026-10-12', 'end_date' => '2027-01-09']))->days)->toBe(90.0);
    expect(fn () => $calc->compute($s->employee, RequestScenario::input($maternity, ['start_date' => '2026-10-12', 'end_date' => '2027-01-10'])))
        ->toThrow(ValidationException::class, 'Maksimal 90 hari kalender per pengajuan');

    $important = LeaveType::factory()->category(RequestCategory::Leave)->withoutQuota()->withFlow($s->flow)
        ->create(['code' => 'CAP', 'name' => 'Cuti alasan penting', 'max_days_per_request' => 3]);

    // Mon–Wed = 3 working days; Mon–Thu = 4 → too many.
    expect($calc->compute($s->employee, RequestScenario::input($important, ['start_date' => '2026-10-12', 'end_date' => '2026-10-14']))->days)->toBe(3.0);
    expect(fn () => $calc->compute($s->employee, RequestScenario::input($important, ['start_date' => '2026-10-12', 'end_date' => '2026-10-15'])))
        ->toThrow(ValidationException::class, 'Maksimal 3 hari kerja per pengajuan untuk cuti alasan penting.');
});

it('does not deduct unpaid leave from the annual balance', function () {
    $s = RequestScenario::make();
    $unpaid = LeaveType::factory()->category(RequestCategory::Leave)->withoutQuota()->withFlow($s->flow)
        ->create(['code' => 'CLT', 'name' => 'Cuti di luar tanggungan', 'is_paid' => false]);

    $request = $s->submit($s->employee, $unpaid, ['start_date' => '2026-10-12', 'end_date' => '2026-10-16']);
    $s->approve($s->manager, $request);
    $s->approve($s->hr, $request->fresh() ?? $request);

    expect($request->fresh()?->status->value)->toBe('approved')
        ->and(app(BalanceLedger::class)->balanceFor($s->employee, $unpaid, 2026))->toBeNull()
        ->and(LeaveBalance::query()->where('user_id', $s->employee->id)->sum('used_days'))->toEqual(0);
});

it('saves calendar-day and maximum rules from the admin dialog, only where they apply', function () {
    $s = RequestScenario::make();

    $this->actingAs($s->hr)->post('/admin/pengajuan/jenis', [
        'code' => 'CML', 'name' => 'Cuti melahirkan', 'category' => 'leave',
        'counts_calendar_days' => true, 'max_days_per_request' => 90,
    ])->assertSessionHasNoErrors();

    $type = LeaveType::query()->where('code', 'CML')->sole();
    expect($type->counts_calendar_days)->toBeTrue()
        ->and($type->max_days_per_request)->toBe(90.0)
        ->and($type->is_provisional_default)->toBeFalse();

    $this->actingAs($s->hr)->put("/admin/pengajuan/jenis/{$s->overtime->id}", [
        'code' => 'LBR', 'name' => 'Lembur', 'category' => 'overtime', 'counts_calendar_days' => true, 'max_days_per_request' => 3,
    ])->assertSessionHasNoErrors();

    expect($s->overtime->refresh()->counts_calendar_days)->toBeFalse()
        ->and($s->overtime->max_days_per_request)->toBeNull();

    $this->actingAs($s->hr)->post('/admin/pengajuan/jenis', [
        'code' => 'XYZ', 'name' => 'Salah', 'category' => 'leave', 'max_days_per_request' => 0,
    ])->assertSessionHasErrors(['max_days_per_request' => 'Minimal 0,5 hari.']);

    expect(ApprovalFlow::query()->count())->toBe(1);
});
