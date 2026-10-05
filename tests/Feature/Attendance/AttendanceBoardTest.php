<?php

use App\Domain\Attendance\Enums\AttendanceStatus as S;
use App\Domain\Attendance\Enums\LogFlag;
use App\Domain\Attendance\Models\AttendanceDay;
use App\Domain\Attendance\Models\AttendanceLog;
use App\Domain\Attendance\Models\Shift;
use App\Domain\Organization\Enums\Role;
use App\Models\AuditLog;
use App\Models\Division;
use App\Models\User;
use Database\Seeders\RoleSeeder;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\AttendanceFixtures as F;

beforeEach(function () {
    $this->seed(RoleSeeder::class);
    $this->travelTo(F::at('2026-10-05 09:15'));
    $this->office = F::office();
    $this->ops = Division::factory()->create(['name' => 'Operasional']);
    $this->finance = Division::factory()->create(['name' => 'Keuangan']);
    $this->hr = User::factory()->withRole(Role::Hr)->create(['name' => 'Hana HR']);
    $this->kadiv = User::factory()->withRole(Role::KepalaDivisi)->inDivision($this->ops)->create(['name' => 'Dimas Kadiv']);

    $make = function (string $name, Division $division, ?S $status = null, array $extra = []): User {
        $user = F::employee(shift: Shift::factory()->create(['office_location_id' => $this->office->id]));
        $user->update(['name' => $name, 'division_id' => $division->id]);

        if ($status !== null) {
            AttendanceDay::factory()->for($user)->on('2026-10-05')->status($status)->create($extra);
        }

        return $user;
    };

    $this->sari = $make('Sari Wulandari', $this->ops, S::Present, ['check_in_at' => F::at('2026-10-05 07:52')->utc()]);
    $this->bayu = $make('Bayu Saputra', $this->ops, S::Late, ['check_in_at' => F::at('2026-10-05 08:20')->utc(), 'late_minutes' => 10]);
    $this->nadia = $make('Nadia Putri', $this->ops, S::Leave);
    $this->fitri = $make('Fitri Handayani', $this->finance);
    $this->agus = $make('Agus Setiawan', $this->finance, S::Sick);
});

