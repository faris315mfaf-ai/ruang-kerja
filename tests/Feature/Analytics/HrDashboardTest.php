<?php

use App\Domain\Analytics\Queries\HrDashboard;
use App\Domain\Attendance\Enums\AttendanceStatus;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Attendance\Models\ShiftAssignment;
use App\Domain\Organization\Enums\Role;
use App\Domain\Requests\Enums\ApproverType;
use App\Domain\Requests\Enums\RequestStatus;
use App\Models\EmployeeRequest;
use App\Models\LeaveType;
use App\Models\RequestApproval;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RoleSeeder;
use Illuminate\Database\Eloquent\Collection;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AnalyticsFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    F::reset();
    $this->travelTo(CarbonImmutable::parse('2026-10-07 10:00', 'Asia/Jakarta'));
    $this->org = $org = F::org();
    $regular = Shift::factory()->create(['name' => 'Reguler']);
    $warehouse = Shift::factory()->hours('06:00', '14:00')->create(['name' => 'Gudang Pagi']);

    foreach (['kadiv', 'rizky', 'kadivKeu', 'budi'] as $who) {
        ShiftAssignment::factory()->create(['user_id' => $org[$who]->id, 'shift_id' => $regular->id]);
    }
    ShiftAssignment::factory()->create(['user_id' => $org['sari']->id, 'shift_id' => $warehouse->id]);

    // Today: Rizky late, Sari present, Budi sick, Dimas & Lestari not checked in.
    $this->rizkyDay = F::day($org['rizky'], '2026-10-07', AttendanceStatus::Late, ['shift_id' => $regular->id, 'late_minutes' => 12, 'check_in_at' => F::at('2026-10-07 08:22')]);
    F::day($org['sari'], '2026-10-07', AttendanceStatus::Present, ['shift_id' => $warehouse->id, 'check_in_at' => F::at('2026-10-07 05:57')]);
    F::day($org['budi'], '2026-10-07', AttendanceStatus::Sick, ['shift_id' => $regular->id]);
    // Yesterday: Sari forgot to check out.
    F::day($org['sari'], '2026-10-06', AttendanceStatus::NeedsCorrection, ['shift_id' => $warehouse->id, 'check_in_at' => F::at('2026-10-06 06:02')]);
    F::day($org['rizky'], '2026-10-06', AttendanceStatus::Present, ['shift_id' => $regular->id, 'check_in_at' => F::at('2026-10-06 07:55'), 'check_out_at' => F::at('2026-10-06 17:05')]);
    F::day($org['budi'], '2026-10-05', AttendanceStatus::Absent, ['shift_id' => $regular->id]);
});

/** People in the HR dashboard scope (as DashboardContextResolver loads them). */
function hrPeople(): Collection
{
    return User::query()->active()->with('division:id,name')->orderBy('name')->get();
}

it('shows requests waiting for HR and today\'s attendance numbers only (keputusan pemilik 6 Okt 2026)', function () {
    $this->actingAs($this->org['hr'])->get('/dashboard/hr')
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('dashboard/hr')
            ->where('channels', ["company.{$this->org['hr']->company_id}.attendance"])
            ->where('attendance.counts.scheduled', 5)
            ->where('attendance.counts.present', 2)
            ->where('attendance.counts.late', 1)
            ->where('attendance.counts.away', 1)
            ->where('attendance.counts.sick', 1)
            ->where('attendance.counts.not_checked_in', 2)
            ->where('attendance.shifts', [['name' => 'Reguler', 'count' => 4], ['name' => 'Gudang Pagi', 'count' => 1]])
            ->where('attendance.missing_check_out_count', 1)
            ->where('attendance.review_count', 0)
            ->missing('attendance.people')
            ->missing('attendance.divisions')
            ->missing('review')
            ->missing('missingCheckOut')
            ->missing('recap')
            ->has('pending')
            ->where('hiring', '/hiring'));
});

it('summarizes company attendance today per division (Dashboard Manajemen and role dashboards)', function () {
    $today = app(HrDashboard::class)->today(hrPeople(), CarbonImmutable::now());

    expect($today['divisions'])->toBe([
        ['id' => $this->org['keu']->id, 'name' => 'Keuangan', 'scheduled' => 2, 'present' => 0, 'late' => 0, 'away' => 1, 'not_checked_in' => 1, 'absent' => 0],
        ['id' => $this->org['ops']->id, 'name' => 'Operasional', 'scheduled' => 3, 'present' => 2, 'late' => 1, 'away' => 0, 'not_checked_in' => 1, 'absent' => 0],
    ]);
});