test('HR sees who is present, late, on leave and not checked in, per division', function () {
    $this->actingAs($this->hr)->get(route('attendance.board'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('attendance/board')
            ->where('board.summary.scheduled', 5)
            ->where('board.summary.present', 2)
            ->where('board.summary.late', 1)
            ->where('board.summary.onLeave', 2)
            ->where('board.summary.notCheckedIn', 1)
            ->where('board.summary.leaveBreakdown', [
                ['status' => 'leave', 'label' => 'Cuti', 'count' => 1],
                ['status' => 'sick', 'label' => 'Sakit', 'count' => 1],
            ])
            ->where('board.divisions', [
                ['id' => $this->finance->id, 'name' => 'Keuangan', 'scheduled' => 2, 'onTime' => 0, 'late' => 0, 'onLeave' => 1, 'notCheckedIn' => 1],
                ['id' => $this->ops->id, 'name' => 'Operasional', 'scheduled' => 3, 'onTime' => 1, 'late' => 1, 'onLeave' => 1, 'notCheckedIn' => 0],
            ])
            ->where('board.people.0.name', 'Agus Setiawan')
            ->where('board.people.0.state', 'leave')
            ->where('channels', ['company' => true, 'divisions' => []])
            ->where('can.correct', true));
});

test('a Kepala Divisi sees only the own division and listens on its channel', function () {
    $this->actingAs($this->kadiv)->get(route('attendance.board'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('board.summary.scheduled', 3)
            ->has('board.people', 3)
            ->where('channels', ['company' => false, 'divisions' => [$this->ops->id]])
            ->where('can.correct', false));
});

test('employees without reports cannot open the board or the recap', function () {
    $this->actingAs($this->sari)->get(route('attendance.board'))->assertForbidden();
    $this->actingAs($this->sari)->get(route('attendance.recap'))->assertForbidden();
});

test('the location filter narrows the board', function () {
    $other = F::office();
    $this->actingAs($this->hr)->get(route('attendance.board', ['lokasi' => $other->id]))
        ->assertInertia(fn (Assert $page) => $page->where('filters.lokasi', $other->id)->where('board.summary.scheduled', 0));

    $this->actingAs($this->hr)->get(route('attendance.board', ['lokasi' => 'bukan-id']))
        ->assertInertia(fn (Assert $page) => $page->where('filters.lokasi', null)->where('board.summary.scheduled', 5));
});

test('flagged logs are listed for review and HR can mark them reviewed', function () {
    $day = AttendanceDay::query()->where('user_id', $this->bayu->id)->sole();
    $log = AttendanceLog::factory()->forDay($day)->create([
        'flags' => [LogFlag::NewDevice, LogFlag::ClockSkew],
        'is_suspicious' => true,
        'selfie_path' => '2026/10/x/selfie.jpg',
        'office_location_id' => $this->office->id,
    ]);

    $this->actingAs($this->hr)->get(route('attendance.board'))
        ->assertInertia(fn (Assert $page) => $page
            ->where('suspicious.total', 1)
            ->where('suspicious.items.0.id', $log->id)
            ->where('suspicious.items.0.name', 'Bayu Saputra')
            ->where('suspicious.items.0.flags', [['value' => 'new_device', 'label' => 'Perangkat baru'], ['value' => 'clock_skew', 'label' => 'Jam perangkat tidak sesuai']])
            ->where('suspicious.items.0.canViewSelfie', true)
            ->where('suspicious.items.0.canReview', true));

    // Kadiv sees it (own division) but is not the direct manager, cannot view the selfie nor review.
    $this->actingAs($this->kadiv)->get(route('attendance.board'))
        ->assertInertia(fn (Assert $page) => $page->where('suspicious.items.0.canViewSelfie', false)->where('suspicious.items.0.canReview', false));
    $this->actingAs($this->kadiv)->post(route('attendance.logs.review', $log))->assertForbidden();

    $this->actingAs($this->hr)->from(route('attendance.board'))->post(route('attendance.logs.review', $log))->assertRedirect(route('attendance.board'));

    $log->refresh();
    expect($log->reviewed_by)->toBe($this->hr->id)
        ->and($log->reviewed_at)->not->toBeNull()
        ->and(AuditLog::query()->where('action', 'attendance.log_reviewed')->sole()->user_id)->toBe($this->hr->id);

    // Reviewing twice keeps the first review.
    $this->travel(5)->minutes();
    $this->actingAs(User::factory()->withRole(Role::SuperAdmin)->create())->post(route('attendance.logs.review', $log))->assertRedirect();
    expect($log->fresh()?->reviewed_by)->toBe($this->hr->id);

    $this->actingAs($this->hr)->get(route('attendance.board'))->assertInertia(fn (Assert $page) => $page->where('suspicious.total', 0));
});

test('HR cannot review their own flagged log', function () {
    $day = AttendanceDay::factory()->for($this->hr)->on('2026-10-05')->create();
    $log = AttendanceLog::factory()->forDay($day)->create(['is_suspicious' => true, 'flags' => [LogFlag::NewDevice]]);

    $this->actingAs($this->hr)->post(route('attendance.logs.review', $log))->assertForbidden();
});

test("yesterday's missing check-outs are listed", function () {
    AttendanceDay::factory()->for($this->sari)->on('2026-10-04')->status(S::NeedsCorrection)->create(['check_in_at' => F::at('2026-10-04 05:57')->utc()]);
    AttendanceDay::factory()->for($this->fitri)->on('2026-10-04')->status(S::Present)->create(['check_in_at' => F::at('2026-10-04 07:57')->utc(), 'check_out_at' => F::at('2026-10-04 17:00')->utc()]);

    $this->actingAs($this->hr)->get(route('attendance.board'))
        ->assertInertia(fn (Assert $page) => $page
            ->has('missingCheckOut', 1)
            ->where('missingCheckOut.0.name', 'Sari Wulandari')
            ->where('missingCheckOut.0.workDate', '2026-10-04'));
});

test('night-shift workers still inside their check-out window are not listed as missing a check-out', function () {
    // Sun 4 Oct 22.00 → Mon 5 Oct 06.00; with the 6 h grace the check-out stays open until 12.00.
    $night = F::employee(shift: Shift::factory()->night()->create(['office_location_id' => $this->office->id]));
    $night->update(['name' => 'Rudi Malam', 'division_id' => $this->ops->id]);
    AttendanceDay::factory()->for($night)->on('2026-10-04')->status(S::Present)->create([
        'check_in_at' => F::at('2026-10-04 21:55')->utc(),
        'scheduled_start' => F::at('2026-10-04 22:00')->utc(),
        'scheduled_end' => F::at('2026-10-05 06:00')->utc(),
    ]);
    // Day shift of yesterday, ended 17.00 + grace: listed.
    AttendanceDay::factory()->for($this->sari)->on('2026-10-04')->status(S::Present)->create([
        'check_in_at' => F::at('2026-10-04 07:57')->utc(),
        'scheduled_start' => F::at('2026-10-04 08:00')->utc(),
        'scheduled_end' => F::at('2026-10-04 17:00')->utc(),
    ]);

    $names = fn () => collect($this->actingAs($this->hr)->get(route('attendance.board'))->viewData('page')['props']['missingCheckOut'])->pluck('name')->all();

    expect($names())->toBe(['Sari Wulandari']);

    // After 12.00 the night shift can no longer check out: now it is missing.
    $this->travelTo(F::at('2026-10-05 12:00'));
    expect($names())->toBe(['Sari Wulandari', 'Rudi Malam']);
});