it('does not list night-shift workers still inside their check-out window as missing a check-out', function () {
    // 01.00 WIB: yesterday's 22.00–06.00 night shift is still running (open until 06.00 + grace).
    $this->travelTo(F::at('2026-10-07 01:00'));
    $night = Shift::factory()->night()->create();
    $rudi = User::factory()->withRole(Role::Anggota)->inDivision($this->org['ops'])->create(['name' => 'Rudi Malam']);
    ShiftAssignment::factory()->create(['user_id' => $rudi->id, 'shift_id' => $night->id]);
    F::day($rudi, '2026-10-06', AttendanceStatus::Present, [
        'shift_id' => $night->id,
        'check_in_at' => F::at('2026-10-06 21:55'),
        'scheduled_start' => F::at('2026-10-06 22:00'),
        'scheduled_end' => F::at('2026-10-07 06:00'),
    ]);
    // Sari's 06.00–14.00 shift of yesterday closed long ago: listed.
    AttendanceDay::query()->where('user_id', $this->org['sari']->id)->whereDate('work_date', '2026-10-06')
        ->update(['scheduled_start' => F::at('2026-10-06 06:00'), 'scheduled_end' => F::at('2026-10-06 14:00')]);
    $ids = hrPeople()->modelKeys();
    $query = app(HrDashboard::class);

    $missing = $query->missingCheckOut($this->org['hr'], $ids, CarbonImmutable::now());
    expect($missing['count'])->toBe(1)->and($missing['items'][0]['user']['name'])->toBe('Sari Wulandari');
    $this->actingAs($this->org['hr'])->get('/dashboard/hr')->assertInertia(fn (Assert $page) => $page
        ->where('attendance.missing_check_out_count', 1));

    // Once the window closes (06.00 + grace) the night shift is missing too.
    $this->travelTo(F::at('2026-10-07 12:00'));
    $missing = $query->missingCheckOut($this->org['hr'], $ids, CarbonImmutable::now());
    expect($missing['count'])->toBe(2)->and($missing['items'][1]['user']['name'])->toBe('Rudi Malam');
});

it('counts unreviewed suspicious check-ins and lists them with the selfie link only for those allowed', function () {
    AttendanceLog::factory()->forDay($this->rizkyDay)->create([
        'is_suspicious' => true,
        'flags' => [LogFlag::LowAccuracy, LogFlag::NewIp],
        'accuracy_m' => 180,
        'selfie_path' => 'selfies/x.jpg',
        'occurred_at' => now()->subHour(),
    ]);
    AttendanceLog::factory()->forDay($this->rizkyDay)->create(['is_suspicious' => true, 'reviewed_at' => now(), 'occurred_at' => now()->subHour()]);
    AttendanceLog::factory()->forDay($this->rizkyDay)->create(['is_suspicious' => true, 'occurred_at' => now()->subDays(9)]);

    $this->actingAs($this->org['hr'])->get('/dashboard/hr')
        ->assertInertia(fn (Assert $page) => $page->where('attendance.review_count', 1));

    $ids = hrPeople()->modelKeys();
    $review = app(HrDashboard::class)->review($this->org['hr'], $ids, CarbonImmutable::now());
    expect($review['count'])->toBe(1)
        ->and($review['items'][0]['flags'])->toBe([['key' => 'low_accuracy', 'label' => 'Akurasi GPS rendah']])
        ->and($review['items'][0]['selfie_url'])->toContain('signature=')
        ->and($review['items'][0]['can_review'])->toBeTrue();

    // Direksi may not open selfies nor mark reviews.
    $asDireksi = app(HrDashboard::class)->review($this->org['direksi'], $ids, CarbonImmutable::now());
    expect($asDireksi['items'][0]['selfie_url'])->toBeNull()
        ->and($asDireksi['items'][0]['can_review'])->toBeFalse();
});

it('lists requests waiting for HR', function () {
    $type = LeaveType::factory()->create();
    $waiting = EmployeeRequest::factory()->status(RequestStatus::Pending)->create(['user_id' => $this->org['budi']->id, 'leave_type_id' => $type->id]);
    RequestApproval::factory()->create(['request_id' => $waiting->id, 'approver_type' => ApproverType::Role, 'approver_role' => 'hr']);
    $manager = EmployeeRequest::factory()->status(RequestStatus::Pending)->create(['user_id' => $this->org['rizky']->id, 'leave_type_id' => $type->id]);
    RequestApproval::factory()->create(['request_id' => $manager->id, 'approver_id' => $this->org['kadiv']->id]);

    $this->actingAs($this->org['hr'])->get('/dashboard/hr')
        ->assertInertia(fn (Assert $page) => $page
            ->where('pending.count', 1)
            ->where('pending.items.0.id', $waiting->id));
});

it('recaps discipline for the period with an 8-week trend (now in Absensi › Kedisiplinan)', function () {
    // Month to date (1–7 Oct) rows: Rizky late + present, Sari present + needs correction, Budi absent (sick excused).
    $this->actingAs($this->org['hr'])->get('/absensi/kedisiplinan')
        ->assertInertia(fn (Assert $page) => $page->loadDeferredProps(fn (Assert $reload) => $reload
            ->where('report.kpis.attendance_discipline', ['value' => 40, 'numerator' => 2, 'denominator' => 5, 'previous' => null, 'delta' => null])
            ->where('report.kpis.average_lateness.value', 12)
            ->where('report.kpis.absent_days.value', 1)
            ->where('report.kpis.late_days.value', 1)
            ->has('report.trend', 8)
            ->where('report.trend.7.denominator', 5)));
});

it('filters the HR dashboard by division', function () {
    $this->actingAs($this->org['hr'])->get('/dashboard/hr?divisi='.$this->org['keu']->id)
        ->assertInertia(fn (Assert $page) => $page
            ->where('scope.label', 'Keuangan')
            ->where('attendance.counts.scheduled', 2)
            ->where('attendance.missing_check_out_count', 0));
});

it('counts a half-day leave or business trip with a check-in as present (as the Absensi board)', function () {
    $regular = Shift::query()->where('name', 'Reguler')->value('id');
    F::day($this->org['kadiv'], '2026-10-07', AttendanceStatus::Leave, ['shift_id' => $regular, 'request_portion' => 'half_day', 'check_in_at' => F::at('2026-10-07 12:55')]);
    F::day($this->org['kadivKeu'], '2026-10-07', AttendanceStatus::BusinessTrip, ['shift_id' => $regular, 'request_portion' => 'full', 'check_in_at' => F::at('2026-10-07 08:00')]);

    $this->actingAs($this->org['hr'])->get('/dashboard/hr')->assertInertia(fn (Assert $page) => $page
        ->where('attendance.counts.scheduled', 5)
        ->where('attendance.counts.present', 4)
        ->where('attendance.counts.away', 1)
        ->where('attendance.counts.business_trip', 0)
        ->where('attendance.counts.not_checked_in', 0));
});

it('offers "Koreksi" only to those allowed, and review + correction clear the HR card', function () {
    $log = AttendanceLog::factory()->forDay($this->rizkyDay)->create(['is_suspicious' => true, 'occurred_at' => now()->subHour()]);
    $ids = hrPeople()->modelKeys();

    expect(app(HrDashboard::class)->missingCheckOut($this->org['hr'], $ids, CarbonImmutable::now())['items'][0]['can_correct'])->toBeTrue()
        ->and(app(HrDashboard::class)->missingCheckOut($this->org['direksi'], $ids, CarbonImmutable::now())['items'][0]['can_correct'])->toBeFalse();

    $this->actingAs($this->org['hr'])->from('/absensi/hari-ini')
        ->post(route('attendance.logs.review', $log))
        ->assertRedirect('/absensi/hari-ini');
    expect($log->refresh()->reviewed_at)->not->toBeNull();

    $this->actingAs($this->org['hr'])->from('/absensi/hari-ini')
        ->post(route('attendance.corrections.store'), ['user_id' => $this->org['sari']->id, 'work_date' => '2026-10-06', 'check_out' => '14:05', 'reason' => 'Lupa check-out, dikonfirmasi atasan'])
        ->assertRedirect('/absensi/hari-ini')
        ->assertSessionHasNoErrors();

    $this->actingAs($this->org['hr'])->get('/dashboard/hr')->assertInertia(fn (Assert $page) => $page
        ->where('attendance.review_count', 0)
        ->where('attendance.missing_check_out_count', 0));
});

it('links the Hiring card to the Hiring module', function () {
    $this->actingAs($this->org['hr'])->get('/dashboard/hr')
        ->assertInertia(fn (Assert $page) => $page->where('hiring', '/hiring'));
});
